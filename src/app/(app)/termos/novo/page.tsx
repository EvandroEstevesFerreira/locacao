import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { pecasComResponsavel } from "@/lib/data/frota";
import { podeReceberTermo, resolverPecaPedida } from "@/lib/custodia";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TermoWizard } from "../termo-wizard";

export const metadata = { title: "Novo termo — Loca" };

/**
 * Emissão de um termo.
 *
 * `?peca=` pré-monta a linha do passo 2 e é o caminho de chegada mais comum:
 * o botão "Registrar quem está com ela" / "Entregar a funcionário" da página da
 * peça. Mesmo desenho do `?avaria=` da abertura de ordem de reparo.
 */
export default async function NovoTermoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/termos");

  const { peca: pecaPedida, funcionario: funcionarioPedido } = await searchParams;

  const supabase = await createClient();

  const [{ data: funcionarios }, { data: itens }, { data: pecas }, obras, { data: org }] =
    await Promise.all([
      supabase
        .from("funcionario")
        .select("id, nome, cpf")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("item_catalogo")
        .select("id, descricao, unidade, controle")
        // SEM `.is("deleted_at", null)`: `item_catalogo` NÃO TEM essa coluna.
        // O PostgREST recusa a consulta inteira, `data` volta nulo, e a lista
        // sai vazia sem erro na tela. Era por isso que o seletor de item do
        // termo não mostrava nada, com 27 itens ativos no banco — e por isso o
        // sistema tinha ZERO termos emitidos. Quem exclui item aqui usa
        // `ativo = false`.
        .eq("ativo", true)
        .order("descricao"),
      // A PROTEÇÃO É "SEM CUSTÓDIA ABERTA", e não "situação disponível".
      //
      // A intenção sempre foi a mesma — oferecer uma peça que já está com outra
      // pessoa produziria dois termos assinados sobre o mesmo patrimônio. Mas o
      // teste estava errado, e o erro travou 95 máquinas.
      //
      // A importação do inventário marcou `em_uso` a partir da planilha, sem
      // criar termo. E `em_uso` é um estado que a matriz de transição só
      // considera alcançável PELO termo — e do qual só se sai por devolução
      // registrada NUM termo. Sem termo, a peça não podia receber um nem voltar
      // a `disponivel`: impasse fechado, sem saída pela tela.
      //
      // Quem não tem custódia aberta não está com ninguém, diga a coluna
      // `situacao` o que disser. É essa a pergunta que protege.
      supabase
        .from("equipamento_unidade")
        // `obra_id` entra para pré-selecionar a obra quando o termo nasce da
        // peça: é o mesmo conhecimento vindo do mesmo clique, e escolhê-la de
        // novo é a mesma fricção de escolher o equipamento de novo.
        .select("id, identificador, item_id, situacao, obra_id")
        .in("situacao", ["disponivel", "em_uso"])
        .order("identificador"),
      listarObrasParaFiltro(),
      supabase
        .from("organizacao")
        .select("nome")
        .eq("id", perfil!.org_id)
        .maybeSingle(),
    ]);

  // Tira as que ALGUEM JA ASSINOU. `null` = a consulta de custodia falhou; ai a
  // lista sai vazia em vez de oferecer tudo, porque errar para o lado de
  // oferecer produz dois termos sobre o mesmo patrimonio.
  const comResponsavel = await pecasComResponsavel();
  const livres = ((pecas ?? []) as unknown as {
    id: string;
    identificador: string;
    item_id: string;
    situacao: string;
    obra_id: string | null;
  }[]).filter(
    (p) =>
      // `null` = a consulta de custodia falhou; nesse caso nenhuma peca entra.
      comResponsavel !== null &&
      podeReceberTermo({
        situacao: p.situacao,
        temPosseAberta: comResponsavel.has(p.id),
      }),
  );

  const listaFuncionarios = (funcionarios ?? []) as unknown as {
    id: string;
    nome: string;
    cpf: string | null;
  }[];

  // O botão da peça só aparece quando ela PODE receber termo, então cair no
  // ramo do aviso é raro: alguém emitiu um termo para ela entre o clique e o
  // carregamento desta tela. Raro não é nunca, e o silêncio nesse caso manda a
  // pessoa procurar no passo 2 uma peça que não está lá.
  const { peca: pecaEscolhida, foraDaLista } = resolverPecaPedida(pecaPedida, livres);
  const avisoPeca = foraDaLista
    ? "A peça que você escolheu não está mais livre — alguém deve tê-la entregado agora há pouco. Monte o termo escolhendo o equipamento abaixo, ou volte à Frota para conferir com quem ela está."
    : null;

  return (
    <div className="pagina-form space-y-6">
      <PageHeader
        titulo="Novo termo de responsabilidade"
        descricao="Quem recebe, o que sai, em que estado e com assinatura"
        acoes={
          <Button variant="outline" render={<Link href="/termos" />}>
            Cancelar
          </Button>
        }
      />

      {listaFuncionarios.length === 0 ? (
        // Sem funcionário não há quem assine, e o passo a passo travaria no
        // primeiro campo. Dizer o que falta é melhor que uma lista vazia.
        <EmptyState
          titulo="Nenhum funcionário cadastrado"
          descricao="O termo é assinado por um funcionário. Cadastre quem recebe equipamento antes de emitir o primeiro termo."
          acao={{ label: "Cadastrar funcionários", href: "/termos/funcionarios" }}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <TermoWizard
              funcionarios={listaFuncionarios}
              itens={
                ((itens ?? []) as unknown as {
                  id: string;
                  descricao: string;
                  unidade: string | null;
                  controle: "peca" | "quantidade";
                }[])
              }
              pecas={livres.map((p) => ({
                id: p.id,
                identificador: p.identificador,
                itemId: p.item_id,
              }))}
              obras={obras}
              nomeEmpresa={(org as { nome: string } | null)?.nome ?? "Sistenge"}
              pecaInicial={
                pecaEscolhida
                  ? {
                      id: pecaEscolhida.id,
                      identificador: pecaEscolhida.identificador,
                      itemId: pecaEscolhida.item_id,
                    }
                  : null
              }
              // Só pré-seleciona obra que existe na lista do seletor: a leitura
              // da peça é livre na organização, mas `listarObrasParaFiltro`
              // respeita o escopo por obra de quem está olhando. Um `value` sem
              // `<option>` correspondente deixa o select em branco e a obra se
              // perde em silêncio na emissão.
              obraInicial={
                pecaEscolhida?.obra_id &&
                obras.some((o) => o.id === pecaEscolhida.obra_id)
                  ? pecaEscolhida.obra_id
                  : ""
              }
              // Vem da transferência de custódia, que já perguntou para quem a
              // peça vai. Só vale se a pessoa estiver na lista — `?funcionario=`
              // é digitável, e um id solto deixaria o seletor em branco sem
              // ninguém entender por quê.
              funcionarioInicial={
                funcionarioPedido &&
                listaFuncionarios.some((f) => f.id === funcionarioPedido)
                  ? funcionarioPedido
                  : ""
              }
              avisoPeca={avisoPeca}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
