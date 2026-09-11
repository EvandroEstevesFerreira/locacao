// Os códigos das contas de consumo do imóvel — a instalação da luz, o RGI da
// água, o contrato da internet.
//
// POR QUE ISTO EXISTE. O Mega tem 803 contas de consumo e nenhuma diz de que
// imóvel é: o agente é a concessionária, que atende a casa toda. Casar por
// valor e vencimento foi medido e não funciona — 20% dos títulos colidem em
// agente + mês + valor, e três contas de água de imóveis diferentes chegaram a
// cair no mesmo dia com R$ 74,83, R$ 74,86 e R$ 75,44.
//
// O número da instalação está impresso em toda conta, não muda nunca e é único.
// Cadastrado aqui, ele liga a conta do Mega a este imóvel sem nenhum chute.

import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { tipoConsumoLabel } from "@/lib/imoveis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PontoConsumoForm } from "./ponto-consumo-form";

export async function PontosConsumo({
  imovelId,
  podeEditar,
}: {
  imovelId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ponto_consumo")
    .select("id, tipo, identificador, concessionaria_nome, concessionaria_codigo_mega, ativo")
    .eq("imovel_id", imovelId)
    .order("tipo");

  const pontos = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Códigos das contas de consumo</CardTitle>
        <CardDescription>
          O número da instalação (luz), do RGI (água) ou do contrato (internet).
          É por ele que o Loca encontra a conta paga no Mega.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pontos.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Zap className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Nenhum código cadastrado. Sem eles, as contas de luz e água deste
              imóvel não são reconhecidas no Mega.
            </span>
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pontos.map((p) => (
              <li key={p.id as string} className="flex items-center gap-3 p-2 text-sm">
                <span className="w-20 shrink-0 font-medium">
                  {tipoConsumoLabel(p.tipo as string)}
                </span>
                <span className="shrink-0 tabular-nums">{p.identificador as string}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {(p.concessionaria_nome as string | null) ?? "—"}
                </span>
                {/* Sem a concessionária o número é ambíguo: nada impede duas
                    delas de usarem a mesma numeração de instalação. */}
                {!p.concessionaria_codigo_mega ? (
                  <Badge variant="outline" className="shrink-0">
                    Sem concessionária
                  </Badge>
                ) : null}
                {!p.ativo ? (
                  <Badge variant="secondary" className="shrink-0">
                    Inativo
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {podeEditar ? <PontoConsumoForm imovelId={imovelId} /> : null}
      </CardContent>
    </Card>
  );
}
