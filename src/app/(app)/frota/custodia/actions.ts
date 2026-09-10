"use server";

// Emissão dos termos do mutirão.
//
// POR QUE ATRAVÉS DO TERMO, e não gravando custódia direto. A tentativa anterior
// (0.97.0) chamou `abrirCustodia` com `origem: "manual"` e falhou nas 88 peças:
// o check `custodia_funcionario_exige_termo` da migration 0059 recusa posse de
// funcionário sem termo, com o motivo escrito ao lado — "o valor do termo é
// justamente ser a única fonte de verdade sobre quem respondeu pelo
// equipamento". A invariante está certa. A custódia nasce da emissão, por
// `moverPecasDoTermo`, com `origem: 'termo'`.
//
// A TRAVA DE TESTE É OBRIGATÓRIA AQUI, e é a decisão mais importante deste
// arquivo. Emitir 50 termos manda 50 e-mails a 50 pessoas, com link de
// assinatura e cobrança a cada 3 dias. Se `EMAIL_MODO_TESTE` estiver desligado,
// esta action RECUSA — em vez de confiar que alguém conferiu a variável na
// Vercel antes de clicar. O acidente aqui não tem desfazer: e-mail enviado não
// volta.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { exigirModulo } from "@/lib/modulos";
import { mutiraoTermosSchema, resumoDoMutirao } from "@/lib/frota";
import { emTeste } from "@/lib/emails/modo-teste";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { salvarTermo, emitirTermo } from "../../termos/actions";

export async function emitirTermosDoMutirao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para emitir termos do mutirão.");
  }

  // A trava. Ver o comentário do topo — este `if` é o que impede 50 e-mails
  // acidentais, e ele fica no SERVIDOR porque a tela pode estar velha.
  if (!emTeste()) {
    return falha(
      "O modo de teste de e-mail está DESLIGADO. Emitir agora mandaria a via e o " +
        "pedido de assinatura para cada funcionário de verdade. Ligue " +
        "EMAIL_MODO_TESTE antes de usar o mutirão.",
    );
  }

  const parsed = mutiraoTermosSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const unidadeIds = parsed.data.pares.map((p) => p.unidade_id);

  // Os dados que o termo exige, lidos do BANCO e não do que o cliente mandou:
  // `item_id` e `controle` decidem se o termo aceita a linha, e confiar no
  // formulário aqui deixaria uma requisição forjada montar termo inconsistente.
  const { data: pecas } = await supabase
    .from("equipamento_unidade")
    .select("id, obra_id, item_id, estado, item:item_id(controle)")
    .in("id", unidadeIds);

  type PecaBruta = {
    id: string;
    obra_id: string | null;
    item_id: string;
    estado: string | null;
    item: { controle: "peca" | "quantidade" } | null;
  };
  const porId = new Map(
    ((pecas ?? []) as unknown as PecaBruta[]).map((p) => [p.id, p]),
  );

  // PEÇA QUE JÁ TEM DONO NÃO ENTRA. Cinto e suspensório contra o defeito que
  // custou 48 termos duplicados: a tela mantinha a seleção entre rodadas e cada
  // clique reemitia as mesmas peças. Reemitir "funciona" — `abrirCustodia`
  // fecha a posse anterior e abre outra —, então nada estoura: só sobram
  // documentos numerados a mais, e ninguém sabe qual vale.
  const { data: jaComDono } = await supabase
    .from("custodia_peca")
    .select("unidade_id")
    .is("fim", null)
    .in("unidade_id", unidadeIds);
  const comDono = new Set(
    ((jaComDono ?? []) as { unidade_id: string }[]).map((c) => c.unidade_id),
  );

  // Um termo POR PESSOA, com todas as peças dela nesta rodada. Um termo por
  // peça daria três documentos para quem levou três máquinas no mesmo dia, e
  // três e-mails para assinar.
  const porFuncionario = new Map<string, string[]>();
  let jaTinhamDono = 0;
  for (const par of parsed.data.pares) {
    if (comDono.has(par.unidade_id)) {
      jaTinhamDono += 1;
      continue;
    }
    const atual = porFuncionario.get(par.funcionario_id) ?? [];
    atual.push(par.unidade_id);
    porFuncionario.set(par.funcionario_id, atual);
  }
  if (porFuncionario.size === 0) {
    return falha(
      jaTinhamDono > 0
        ? `Todas as ${jaTinhamDono} peças enviadas já têm dono registrado. Recarregue a tela.`
        : "Nenhuma peça válida na seleção.",
    );
  }

  const hoje = hojeISOSaoPaulo();
  const emitidos: string[] = [];
  const falhas: string[] = [];
  const avisos: string[] = [];

  for (const [funcionarioId, ids] of porFuncionario) {
    const daPessoa = ids.map((id) => porId.get(id)).filter(Boolean) as PecaBruta[];
    if (daPessoa.length === 0) {
      falhas.push("Peça não encontrada.");
      continue;
    }

    // `obra_id` do termo só quando TODAS as peças da pessoa estão na mesma
    // obra. Escolher uma das duas poria no documento uma obra que não vale para
    // metade dos itens.
    const obras = new Set(daPessoa.map((p) => p.obra_id));
    const obraId = obras.size === 1 ? (daPessoa[0]!.obra_id ?? null) : null;

    const criado = await salvarTermo({
      termo: {
        funcionario_id: funcionarioId,
        obra_id: obraId,
        data_entrega: hoje,
        observacoes:
          "Termo de regularização do inventário de TI, emitido a partir do nome registrado na planilha de coleta.",
      },
      itens: daPessoa.map((p) => ({
        item_id: p.item_id,
        controle: p.item?.controle ?? "peca",
        unidade_id: p.id,
        quantidade: 1,
        // `bom` quando a peça não tem estado no cadastro. O termo exige um
        // valor, e "com_avaria" acusaria dano que ninguém viu.
        estado_entrega: p.estado ?? "bom",
      })),
    });
    if (!criado.ok) {
      falhas.push(criado.erro);
      continue;
    }
    const termoId = criado.id;
    if (!termoId) {
      falhas.push("O rascunho foi salvo mas não devolveu o número interno.");
      continue;
    }

    // Sem assinatura: é o que a 0.96.0 destravou. A pessoa recebe a via com o
    // link e o sistema cobra a cada 3 dias — e a custódia nasce agora, que é o
    // que o mutirão existe para fazer.
    const emitido = await emitirTermo(termoId, {
      funcionario: { nome: "", cpf: null, imagem: null },
      empresa: { nome: perfil.nome ?? "Sistenge", imagem: null },
    });
    if (!emitido.ok) {
      falhas.push(emitido.erro);
      continue;
    }
    // NÃO DESCARTAR O AVISO. `emitirTermo` devolve aqui o motivo exato quando a
    // via por e-mail não sai — "sem e-mail cadastrado", "e-mail deduzido não
    // conferido", "o envio falhou". A primeira versão desta action só olhava
    // `ok` e anunciava "os e-mails foram para a caixa de teste" sem ter base:
    // 142 termos emitidos, ZERO e-mails enviados, e nenhuma pista de por quê,
    // porque a informação existia e era jogada fora aqui.
    if (emitido.aviso) avisos.push(emitido.aviso);
    emitidos.push(termoId);
  }

  revalidatePath("/frota");
  revalidatePath("/frota/custodia");
  revalidatePath("/termos");

  if (emitidos.length === 0) {
    return falha(falhas[0] ?? "Nenhum termo foi emitido.");
  }
  // A mensagem é montada por `resumoDoMutirao`, que tem teste: a versão
  // anterior afirmava "os e-mails foram para a caixa de teste" a partir de
  // `emitidos.length > 0`, e emitir termo não tem relação com a via ter saído.
  return {
    ok: true,
    aviso: resumoDoMutirao({
      emitidos: emitidos.length,
      jaTinhamDono,
      falhas,
      avisos,
    }),
  };
}
