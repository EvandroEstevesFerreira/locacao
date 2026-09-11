// Os contratos que o Mega tem com este fornecedor, nesta obra.
//
// O LOCA PROJETA, O MEGA REGISTRA. A tela do contrato já mostra "valor
// contratado × comprometido": o primeiro é digitado, o segundo é calculado a
// partir dos itens cadastrados. Aqui está o número oficial do ERP — quanto foi
// contratado de verdade, quanto já foi medido e quanto sobra.
//
// O RECORTE É FORNECEDOR + OBRA. A CCN, por exemplo, tem 19 contratos em 12
// obras; listar todos na tela de um contrato de uma obra só seria ruído, e
// faria o total parecer o desta obra.

import { FileSignature } from "lucide-react";
import { obterContratosDoMega } from "@/lib/data/mega";
import { formatarBRL } from "@/lib/locacao";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function ContratoMegaContratos({
  fornecedorId,
  obraId,
}: {
  fornecedorId: string;
  obraId: string;
}) {
  const contratos = await obterContratosDoMega(fornecedorId, obraId);

  // Sem contrato no ERP a seção some: a maioria das locações é comprada por
  // pedido, sem contrato formal, e um card vazio sugeriria falta de cadastro.
  if (contratos.length === 0) return null;

  const contratado = contratos.reduce((s, c) => s + c.totalContratado, 0);
  const medido = contratos.reduce((s, c) => s + c.medicao, 0);
  const saldo = contratos.reduce((s, c) => s + c.saldo, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contratos no Mega</CardTitle>
        <CardDescription>
          {contratos.length === 1
            ? "O contrato deste fornecedor nesta obra, como está no ERP."
            : `Os ${contratos.length} contratos deste fornecedor nesta obra, como estão no ERP.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Contratado</p>
            <p className="mt-1 text-lg font-semibold">{formatarBRL(contratado)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Medido</p>
            <p className="mt-1 text-lg font-semibold">{formatarBRL(medido)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="mt-1 text-lg font-semibold">{formatarBRL(saldo)}</p>
          </div>
        </div>

        <ul className="divide-y rounded-md border">
          {contratos.map((c) => {
            const pct =
              c.totalContratado > 0
                ? Math.round((c.medicao / c.totalContratado) * 100)
                : 0;
            return (
              <li key={c.id} className="flex items-start gap-3 p-2 text-sm">
                <FileSignature
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.nome ?? `Contrato ${c.codigo}`}</span>
                  <span className="text-muted-foreground"> · nº {c.codigo}</span>
                  {c.produto ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {c.produto}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block tabular-nums">{formatarBRL(c.totalContratado)}</span>
                  {/* A PORCENTAGEM É O QUE SE LÊ DE RELANCE. "R$ 28.821 de
                      R$ 28.821" exige conta; "100% medido" não. */}
                  <span className="block text-xs text-muted-foreground">
                    {pct}% medido
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          Medição é o que a obra atestou como executado, e é o que vira nota. O
          saldo é o que ainda pode ser medido neste contrato.
        </p>
      </CardContent>
    </Card>
  );
}
