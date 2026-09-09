// Seção "Locação" da peça de terceiro: quem é o dono, e a qual contrato ela
// está amarrada.
//
// Só existe para peça `propriedade = 'locada'`. Numa peça própria da Sistenge a
// pergunta não faz sentido, e a seção seria ruído numa tela que já tem seis.
//
// A empresa é DERIVADA do contrato (ver `donoDaPeca` em src/lib/frota.ts), não
// guardada na peça — não há campo que possa divergir do contrato. A exceção é o
// dono provisório, para a peça que veio da planilha e cujo contrato ainda não
// existe no Loca.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { obterDonoDaPeca, listarContratosParaAmarrar } from "@/lib/data/custodia";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Campo } from "@/components/shared/campo";
import { PecaLocacaoForm } from "./peca-locacao-form";

export async function PecaLocacao({
  pecaId,
  itemId,
  fornecedores,
  podeEditar,
}: {
  pecaId: string;
  itemId: string;
  fornecedores: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const [{ dono, provisorioId }, linhas] = await Promise.all([
    obterDonoDaPeca(pecaId),
    podeEditar
      ? listarContratosParaAmarrar({ id: pecaId, itemId })
      : Promise.resolve([]),
  ]);

  // A linha à qual ela JÁ está amarrada, para o seletor abrir no valor atual.
  const atual =
    dono.origem === "contrato" || dono.origem === "contrato-sem-fornecedor"
      ? (linhas.find((l) => l.contratoNumero === dono.contratoNumero)?.itemLocadoId ??
        null)
      : null;

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">Locação</CardTitle>
        <CardDescription>
          De quem é este equipamento, e sob qual contrato ele está na obra.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dono.origem === "ambiguo" ? (
          /* O banco permite isto — a migration 0049 criou índice comum, não
             único. Mostrar os dois é o que manda alguém consertar o dado;
             escolher um produziria uma tela plausível e errada. */
          <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                Esta peça consta em {dono.contratos.length} contratos em aberto.
              </p>
              <p className="text-muted-foreground">
                Só um pode estar certo. Confira e solte a peça do contrato que não
                vale:{" "}
                {dono.contratos.map((c, i) => (
                  <span key={c.contratoId}>
                    {i > 0 ? ", " : ""}
                    <Link
                      href={`/contratos/${c.contratoId}`}
                      className="underline underline-offset-2"
                    >
                      {c.contratoNumero}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Empresa responsável"
              valor={
                dono.origem === "contrato"
                  ? dono.nome
                  : dono.origem === "provisorio"
                    ? `${dono.nome} (informado no cadastro, sem contrato)`
                    : null
              }
            />
            <Campo
              label="Contrato"
              node={
                dono.origem === "contrato" ||
                dono.origem === "contrato-sem-fornecedor" ? (
                  <Link
                    href={`/contratos/${dono.contratoId}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {dono.contratoNumero}
                  </Link>
                ) : undefined
              }
              valor={
                dono.origem === "contrato" || dono.origem === "contrato-sem-fornecedor"
                  ? undefined
                  : null
              }
            />
            {dono.origem === "contrato-sem-fornecedor" ? (
              /* A peça ESTÁ amarrada; o que falta é fornecedor no contrato.
                 Cair em "—" mandaria a pessoa procurar no lugar errado. */
              <p className="text-xs text-muted-foreground sm:col-span-2">
                O contrato {dono.contratoNumero} não tem fornecedor cadastrado —
                é lá que a empresa se corrige, não aqui.
              </p>
            ) : null}
          </div>
        )}

        {podeEditar ? (
          <PecaLocacaoForm
            pecaId={pecaId}
            linhas={linhas}
            fornecedores={fornecedores}
            itemLocadoAtual={atual}
            fornecedorProvisorioAtual={provisorioId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
