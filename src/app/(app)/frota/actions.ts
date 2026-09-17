"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import {
  erroDeEscrita,
  falha,
  primeiroErro,
  type ActionResult,
} from "@/lib/acoes";
import { exigirModulo } from "@/lib/modulos";
import { camposFichaSchema, validarFicha } from "@/lib/catalogo";
import {
  movimentarPecaSchema,
  editarPecaSchema,
  podeEncerrarDevolucao,
} from "@/lib/custodia";
import { abrirCustodia, type Cliente } from "@/lib/custodia-servidor";
import {
  amarrarPecaSchema,
  podeTransicionar,
  motivoBloqueio,
  situacaoDaPosse,
  SITUACOES,
  type PosseAberta,
  type Situacao,
} from "@/lib/frota";
import { registrarDevolucao, encerrarTermo } from "../termos/actions";

/**
 * A PORTA ÚNICA: toda mudança de quem está com a peça passa por aqui.
 *
 * Eram três atos em três lugares — o card "Movimentar" (almoxarifado, obra,
 * fornecedor), o botão "Transferir custódia" (só quando uma pessoa estava com
 * ela) e "Novo termo". Entregar a peça ao Fulano não estava no formulário
 * chamado "Movimentar", e quem procurava por ali não achava.
 *
 * O QUE ESTA ACTION NÃO FAZ: criar posse de pessoa. O check
 * `custodia_funcionario_exige_termo` (migration 0059) recusa isso no banco, e
 * ele tem razão — quem respondeu pelo equipamento se registra assinando. Com
 * destino `funcionario` ela deixa a peça no ALMOXARIFADO, que é onde a peça
 * está de verdade enquanto o termo não sai, e devolve `{ ok: true }`; quem
 * navega para `/termos/novo` é o cliente.
 *
 * NÃO REDIRECIONA. Um `redirect()` lança `NEXT_REDIRECT` e mataria o
 * `if (!r.ok)` de quem chamou, inclusive o `router.push` que leva ao termo.
 */
export async function movimentarPeca(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para movimentar peças.");
  }

  const parsed = movimentarPecaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabase = await createClient();

  const { data: peca, error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .select("id, situacao")
    .eq("id", d.unidade_id)
    .single();
  if (erroPeca || !peca) return falha("Peça não encontrada.");
  const situacaoAtual = (peca as unknown as { situacao: Situacao }).situacao;

  // A POSSE ABERTA É LIDA AQUI, e o `termo_id` sai dela. Nunca do cliente:
  // aceitar um `termo_id` de fora permitiria encerrar o termo de OUTRA peça, e
  // encerrar termo alheio devolve para `disponivel` equipamento que está
  // legitimamente com alguém. `null` é estado legítimo — é o de toda peça
  // cadastrada antes de o livro existir.
  const { data: posseLida, error: erroPosse } = await supabase
    .from("custodia_peca")
    .select("tipo, termo_id, detentor_rotulo, funcionario:funcionario_id(nome)")
    .eq("unidade_id", d.unidade_id)
    .is("fim", null)
    .maybeSingle();
  if (erroPosse) return falha("Não consegui ler a posse atual da peça.");

  const posseAtual = (posseLida ?? null) as unknown as {
    tipo: Exclude<PosseAberta, null>;
    termo_id: string | null;
    detentor_rotulo: string | null;
    funcionario: { nome: string } | null;
  } | null;

  // ── 1. A SITUAÇÃO DE DESTINO, antes de qualquer escrita ──────────────────
  // Com destino `funcionario` a posse que fica aberta é a do ALMOXARIFADO: a de
  // pessoa nasce na emissão do termo, e é o almoxarifado que responde "onde
  // está" enquanto o documento não é assinado.
  const posseFinal: Exclude<PosseAberta, null> =
    d.tipo === "funcionario" ? "almoxarifado" : d.tipo;
  const manual = d.situacao_final === "baixada" || d.situacao_final === "perdida";
  const destinoSituacao: Situacao = manual
    ? (d.situacao_final as Situacao)
    : situacaoDaPosse(posseFinal);

  // ── 2. A MATRIZ, EM TODA MOVIMENTAÇÃO ────────────────────────────────────
  // Não só nas manuais. Uma peça `baixada` mandada para obra chegaria a
  // `em_uso` sem passar por lugar nenhum, e material dado como sucateado ou
  // perdido voltaria ao serviço em silêncio — a matriz só admite
  // `baixada → disponivel`.
  //
  // A ÚNICA exceção é a origem `em_uso` que a devolução logo abaixo resolve: a
  // recusa de mexer em peça em uso existia porque esta action não sabia
  // encerrar termo, e agora sabe. Fora daí, `de` é a situação de verdade.
  const saiDePessoa = posseAtual?.tipo === "funcionario";

  // ── A POSSE SOZINHA NÃO SABE SE ALGUÉM ASSINOU POR ESTA PEÇA ─────────────
  //
  // O banco garante a implicação em UMA direção só:
  // `custodia_funcionario_exige_termo` (migration 0059) obriga posse de
  // funcionário a ter termo — e nada obriga termo aberto a ter posse. Uma peça
  // nesse estado chega aqui com `posseAtual` de obra, ou sem posse nenhuma, e
  // `saiDePessoa` é falso: ela seguiria para o fornecedor com um termo assinado
  // ainda aberto, dizendo que uma pessoa com nome responde por equipamento que
  // não está mais com ela.
  //
  // Hoje essa combinação é anomalia de dado. Foi assim que nasceu a anomalia
  // que a Task 1 corrigiu, e "só acontece com dado ruim" é o motivo pelo qual
  // registro e livro puderam discordar em primeiro lugar.
  //
  // A consulta roda SÓ neste ramo: quando `saiDePessoa` é verdadeiro, a
  // devolução logo abaixo já cuida do termo, e perguntar de novo seria cobrar
  // duas vezes pela mesma resposta.
  if (!saiDePessoa) {
    const aberto = await temTermoEmAberto(supabase, d.unidade_id);
    if (aberto === null) {
      // FECHA A PORTA quando não dá para saber. Seguir em frente aqui é
      // apostar que não há termo, e a aposta perdida é um documento assinado
      // que continua valendo sobre peça que foi para outro lugar.
      return falha(
        "Não consegui conferir se esta peça está em algum termo de responsabilidade. Tente de novo em instantes.",
      );
    }
    if (aberto) {
      return falha(
        "Esta peça está em um termo de responsabilidade em aberto. Registre a devolução no termo antes de movimentá-la.",
      );
    }
  }

  // A ORIGEM INFORMADA À MATRIZ: `em_uso` aqui NUNCA é o de um termo aberto.
  //
  // Nenhum caminho chega a esta linha com termo em aberto sobre a peça: ou ela
  // sai de uma pessoa, e a devolução logo abaixo encerra o termo, ou
  // `temTermoEmAberto` já barrou. Então o `em_uso` que resta vem da POSSE — a
  // peça está numa obra — e a movimentação é o próprio evento que o muda.
  //
  // Tratá-lo como `disponivel` é o que permite trazer da obra uma peça que vai
  // ser BAIXADA: com `de = "em_uso"` a matriz recusaria com "encerre o termo de
  // responsabilidade", sobre um termo que não existe. A proteção que a matriz
  // dá ao `em_uso` assinado continua inteira em `mudarSituacao`, que é a porta
  // da mão e não encerra termo nenhum.
  const de: Situacao = situacaoAtual === "em_uso" ? "disponivel" : situacaoAtual;
  //
  // `baixada` e `perdida` são decisão humana e só passam por `manual`. Já uma
  // situação DEDUZIDA da posse não está sendo digitada por ninguém: mover a
  // peça é o evento que a muda, e aceitar as duas origens é o que permite a
  // devolução de obra e a volta da oficina direto para o canteiro.
  const passa = manual
    ? podeTransicionar(de, destinoSituacao, "manual")
    : podeTransicionar(de, destinoSituacao, "manual") ||
      podeTransicionar(de, destinoSituacao, "evento");
  if (!passa) {
    return falha(
      motivoBloqueio(de, destinoSituacao) ??
        "Esta peça não pode ser movimentada na situação atual.",
    );
  }

  // ── 3. SAIR DA PESSOA VEM ANTES DE MOVER A POSSE ─────────────────────────
  // Se a devolução falhar, a posse NÃO se move: peça no almoxarifado com termo
  // aberto dizendo que está com alguém é pior que a movimentação que não
  // aconteceu — a primeira mente, a segunda só não fez nada.
  if (saiDePessoa) {
    const devolveu = await devolverDaPessoa(supabase, {
      unidadeId: d.unidade_id,
      termoId: posseAtual.termo_id,
      data: d.data,
      // A PARADA DE ZERO DIA SE EVITA NA ORIGEM, porque o livro é
      // somente-inclusão: a linha errada não se apaga depois (não há policy de
      // DELETE, e a trigger `trg_custodia_imutavel` recusaria de todo jeito).
      // Quando a peça vai da pessoa direto para a obra ou para o fornecedor, a
      // devolução NÃO abre a posse de almoxarifado — a posse da pessoa fica
      // aberta até o `abrirCustodia` logo abaixo, que é quem a fecha.
      abrirPosseDeVolta: posseFinal === "almoxarifado",
      estado: d.estado_devolucao,
      observacoes: d.observacoes,
      // O nome de quem devolve sai do SERVIDOR, da própria posse. Vindo da
      // tela, seria campo digitável dentro de um documento assinado.
      assinante:
        posseAtual.funcionario?.nome ??
        posseAtual.detentor_rotulo ??
        "Responsável não identificado",
      assinatura: d.assinatura_devolucao,
      motivoSemAssinatura: d.motivo_sem_assinatura,
      empresa: perfil.nome ?? "—",
    });
    if (!devolveu.ok) {
      // A DEVOLUÇÃO NÃO É ATÔMICA, e o corte é em `encerrarTermo`. Antes dele
      // nada saiu do lugar e `ok: false` é a verdade. Depois dele, não: a
      // devolução já está gravada nos itens do termo, e isso não se desfaz.
      // Dizer "falhou" ali manda o usuário tentar de novo, e a segunda recusa
      // ("já consta devolvida") é ainda menos compreensível que a primeira. É
      // a mesma regra do passo 5.
      if (!devolveu.posseJaMoveu) return falha(devolveu.erro);
      revalidarMovimentacao(d.unidade_id);
      // O AVISO NÃO PODE AFIRMAR ONDE A PEÇA ESTÁ. Só quando o destino é o
      // almoxarifado a devolução abriu a posse de lá (`abrirPosseDeVolta`);
      // indo para obra ou fornecedor ela NÃO abriu, e a peça continua com a
      // pessoa no livro. A frase antiga dizia "voltou ao almoxarifado" nos três
      // casos, e nos dois últimos era mentira — a ficha ao lado mostraria o
      // nome de quem está com ela.
      return {
        ok: true,
        id: d.unidade_id,
        aviso:
          posseFinal === "almoxarifado"
            ? `A peça voltou ao almoxarifado, mas o termo não foi encerrado e a movimentação parou aí. ${devolveu.erro}`
            : `A devolução foi registrada, mas o termo não foi encerrado e a movimentação parou aí: a peça ainda consta com quem estava. ${devolveu.erro}`,
      };
    }
  }

  // ── 4. A POSSE NOVA ──────────────────────────────────────────────────────
  // Pulada quando a peça JÁ está no almoxarifado e é para lá que ela vai: ou
  // porque a devolução acabou de deixá-la ali, ou porque ela já estava. Abrir
  // de novo fecharia e reabriria a mesma posse no mesmo dia, deixando no livro
  // uma linha de zero dia que não conta nada — e que não se apaga depois.
  //
  // NÃO depende mais do destino ser `funcionario`. Com essa condição a mais,
  // "pessoa → almoxarifado" caía no ramo de baixo e produzia exatamente a linha
  // de zero dia que este trecho existe para evitar.
  const jaEstaOndeVai =
    posseFinal === "almoxarifado" &&
    (saiDePessoa || posseAtual?.tipo === "almoxarifado");
  if (!jaEstaOndeVai) {
    const r = await abrirCustodia(supabase, {
      orgId: perfil.org_id,
      unidadeId: d.unidade_id,
      tipo: posseFinal,
      obraId: d.tipo === "obra" ? d.obra_id : null,
      fornecedorId: d.tipo === "fornecedor" ? d.fornecedor_id : null,
      inicio: d.data,
      origem: "manual",
      observacoes: d.observacoes,
    });
    if (!r.ok) {
      // MESMA REGRA DO PASSO 5. `abrirCustodia` falha de dois jeitos: o insert
      // recusado, em que nada mudou, e o cache `obra_id` que não subiu, em que
      // a posse JÁ está no livro. E quando a peça saía de uma pessoa, o termo
      // já foi encerrado de todo modo. Nesses dois casos `ok: false` seria
      // mentira e mandaria repetir o que não se repete.
      if (!r.posseGravada && !saiDePessoa) return falha(r.erro);
      revalidarMovimentacao(d.unidade_id);
      return { ok: true, id: d.unidade_id, aviso: r.erro };
    }

  }

  // ── 5. A SITUAÇÃO ────────────────────────────────────────────────────────
  const { data: mudou, error } = await supabase
    .from("equipamento_unidade")
    .update({ situacao: destinoSituacao })
    .eq("id", d.unidade_id)
    // `.select("id")` porque UPDATE de ZERO linhas não é erro para o PostgREST:
    // uma policy de RLS que filtra a linha devolve `error: null` e nada mudado,
    // e sem isto a action diria "movido" com a peça parada.
    .select("id");
  if (error || !mudou?.length) {
    console.error("movimentarPeca/situacao", error ?? "update atingiu 0 linhas");
    // `ok: true` com aviso, e NÃO `ok: false`. O que veio antes é
    // irreversível — a posse está no livro, e quando havia pessoa o termo já
    // foi encerrado. Dizer "falhou" faria quem clicou tentar de novo sobre um
    // termo que não existe mais, e o segundo erro seria ainda menos
    // compreensível que o primeiro.
    // REVALIDA IGUAL. A posse mudou e o termo pode ter sido encerrado: sem
    // isto, o aviso apareceria sobre uma tela que ainda mostra o estado
    // anterior, e quem lesse concluiria que nada aconteceu.
    revalidarMovimentacao(d.unidade_id);
    return {
      ok: true,
      id: d.unidade_id,
      aviso:
        "A movimentação foi registrada, mas a situação da peça não mudou no cadastro — " +
        "provavelmente falta de permissão para alterar a peça. Avise um administrador.",
    };
  }

  revalidarMovimentacao(d.unidade_id);
  return { ok: true, id: d.unidade_id };
}

/**
 * Esta peça está em algum termo de responsabilidade que ainda corre?
 *
 * Item sem `data_devolucao`, em termo que não foi encerrado nem cancelado. O
 * `!inner` é o que faz o filtro do termo valer como filtro da consulta — sem
 * ele o PostgREST devolveria o item com o termo nulo e a pergunta responderia
 * "sim" para termo já encerrado.
 *
 * `null` é "não sei", e quem chama trata como bloqueio. Devolver `false` num
 * erro de leitura transformaria falha de rede em autorização.
 */
async function temTermoEmAberto(
  supabase: Cliente,
  unidadeId: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("termo_equipamento_item")
    .select("id, termo:termo_id!inner(encerrado_em, cancelado_em)")
    .eq("unidade_id", unidadeId)
    .is("data_devolucao", null)
    .is("termo.encerrado_em", null)
    .is("termo.cancelado_em", null)
    .limit(1);

  if (error) {
    console.error("temTermoEmAberto", error);
    return null;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * As três telas que uma movimentação muda: a lista, a peça e os termos.
 *
 * Numa função só porque os dois caminhos de saída de `movimentarPeca` precisam
 * dela — inclusive o que devolve aviso. Esquecer um deles deixa o usuário
 * lendo o recado sobre a tela velha.
 */
function revalidarMovimentacao(unidadeId: string): void {
  revalidatePath("/frota");
  revalidatePath(`/frota/${unidadeId}`);
  revalidatePath("/termos");
}

/**
 * O que a devolução devolve — com o corte de irreversibilidade explícito.
 *
 * Não é `ActionResult` porque `ActionResult` não tem onde dizer isto, e a
 * diferença decide entre `ok: false` e `ok: true` + `aviso` em quem chama.
 */
type ResultadoDevolucao =
  | { ok: true }
  | { ok: false; erro: string; posseJaMoveu: boolean };

/** Recusa ANTES de qualquer escrita: nada se moveu, tentar de novo é seguro. */
function recusa(erro: string): ResultadoDevolucao {
  return { ok: false, erro, posseJaMoveu: false };
}

/**
 * A metade da devolução, quando a peça está saindo de uma pessoa.
 *
 * Não reimplementa nada: chama `registrarDevolucao` e `encerrarTermo`, as
 * mesmas que a rota `/frota/[id]/transferir` usava antes de ser removida.
 * Continuam sendo DOIS documentos — este encerra o de quem entrega, e o de quem
 * recebe é a emissão normal.
 *
 * `posseJaMoveu` existe porque a devolução NÃO é atômica: `registrarDevolucao`
 * grava a data nos itens e chama `liberarPecas`, que põe a peça no
 * almoxarifado; só depois vem `encerrarTermo`. Uma falha DEPOIS desse corte
 * deixa a peça já movida, e quem chama precisa saber disso para não devolver
 * `ok: false` sobre o que já aconteceu.
 */
async function devolverDaPessoa(
  // O cliente vem de quem chama: a action já criou um, e dois clientes na
  // mesma requisição gastam duas resoluções de sessão.
  supabase: Cliente,
  e: {
    unidadeId: string;
    termoId: string | null;
    data: string;
    estado: string | null;
    observacoes: string | null;
    /** Ver `liberarPecas`: `false` quando a peça não para no almoxarifado. */
    abrirPosseDeVolta: boolean;
    assinante: string;
    assinatura: string | null;
    motivoSemAssinatura: string | null;
    empresa: string;
  },
): Promise<ResultadoDevolucao> {
  if (!e.termoId) {
    return recusa(
      "Esta peça consta com uma pessoa, mas sem termo aberto. Regularize a custódia antes de movimentá-la.",
    );
  }
  // O estado é exigido AQUI e não no schema: só neste caminho ele existe, e um
  // campo obrigatório no schema pediria estado de conservação a quem só está
  // mandando a betoneira para a obra.
  if (!e.estado) {
    return recusa("Informe o estado de conservação da peça na devolução.");
  }
  const estado = e.estado;

  // OU ASSINOU, OU ESCREVEU O PORQUÊ — e a pergunta é feita ANTES de escrever
  // qualquer coisa. `encerrarTermo` também a faz, mas lá é tarde: quando ele
  // recusa, `registrarDevolucao` já gravou a data e o estado nos itens — e, se
  // `abrirPosseDeVolta` for verdadeiro, `liberarPecas` já terá aberto a posse
  // de almoxarifado por cima. A action devolveria erro com a devolução já
  // registrada e o termo ainda aberto — exatamente o estado que a ordem desta
  // função existe para impedir.
  const pode = podeEncerrarDevolucao({
    assinou: Boolean(e.assinatura),
    motivo: e.motivoSemAssinatura,
  });
  if (!pode.ok) return recusa(pode.erro);

  const { data: itens, error: erroItens } = await supabase
    .from("termo_equipamento_item")
    .select("id")
    .eq("termo_id", e.termoId)
    .eq("unidade_id", e.unidadeId)
    .is("data_devolucao", null);

  if (erroItens) return recusa("Não consegui ler os itens do termo.");
  if (!itens?.length) return recusa("Esta peça já consta devolvida neste termo.");

  const rDev = await registrarDevolucao(
    e.termoId,
    (itens as { id: string }[]).map((i) => ({
      item_id: i.id,
      data_devolucao: e.data,
      estado_devolucao: estado,
      // `undefined`, e não `null`: é o que a assinatura de `registrarDevolucao`
      // aceita para "sem observação".
      observacoes: e.observacoes ?? undefined,
    })),
    { abrirPosseDeVolta: e.abrirPosseDeVolta },
  );
  if (!rDev.ok) return recusa(rDev.erro);

  // O motivo sem assinatura entra porque 211 pessoas da base estão desligadas,
  // e uma que saiu com um notebook não volta para assinar. Exigir a assinatura
  // ali não protegeria ninguém — só impediria o registro da verdade.
  const rFim = await encerrarTermo(
    e.termoId,
    {
      funcionario: { nome: e.assinante, cpf: null, imagem: e.assinatura },
      empresa: { nome: e.empresa, imagem: null },
    },
    e.motivoSemAssinatura,
  );
  // AQUI O IRREVERSÍVEL JÁ ACONTECEU: `registrarDevolucao` gravou a data e o
  // estado nos itens do termo, e uma segunda tentativa esbarraria em "já consta
  // devolvida". Se `abrirPosseDeVolta` era verdadeiro, a posse de almoxarifado
  // também já está aberta; se era falso, a peça segue com a pessoa no livro e
  // quem chamou abre a posse de destino em seguida. Nos dois casos, falhar em
  // encerrar o termo é falha de um passo POSTERIOR ao que não se desfaz — daí
  // `posseJaMoveu`, que quem chama usa para não pedir repetição.
  return rFim.ok ? { ok: true } : { ok: false, erro: rFim.erro, posseJaMoveu: true };
}

/**
 * Edita a peça — e NÃO move.
 *
 * Sem `obra_id` e sem `situacao`, de propósito: os dois mudam só por
 * `movimentarPeca` e `mudarSituacao`, que passam pelo livro. Um formulário de
 * edição genérico com `obra_id` dentro seria a primeira porta a furar a
 * custódia, e a divergência apareceria em silêncio.
 */
export async function editarPeca(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar o cadastro da peça.");
  }

  const parsed = editarPecaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabase = await createClient();

  // ── A ficha, validada contra os campos DO TIPO ───────────────────────────
  // O caminho é longo — peça › item › tipo — porque a ficha é definida no tipo
  // e preenchida na peça. Sem esta leitura, a validação teria de confiar no que
  // veio do formulário, e o formulário pode ser contornado.
  const { data: dono } = await supabase
    .from("equipamento_unidade")
    .select("item:item_id(tipo:tipo_id(campos_ficha))")
    .eq("id", d.id)
    .maybeSingle();

  const item = (Array.isArray(dono?.item) ? dono?.item[0] : dono?.item) as
    | { tipo: { campos_ficha: unknown } | { campos_ficha: unknown }[] | null }
    | null;
  const tipo = (Array.isArray(item?.tipo) ? item?.tipo[0] : item?.tipo) as
    | { campos_ficha: unknown }
    | null;

  const definicao = camposFichaSchema.safeParse(tipo?.campos_ficha ?? []);
  // Definição com forma inválida (gravada por SQL) NÃO derruba o salvamento da
  // peça: ela passa a valer como ficha vazia, e o resto do cadastro é salvo.
  // Travar a edição do patrimônio por causa de um campo torto seria a troca
  // errada.
  if (!definicao.success) {
    console.error("editarPeca: campos_ficha inválido", definicao.error.issues[0]);
  }
  const conferida = validarFicha(
    definicao.success ? definicao.data : [],
    d.ficha,
  );
  if (!conferida.ok) return falha(conferida.erro);
  const { error } = await supabase
    .from("equipamento_unidade")
    .update({
      identificador: d.identificador,
      numero_serie: d.numero_serie,
      ano: d.ano,
      estado: d.estado,
      observacoes: d.observacoes,
      imei: d.imei,
      imei_2: d.imei_2,
      linha_telefonica: d.linha_telefonica,
      operadora: d.operadora,
      service_tag: d.service_tag,
      memoria_gb: d.memoria_gb,
      configuracao: d.configuracao,
      tem_medidor: d.tem_medidor,
      ficha: conferida.ficha,
    })
    .eq("id", d.id);

  if (error) {
    if (error.code === "23505") {
      // Três índices únicos podem colidir aqui, e dizer qual poupa a pessoa de
      // adivinhar entre patrimônio, IMEI e linha.
      const alvo = error.message.includes("imei")
        ? "IMEI"
        : error.message.includes("linha")
          ? "número de linha"
          : "patrimônio";
      return falha(`Já existe outra peça com esse ${alvo}.`);
    }
    console.error("editarPeca", error);
    return falha("Não foi possível salvar as alterações da peça.");
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${d.id}`);
  return { ok: true };
}

/**
 * Baixa, marca como perdida, ou traz de volta a disponível.
 *
 * Situação é condição da peça, não posse: baixar não muda quem está com ela.
 * Por isso esta action NÃO escreve no livro — e é o único caminho que muda
 * `situacao` sem custódia, o que a varredura precisa saber.
 */
export async function mudarSituacao(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode baixar uma peça.");
  }

  const id = String(formData.get("id") ?? "").trim();
  const paraBruto = String(formData.get("situacao") ?? "").trim();
  if (!id) return falha("Peça inválida.");
  if (!(SITUACOES as readonly string[]).includes(paraBruto)) {
    return falha("Situação inválida.");
  }
  const para = paraBruto as Situacao;

  const supabase = await createClient();
  const { data: peca, error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .select("situacao")
    .eq("id", id)
    .single();
  if (erroPeca || !peca) return falha("Peça não encontrada.");

  const de = (peca as unknown as { situacao: Situacao }).situacao;
  if (!podeTransicionar(de, para, "manual")) {
    return falha(motivoBloqueio(de, para) ?? "Mudança de situação não permitida.");
  }

  const { data: mudou, error } = await supabase
    .from("equipamento_unidade")
    .update({ situacao: para })
    .eq("id", id)
    // Mesmo motivo de `movimentarPeca`: 0 linhas atualizadas não é erro para o
    // PostgREST, e "baixei a peça" com a peça ainda disponível é mentira que a
    // tela repetiria sem nenhum sinal.
    .select("id");
  if (error || !mudou?.length) {
    console.error("mudarSituacao", error ?? "update atingiu 0 linhas");
    return falha(
      "A situação da peça não mudou — provavelmente falta de permissão para " +
        "alterar a peça. Avise um administrador.",
    );
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${id}`);
  return { ok: true };
}

/**
 * Amarra a peça a uma linha de contrato, ou registra o dono provisório.
 *
 * `unidade_id` mora em `item_locado`, não em `equipamento_unidade`: amarrar é
 * gravar a peça NA LINHA do contrato, e não o contrato na peça. Por isso a
 * action recebe `item_locado_id` e não `contrato_id` — quem escolhe a linha é a
 * leitura `listarContratosParaAmarrar`, que já aplicou as quatro condições de
 * elegibilidade.
 *
 * O PROVISÓRIO É LIMPO ao amarrar, e a mensagem diz se ele divergia. Mantê-lo
 * vivo ao lado do contrato criaria duas fontes sobre quem é o dono de um
 * equipamento; limpá-lo calado seria decidir por quem cadastrou.
 */
export async function amarrarPecaAoContrato(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar o cadastro da peça.");
  }

  const parsed = amarrarPecaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { peca_id, item_locado_id, fornecedor_provisorio_id } = parsed.data;

  const supabase = await createClient();

  // O provisório de ANTES, para poder nomeá-lo na mensagem ao removê-lo.
  const { data: antes } = await supabase
    .from("equipamento_unidade")
    .select("fornecedor_provisorio:fornecedor_provisorio_id(nome)")
    .eq("id", peca_id)
    .maybeSingle();
  const provisorioAntes =
    (antes as unknown as { fornecedor_provisorio: { nome: string } | null } | null)
      ?.fornecedor_provisorio?.nome ?? null;

  // ── Desamarrar: solta a linha que hoje aponta para esta peça ─────────────
  // Roda sempre, inclusive quando vai amarrar em outra linha: sem isto, trocar
  // de contrato deixaria a peça em DUAS linhas em aberto — exatamente o estado
  // `ambiguo` que `donoDaPeca` existe para denunciar.
  //
  // NÃO usa `erroDeEscrita` aqui de propósito: ele trata "zero linhas afetadas"
  // como falha — o que está certo para um update dirigido por `id`, e errado
  // aqui, onde zero é o caso NORMAL (peça que não estava amarrada a nada). Com
  // ele, a amarração falharia justamente na primeira vez de cada peça.
  const { error: erroSolta } = await supabase
    .from("item_locado")
    .update({ unidade_id: null })
    .eq("unidade_id", peca_id)
    .eq("status", "em_aberto");
  if (erroSolta) {
    console.error("amarrarPeca/soltar", erroSolta);
    return falha("Não foi possível soltar a peça do contrato atual.");
  }

  let mensagem: string | undefined;

  if (item_locado_id) {
    const erro = erroDeEscrita(
      await supabase
        .from("item_locado")
        .update({ unidade_id: peca_id })
        .eq("id", item_locado_id)
        // Corrida: a linha pode ter recebido outra peça entre a leitura do
        // formulário e este clique. Sem esta condição, a peça nova sobrescreve
        // a anterior em silêncio.
        .is("unidade_id", null)
        .select("id"),
      { registro: "item do contrato", contexto: "amarrarPeca", acao: "salvar" },
    );
    if (erro) {
      return falha(
        "Esta linha do contrato já recebeu outra peça. Recarregue a tela e escolha outra.",
      );
    }
    if (provisorioAntes) {
      mensagem = `Dono provisório "${provisorioAntes}" removido: agora quem manda é o contrato.`;
    }
  }

  // Amarrada a um contrato, o provisório não tem mais função. Sem contrato, ele
  // é o que o formulário mandou (podendo ser nulo, que é "não sei ainda").
  const erroProv = erroDeEscrita(
    await supabase
      .from("equipamento_unidade")
      .update({
        fornecedor_provisorio_id: item_locado_id ? null : fornecedor_provisorio_id,
      })
      .eq("id", peca_id)
      .select("id"),
    { registro: "peça", contexto: "amarrarPeca/provisorio", acao: "salvar" },
  );
  if (erroProv) return falha(erroProv);

  revalidatePath(`/frota/${peca_id}`);
  revalidatePath("/frota");
  return { ok: true, aviso: mensagem };
}

/**
 * O mutirão NÃO grava custódia. Ficou registrado aqui por que não.
 *
 * A primeira versão desta action chamava `abrirCustodia` com
 * `tipo: "funcionario"` e `origem: "manual"`. Typecheck, lint, 1255 testes e
 * build passaram — e as 88 confirmações falharam uma a uma em produção, porque
 * a recusa vive no `check` do Postgres:
 *
 *   custodia_funcionario_exige_termo (migration 0059)
 *   check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null))
 *
 * com o motivo escrito ao lado: "posse de funcionário só nasce por termo
 * assinado. No BANCO, e não só na tela: a tela pode estar velha, e o valor do
 * termo é justamente ser a única fonte de verdade sobre quem respondeu pelo
 * equipamento". `movimentarPeca` sempre respeitou isso — `custodia.ts` registra que
 * "funcionario NÃO está entre os destinos".
 *
 * A invariante está CERTA e o mutirão estava errado. Quem está com a peça se
 * registra emitindo o TERMO, que cria a posse por `moverPecasDoTermo` com
 * `origem: 'termo'`. `custodia-invariante.test.ts` impede a volta desta classe
 * de erro.
 */
