import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoDetentor } from "@/lib/custodia";

// ═══════════════════════════════════════════════════════════════════════════
// O ESCRITOR ÚNICO DO LIVRO DE CUSTÓDIA
// ═══════════════════════════════════════════════════════════════════════════
//
// Por que este arquivo existe, e por que fora de `src/lib/data/`:
//
// O AGENTS.md dá endereço para LEITURA compartilhada (`src/lib/data/`) e não dá
// para ESCRITA compartilhada. Este escritor é chamado de dois grupos de rota —
// `termos/actions.ts` e `frota/actions.ts` — e copiá-lo nos dois é exatamente
// como as duas cópias divergem.
//
// Recebe o `supabase` de quem chama, e não cria o seu: a action já criou um, e
// dois clientes na mesma requisição gastam duas resoluções de sessão. Nunca
// `createAdminClient()` — o isolamento por organização depende de RLS.
//
// MODO DE FALHA DESTA ARQUITETURA: um `.update({ obra_id })` novo em qualquer
// action faz o campo e o livro divergirem sem estourar erro. A varredura de
// `src/lib/custodia-varredura.test.ts` é o que reprova isso no CI.
// ═══════════════════════════════════════════════════════════════════════════

export type ResultadoCustodia = { ok: true } | { ok: false; erro: string };

export type AberturaCustodia = {
  orgId: string;
  unidadeId: string;
  tipo: TipoDetentor;
  obraId?: string | null;
  funcionarioId?: string | null;
  fornecedorId?: string | null;
  /** 'yyyy-mm-dd'. Quem chama passa `hojeISOSaoPaulo()` ou a data do documento. */
  inicio: string;
  origem: "termo" | "manual";
  termoId?: string | null;
  observacoes?: string | null;
};

// Este projeto não tem tipos gerados do Supabase; `data/frota.ts` e
// `data/termo.ts` fazem o mesmo por meio de casts. O tipo do cliente não é o
// que dá segurança aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any, "public", any>;

/**
 * Encerra a posse aberta da peça, se houver.
 *
 * Idempotente de propósito: sem posse aberta não faz nada e NÃO é erro. Quem
 * chama vem de eventos que podem repetir — dois cliques em "encerrar termo",
 * uma devolução registrada duas vezes — e transformar repetição em erro faria
 * a segunda tentativa parecer falha na cara de quem está com o funcionário na
 * frente.
 */
export async function fecharCustodia(
  supabase: Cliente,
  { unidadeId, fim }: { unidadeId: string; fim: string },
): Promise<ResultadoCustodia> {
  const { data: aberta, error: erroLeitura } = await supabase
    .from("custodia_peca")
    .select("id, inicio")
    .eq("unidade_id", unidadeId)
    .is("fim", null)
    .maybeSingle();

  if (erroLeitura) {
    console.error("fecharCustodia/leitura", erroLeitura);
    return { ok: false, erro: "Não foi possível ler a posse atual da peça." };
  }
  if (!aberta) return { ok: true };

  const linha = aberta as unknown as { id: string; inicio: string };

  // O check `fim >= inicio` do banco recusaria com erro cru de Postgres. Aqui
  // a recusa vira frase que quem digitou entende.
  if (fim < linha.inicio) {
    // Loga como os outros três ramos do arquivo: este é o ramo que dispara
    // quando alguém retrodata um termo para antes da posse aberta, e sem log
    // ele seria o único modo de falha do livro sem rastro em produção.
    console.error("fecharCustodia/ordem", { unidadeId, fim, inicio: linha.inicio });
    return {
      ok: false,
      erro: `A data informada (${fim}) é anterior ao início desta posse (${linha.inicio}).`,
    };
  }

  const { error } = await supabase
    .from("custodia_peca")
    .update({ fim })
    .eq("id", linha.id);

  if (error) {
    console.error("fecharCustodia/update", error);
    return { ok: false, erro: "Não foi possível encerrar a posse atual." };
  }
  return { ok: true };
}

/**
 * Abre uma posse nova, fechando a anterior na MESMA data.
 *
 * Fechar antes de abrir é o que impede o buraco de um dia entre duas posses —
 * e é obrigatório de todo jeito: o índice único parcial recusa a segunda posse
 * aberta na mesma peça.
 *
 * Também atualiza `equipamento_unidade.obra_id`, que continua existindo porque
 * o filtro e o índice de `/frota` dependem dele. Aqui é o único escritor
 * daquele campo fora de `adicionarUnidade` — duas telas escrevendo a mesma
 * verdade é como se cria divergência silenciosa.
 */
export async function abrirCustodia(
  supabase: Cliente,
  e: AberturaCustodia,
): Promise<ResultadoCustodia> {
  const fechou = await fecharCustodia(supabase, {
    unidadeId: e.unidadeId,
    fim: e.inicio,
  });
  if (!fechou.ok) return fechou;

  const { error } = await supabase.from("custodia_peca").insert({
    org_id: e.orgId,
    unidade_id: e.unidadeId,
    tipo: e.tipo,
    obra_id: e.obraId ?? null,
    funcionario_id: e.funcionarioId ?? null,
    fornecedor_id: e.fornecedorId ?? null,
    inicio: e.inicio,
    origem: e.origem,
    termo_id: e.termoId ?? null,
    observacoes: e.observacoes ?? null,
  });

  if (error) {
    console.error("abrirCustodia/insert", error);
    return { ok: false, erro: "Não foi possível registrar a posse da peça." };
  }

  const { data: atualizada, error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .update({ obra_id: e.obraId ?? null })
    .eq("id", e.unidadeId)
    // O `.select("id")` é o que torna a divergência VISÍVEL. Sem ele, um UPDATE
    // filtrado pela cláusula `using` de uma policy de RLS devolve `error: null`
    // e ZERO linhas, e o PostgREST não trata isso como erro: a posse entraria
    // no livro, a peça continuaria no lugar antigo, e a action devolveria
    // sucesso. Divergência silenciosa é justamente o que este arquivo existe
    // para impedir.
    .select("id");

  if (erroPeca || !atualizada?.length) {
    console.error("abrirCustodia/cache", erroPeca ?? "update atingiu 0 linhas");
    // A posse JÁ foi gravada e é a verdade. Mas o campo que a Frota lê ficou
    // para trás, e quem acabou de mover a peça precisa saber disso agora — a
    // tela de Frota mostraria a peça no lugar antigo sem explicar por quê.
    return {
      ok: false,
      erro:
        "A posse foi registrada, mas a localização da peça não mudou no cadastro — " +
        "provavelmente falta de permissão para alterar a peça. Avise um administrador.",
    };
  }

  return { ok: true };
}
