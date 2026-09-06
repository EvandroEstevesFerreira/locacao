// A página pública de assinatura.
//
// FORA do grupo `(app)` de propósito: sem menu lateral, sem cabeçalho do
// sistema, sem link para lugar nenhum. Quem abre isto não tem login e não
// precisa descobrir que existe um sistema atrás.
//
// A leitura é UMA chamada a `termo_do_link`, que é `security definer` e devolve
// exclusivamente o termo que aquele token destrava. Nenhum `select` em tabela.

import { createClient } from "@/lib/supabase/server";
import { hashDoToken } from "@/lib/assinatura-servidor";
import { ESTADO_LINK_INFO } from "@/lib/assinatura-link";
import { formatarData } from "@/lib/locacao";
import { estadoLabel } from "@/lib/termo";
import { AssinaturaForm } from "./assinatura-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Termo de responsabilidade",
  // A página não deve aparecer em busca. O link é para uma pessoa só.
  robots: { index: false, follow: false },
};

type ItemDoLink = {
  descricao: string;
  patrimonio: string | null;
  quantidade: number;
  unidade: string | null;
  estado_entrega: string;
};

type Payload = {
  estado: string;
  funcionario?: string;
  obra?: string | null;
  data_entrega?: string;
  previsao_devolucao?: string | null;
  observacoes?: string | null;
  itens?: ItemDoLink[];
};

export default async function AssinarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("termo_do_link", {
    p_token_hash: hashDoToken(token),
  });
  if (error) console.error("termo_do_link", error);

  // `null` cobre link inexistente, vencido, usado e revogado — os quatro no
  // mesmo estado de propósito: distinguir "não existe" de "venceu" diria a um
  // curioso que aquele token já foi bom.
  const payload = (data as Payload | null) ?? null;
  const estado = (payload?.estado ?? "invalido") as keyof typeof ESTADO_LINK_INFO | "pronto";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8">
      {estado !== "pronto" ? (
        <div className="rounded-lg border p-6">
          <h1 className="text-lg font-medium">{ESTADO_LINK_INFO[estado].titulo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ESTADO_LINK_INFO[estado].texto}
          </p>
        </div>
      ) : (
        <>
          <header>
            <h1 className="text-xl font-medium">Termo de responsabilidade</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {payload!.funcionario}
              {payload!.obra ? ` · ${payload!.obra}` : ""}
            </p>
          </header>

          <section className="space-y-3 rounded-lg border p-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Data da entrega</dt>
                <dd className="text-sm">{formatarData(payload!.data_entrega ?? null)}</dd>
              </div>
              {payload!.previsao_devolucao ? (
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Previsão de devolução
                  </dt>
                  <dd className="text-sm">
                    {formatarData(payload!.previsao_devolucao)}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Equipamento sob sua responsabilidade
              </p>
              <ul className="divide-y rounded-md border">
                {(payload!.itens ?? []).map((i, n) => (
                  <li key={n} className="px-3 py-2 text-sm">
                    <span className="font-medium">{i.descricao}</span>
                    {i.patrimonio ? (
                      <span className="ml-2 text-muted-foreground">
                        · {i.patrimonio}
                      </span>
                    ) : null}
                    <span className="ml-2 text-muted-foreground">
                      · {i.quantidade}
                      {i.unidade ? ` ${i.unidade}` : ""} · {estadoLabel(i.estado_entrega)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {payload!.observacoes ? (
              <p className="text-sm text-muted-foreground">{payload!.observacoes}</p>
            ) : null}
          </section>

          <AssinaturaForm token={token} />
        </>
      )}
    </main>
  );
}
