import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TriangleAlert, ArrowLeft } from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { obterServico } from "@/lib/data/servicos";
import {
  CATEGORIA_SERVICO_INFO,
  conferenciaVencida,
  DIAS_CONFERENCIA_VALIDA,
} from "@/lib/servicos";
import { formatarBRL, formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { ServicoForm } from "../servico-form";
import { BlocoAtribuicoes } from "./_components/bloco-atribuicoes";
import { BlocoRateio } from "./_components/bloco-rateio";

export const metadata = { title: "Serviço — Loca" };

export default async function ServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/servicos");

  const { id } = await params;
  const servico = await obterServico(id);
  if (!servico) notFound();

  const supabase = await createClient();
  const [{ data: fornecedores }, { data: funcionarios }] = await Promise.all([
    // `ativo`, e NUNCA `deleted_at`: `fornecedor` não tem essa coluna, e o
    // PostgREST recusaria a consulta inteira, devolvendo lista vazia em
    // silêncio.
    supabase.from("fornecedor").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("funcionario").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  const cat = CATEGORIA_SERVICO_INFO[servico.categoria] ?? CATEGORIA_SERVICO_INFO.outro;
  const hoje = hojeISOSaoPaulo();
  const vencida = conferenciaVencida(servico.conferido_em, hoje);
  const jaAtribuidas = servico.atribuicoes.length;

  return (
    <div className="pagina-leitura space-y-6">
      <PageHeader
        titulo={servico.nome}
        descricao={`${cat.label} · ${servico.fornecedor_nome ?? "sem fornecedor"} · ${servico.quantidade} contratadas, ${jaAtribuidas} em uso`}
        acoes={
          <Button variant="ghost" render={<Link href="/servicos" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      {vencida ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {servico.conferido_em
              ? `A última conferência contra o provedor foi em ${formatarData(servico.conferido_em)}, há mais de ${DIAS_CONFERENCIA_VALIDA} dias.`
              : "Este serviço nunca foi conferido contra o provedor."}{" "}
            Enquanto isso, o número de licenças ociosas pode estar errado — e é
            nele que alguém se baseia para cancelar assinatura.
          </span>
        </div>
      ) : null}

      <BlocoRateio servico={servico} />

      <BlocoAtribuicoes
        contratoId={servico.id}
        atribuicoes={servico.atribuicoes}
        quantidade={servico.quantidade}
        funcionarios={(funcionarios ?? []) as unknown as { id: string; nome: string }[]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Dados do contrato{" "}
            <Badge variant={cat.variant} className="ml-1 align-middle">
              {cat.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ServicoForm
            servico={{
              id: servico.id,
              nome: servico.nome,
              categoria: servico.categoria,
              fornecedor_id: servico.fornecedor_id,
              quantidade: servico.quantidade,
              valor_unitario_centavos: servico.valor_unitario_centavos,
              cadencia: servico.cadencia,
              data_inicio: servico.data_inicio,
              data_fim: servico.data_fim,
              renova_automaticamente: servico.renova_automaticamente,
              conferido_em: servico.conferido_em,
              status: servico.status,
              observacoes: servico.observacoes,
            }}
            fornecedores={(fornecedores ?? []) as unknown as { id: string; nome: string }[]}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Custo do período: {formatarBRL(servico.totalCentavos / 100)} ·{" "}
            {servico.renova_automaticamente
              ? "renova automaticamente"
              : "não renova automaticamente"}
            {servico.data_fim
              ? ` · vigência até ${formatarData(servico.data_fim)}`
              : " · vigência indeterminada"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
