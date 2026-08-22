// Registros do alojamento: medidas disciplinares (FRM-RH-002) e entregas ao
// ocupante — chaves (FRM-RH-003) e kit (FRM-RH-004).
//
// As duas listas ficam no mesmo componente porque compartilham o público (RH e
// encarregado) e a lista de alojados. Mas são cards separados: a medida
// disciplinar é confidencial e some inteira para quem não pode lê-la, enquanto
// as entregas todo mundo da obra vê.

import { Download, Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarMedidas, listarEntregas } from "@/lib/data/alojamento";
import { formatarData } from "@/lib/locacao";
import {
  TIPO_MEDIDA_INFO,
  TIPO_ENTREGA_INFO,
  TRATATIVA_INFO,
  tipoMedidaLabel,
  tipoEntregaLabel,
  type TipoMedida,
  type Tratativa,
} from "@/lib/alojamento";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MedidaForm, EntregaForm } from "../../alojamento-forms";
import { excluirMedidaDisciplinar, excluirEntregaOcupante } from "../../actions";

export async function ImovelAlojamento({
  imovelId,
  podeEditar,
}: {
  imovelId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const [{ data: ocupantesRaw }, medidas, entregas] = await Promise.all([
    supabase
      .from("ocupante_imovel")
      .select("id, nome")
      .eq("imovel_id", imovelId)
      .order("nome"),
    listarMedidas(imovelId),
    listarEntregas(imovelId),
  ]);
  const ocupantes = (ocupantesRaw ?? []) as { id: string; nome: string }[];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entregas ao alojado</CardTitle>
          <CardDescription>
            Chaves (FRM-RH-003) e kit de alojamento (FRM-RH-004). O que foi
            entregue e ainda não voltou aparece primeiro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {entregas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma entrega registrada neste alojamento.
            </p>
          ) : (
            <div className="divide-y">
              {entregas.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {e.ocupante_nome}{" "}
                      <span className="font-normal text-muted-foreground">
                        — {tipoEntregaLabel(e.tipo)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.entregue_em
                        ? `Entrega em ${formatarData(e.entregue_em)}`
                        : "Sem data de entrega"}
                      {e.devolvido_em
                        ? ` · Devolução em ${formatarData(e.devolvido_em)}`
                        : null}
                      {e.tratativa
                        ? ` · ${TRATATIVA_INFO[e.tratativa as Tratativa]}`
                        : null}
                    </p>
                  </div>
                  {e.devolvido_em ? (
                    <Badge variant="outline">Devolvido</Badge>
                  ) : (
                    <Badge variant="secondary">Em posse do alojado</Badge>
                  )}
                  {podeEditar ? (
                    <ConfirmDelete
                      action={excluirEntregaOcupante}
                      id={e.id}
                      hidden={{ imovel_id: imovelId }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {podeEditar && ocupantes.length > 0 ? (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                <Plus className="mr-1 inline size-3.5" aria-hidden />
                Registrar entrega ou devolução
              </summary>
              <div className="pt-3">
                <EntregaForm imovelId={imovelId} ocupantes={ocupantes} />
              </div>
            </details>
          ) : null}

          {ocupantes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Cadastre um ocupante antes de registrar entregas.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* A lista de medidas some inteira para quem não pode lê-las: a policy de
          SELECT esconde as linhas, então `medidas` chega vazia. Mostramos o card
          apenas a quem pode registrar — para os demais ele nem existe. */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medidas disciplinares</CardTitle>
            <CardDescription>
              Advertências e suspensões (FRM-RH-002), nos termos da POL-RH-001 e
              da CLT. Registro de pasta funcional — visível apenas a quem gere
              cadastros.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {medidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma medida disciplinar registrada neste alojamento.
              </p>
            ) : (
              <div className="divide-y">
                {medidas.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-start gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {m.ocupante_nome}{" "}
                        <span className="font-normal text-muted-foreground">
                          — {formatarData(m.data)}
                        </span>
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {m.fato_descricao}
                      </p>
                    </div>
                    <Badge variant={TIPO_MEDIDA_INFO[m.tipo as TipoMedida]?.variant}>
                      {tipoMedidaLabel(m.tipo)}
                      {m.suspensao_dias ? ` · ${m.suspensao_dias} dia(s)` : ""}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/api/medidas/${m.id}/pdf`} target="_blank" />}
                    >
                      <Download className="size-3.5" aria-hidden />
                      PDF
                    </Button>
                    {/* Apagar advertência remove prova de pasta funcional: o
                        soft_delete só deixa o master, e a ação fica na auditoria. */}
                    <ConfirmDelete
                      action={excluirMedidaDisciplinar}
                      id={m.id}
                      hidden={{ imovel_id: imovelId }}
                      mensagem="Excluir esta medida disciplinar? Ela é prova de pasta funcional."
                    />
                  </div>
                ))}
              </div>
            )}

            {ocupantes.length > 0 ? (
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  <Plus className="mr-1 inline size-3.5" aria-hidden />
                  Registrar medida disciplinar
                </summary>
                <div className="pt-3">
                  <MedidaForm imovelId={imovelId} ocupantes={ocupantes} />
                </div>
              </details>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cadastre um ocupante antes de registrar medidas.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

export { TIPO_ENTREGA_INFO };
