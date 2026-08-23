// Ocupantes do imóvel — base do Termo de Compromisso de Alojamento
// (FRM-RH-001) e de todo o registro do alojado.

import { Check, FileText, Plus, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarDataHora } from "@/lib/locacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { PiiText } from "@/components/pii-text";
import { OcupanteForm } from "../../ocupante-form";
import {
  excluirOcupante,
  registrarAceiteTermo,
  desfazerAceiteTermo,
} from "../../actions";

type Ocupante = {
  id: string;
  nome: string;
  cpf: string | null;
  contato: string | null;
  data_entrada: string | null;
  data_saida: string | null;
  aceite_em: string | null;
};

export async function ImovelOcupantes({
  imovelId,
  podeEditar,
  /**
   * Desfazer um aceite apaga a prova do momento original, então é ato de
   * cadastro, mais restrito que registrar. Sem a prop, ninguém desfaz.
   */
  podeGerirCadastros = false,
}: {
  imovelId: string;
  podeEditar: boolean;
  podeGerirCadastros?: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ocupante_imovel")
    .select("id, nome, cpf, contato, data_entrada, data_saida, aceite_em")
    .eq("imovel_id", imovelId)
    .order("created_at", { ascending: false });

  const ocupantes = (data ?? []) as Ocupante[];

  return (
    <>
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Adicionar ocupante
            </CardTitle>
            <CardDescription>
              Para kitnet/casa/apartamento — base do termo de responsabilidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OcupanteForm imovelId={imovelId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Ocupantes ({ocupantes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ocupantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum ocupante cadastrado.
            </p>
          ) : (
            ocupantes.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {o.nome}
                    {o.cpf ? (
                      <>
                        {" · "}
                        <PiiText value={o.cpf} keepEnd={2} />
                      </>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      o.contato,
                      o.data_entrada
                        ? `entrada ${formatarData(o.data_entrada)}`
                        : null,
                      o.data_saida ? `saída ${formatarData(o.data_saida)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={`/api/imoveis/${imovelId}/termo-pdf?ocupante=${o.id}`}
                      />
                    }
                  >
                    <FileText className="size-4" /> Gerar termo
                  </Button>
                  {/* Aceite eletrônico do FRM-RH-001. As colunas existem desde a
                      migration 0043 e o primitivo <Assinaturas modo="aceite">
                      desde a fase 1 — aqui é só a ação que preenche.
                      O IP não prova identidade: prova que a confirmação partiu
                      daquela sessão autenticada, naquele momento. O termo em
                      papel continua valendo enquanto o Jurídico não se
                      manifestar; isto é complemento, não substituto. */}
                  {o.aceite_em ? (
                    <>
                      <Badge variant="outline" title={formatarDataHora(o.aceite_em)}>
                        <Check className="size-3" aria-hidden /> Aceite em{" "}
                        {formatarData(o.aceite_em.slice(0, 10))}
                      </Badge>
                      {podeGerirCadastros ? (
                        <form action={desfazerAceiteTermo}>
                          <input type="hidden" name="id" value={o.id} />
                          <input type="hidden" name="imovel_id" value={imovelId} />
                          <Button type="submit" variant="ghost" size="sm">
                            <Undo2 className="size-4" aria-hidden /> Desfazer
                          </Button>
                        </form>
                      ) : null}
                    </>
                  ) : podeEditar ? (
                    <form action={registrarAceiteTermo}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="imovel_id" value={imovelId} />
                      <Button type="submit" variant="ghost" size="sm">
                        <Check className="size-4" aria-hidden /> Registrar aceite
                      </Button>
                    </form>
                  ) : null}
                  {podeEditar ? (
                    <ConfirmDelete
                      action={excluirOcupante}
                      id={o.id}
                      hidden={{ imovel_id: imovelId }}
                    />
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
