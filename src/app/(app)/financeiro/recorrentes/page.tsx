import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { formatarBRL, periodosPorMes, type Cadencia } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { gerarRecorrentes } from "../actions";

export const metadata = { title: "Gerar contas recorrentes — Loca" };

const inputClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

/** Mês atual + 11 (ISO 'yyyy-MM'), limite padrão de materialização. */
function atePadrao(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 11);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type ContratoLoc = {
  id: string;
  numero: string;
  cadencia: Cadencia;
  data_inicio: string;
  data_fim_prevista: string | null;
  obra: { codigo: string } | null;
  item_locado: {
    quantidade: number;
    valor_unitario_periodo: number;
    movimentacao: { quantidade: number; tipo: string }[] | null;
  }[] | null;
};

type ContratoImv = {
  id: string;
  valor_aluguel: number;
  valor_condominio: number;
  valor_iptu: number;
  seguro_fianca: number | null;
  seguro_fianca_mensal: boolean | null;
  data_inicio: string | null;
  data_fim: string | null;
  imovel: { apelido: string; obra: { codigo: string } | null } | null;
};

export default async function RecorrentesPage() {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarFinanceiro(perfil?.papel)) redirect("/financeiro");

  const supabase = await createClient();
  const [{ data: locData }, { data: imvData }] = await Promise.all([
    supabase
      .from("contrato_locacao")
      .select(
        "id, numero, cadencia, data_inicio, data_fim_prevista, obra:obra_id(codigo), item_locado(quantidade, valor_unitario_periodo, movimentacao(quantidade, tipo))",
      )
      .eq("status", "ativo")
      .order("numero"),
    supabase
      .from("contrato_imovel")
      .select(
        "id, valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, data_inicio, data_fim, imovel:imovel_id(apelido, obra:obra_id(codigo))",
      )
      .eq("vigente", true),
  ]);

  const locacoes = (locData ?? []) as unknown as ContratoLoc[];
  const imoveis = (imvData ?? []) as unknown as ContratoImv[];
  const ate = atePadrao();

  const custoLoc = (c: ContratoLoc) =>
    (c.item_locado ?? []).reduce((s, i) => {
      const devolvido = (i.movimentacao ?? [])
        .filter((m) => m.tipo === "devolucao")
        .reduce((a, m) => a + Number(m.quantidade), 0);
      const saldo = Math.max(0, Number(i.quantidade) - devolvido);
      return s + saldo * Number(i.valor_unitario_periodo) * periodosPorMes(c.cadencia);
    }, 0);

  const custoImv = (c: ContratoImv) =>
    Number(c.valor_aluguel) +
    Number(c.valor_condominio) +
    Number(c.valor_iptu) +
    (c.seguro_fianca_mensal ? Number(c.seguro_fianca ?? 0) : 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Gerar contas a pagar recorrentes"
        descricao="Materializa uma conta por mês (aluguel/locação) para dar baixa individual. Não duplica meses já gerados."
        acoes={
          <Button variant="outline" render={<Link href="/financeiro" />}>
            Voltar
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contratos de imóvel vigentes</CardTitle>
          <CardDescription>
            Aluguel + condomínio + IPTU + seguro fiança (quando mensal). Requer imóvel vinculado a uma obra.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {imoveis.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum contrato de imóvel vigente.</p>
          ) : (
            imoveis.map((c) => {
              const semObra = !c.imovel?.obra?.codigo;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium">{c.imovel?.apelido ?? "Imóvel"}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.imovel?.obra?.codigo ? `Obra ${c.imovel.obra.codigo}` : "Sem obra vinculada"} · {formatarBRL(custoImv(c))}/mês
                    </p>
                  </div>
                  <GerarForm tipo="imovel" id={c.id} ate={ate} desabilitado={semObra} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contratos de locação ativos (equipamentos)</CardTitle>
          <CardDescription>
            Custo mensal estimado pelo saldo em aberto × cadência do contrato.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {locacoes.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhum contrato de locação ativo.</p>
          ) : (
            locacoes.map((c) => {
              const custo = custoLoc(c);
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium">Contrato {c.numero}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.obra?.codigo ? `Obra ${c.obra.codigo}` : "—"} · {formatarBRL(custo)}/mês
                    </p>
                  </div>
                  <GerarForm tipo="locacao" id={c.id} ate={ate} desabilitado={custo <= 0} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GerarForm({
  tipo,
  id,
  ate,
  desabilitado,
}: {
  tipo: "imovel" | "locacao";
  id: string;
  ate: string;
  desabilitado?: boolean;
}) {
  return (
    <form action={gerarRecorrentes} className="flex items-end gap-2">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Gerar até</label>
        <input type="month" name="ate" defaultValue={ate} className={inputClasses} disabled={desabilitado} />
      </div>
      <Button type="submit" size="sm" disabled={desabilitado}>
        Gerar
      </Button>
    </form>
  );
}
