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
import { movimentarPecaSchema, editarPecaSchema } from "@/lib/custodia";
import { abrirCustodia } from "@/lib/custodia-servidor";
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
 * destino `funcionario` esta action só desamarra o que estava amarrado e
 * devolve `{ ok: true }`; quem navega para `/termos/novo` é o cliente.
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

  // ── 1. SAIR DA PESSOA VEM ANTES DE QUALQUER OUTRA COISA ──────────────────
  // Se a devolução falhar, a posse NÃO se move: peça no almoxarifado com termo
  // aberto dizendo que está com alguém é pior que a movimentação que não
  // aconteceu — a primeira mente, a segunda só não fez nada.
  const saiDePessoa = posseAtual?.tipo === "funcionario";
  if (saiDePessoa) {
    const devolveu = await devolverDaPessoa(supabase, {
      unidadeId: d.unidade_id,
      termoId: posseAtual.termo_id,
      data: d.data,
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
    if (!devolveu.ok) return devolveu;
  }

  // ── 2. A MATRIZ, só para o que continua sendo escolha humana ─────────────
  // `baixada` e `perdida` não se deduzem e continuam passando pela matriz de
  // `frota.ts`. A recusa de mexer em peça `em_uso` existia porque esta action
  // não sabia encerrar termo; agora sabe, então o `de` é a situação DEPOIS da
  // devolução.
  const manual = d.situacao_final === "baixada" || d.situacao_final === "perdida";
  const de: Situacao = saiDePessoa
    ? "disponivel"
    : (peca as unknown as { situacao: Situacao }).situacao;
  if (manual && !podeTransicionar(de, d.situacao_final as Situacao, "manual")) {
    return falha(
      motivoBloqueio(de, d.situacao_final as Situacao) ??
        "Esta peça não pode ser movimentada na situação atual.",
    );
  }

  // ── 3. A POSSE NOVA ──────────────────────────────────────────────────────
  // Com destino `funcionario` NÃO se abre posse nenhuma, e isto é escolha: a
  // posse de destino nasce na emissão do termo, e `podeReceberTermo` recusa
  // peça COM posse aberta. Abrir uma de almoxarifado aqui deixaria a peça fora
  // da lista de `/termos/novo` — a porta única terminaria num beco sem saída.
  //
  // Quando a peça vinha de uma pessoa, a posse de almoxarifado já nasceu na
  // devolução (`liberarPecas`), e repeti-la criaria uma segunda linha no mesmo
  // dia sem nada de novo a dizer.
  const posseFinal: PosseAberta = d.tipo === "funcionario" ? null : d.tipo;
  if (d.tipo !== "funcionario") {
    const r = await abrirCustodia(supabase, {
      orgId: perfil.org_id,
      unidadeId: d.unidade_id,
      tipo: d.tipo,
      obraId: d.tipo === "obra" ? d.obra_id : null,
      fornecedorId: d.tipo === "fornecedor" ? d.fornecedor_id : null,
      inicio: d.data,
      origem: "manual",
      observacoes: d.observacoes,
    });
    if (!r.ok) return falha(r.erro);
  }

  // ── 4. A SITUAÇÃO, DEDUZIDA da posse que ficou aberta ────────────────────
  // Salvo quando a pessoa disse `baixada` ou `perdida`, que a posse não tem
  // como saber: uma peça baixada pode estar em qualquer canto, e uma perdida
  // não está em canto que se saiba.
  const destinoSituacao: Situacao = manual
    ? (d.situacao_final as Situacao)
    : situacaoDaPosse(
        // Sem posse nova e vindo de pessoa, quem manda é o almoxarifado onde a
        // devolução deixou a peça.
        posseFinal ?? (saiDePessoa ? "almoxarifado" : null),
      );

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
    return falha(
      "A posse foi registrada, mas a situação da peça não mudou no cadastro — " +
        "provavelmente falta de permissão para alterar a peça. Avise um administrador.",
    );
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${d.unidade_id}`);
  revalidatePath("/termos");
  return { ok: true, id: d.unidade_id };
}

/**
 * A metade da devolução, quando a peça está saindo de uma pessoa.
 *
 * Não reimplementa nada: chama `registrarDevolucao` e `encerrarTermo`, as
 * mesmas que `devolverParaTransferir` usa. Continuam sendo DOIS documentos —
 * este encerra o de quem entrega, e o de quem recebe é a emissão normal.
 */
async function devolverDaPessoa(
  // O cliente vem de quem chama: a action já criou um, e dois clientes na
  // mesma requisição gastam duas resoluções de sessão.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  e: {
    unidadeId: string;
    termoId: string | null;
    data: string;
    estado: string | null;
    observacoes: string | null;
    assinante: string;
    assinatura: string | null;
    motivoSemAssinatura: string | null;
    empresa: string;
  },
): Promise<ActionResult> {
  if (!e.termoId) {
    return falha(
      "Esta peça consta com uma pessoa, mas sem termo aberto. Regularize a custódia antes de movimentá-la.",
    );
  }
  // O estado é exigido AQUI e não no schema: só neste caminho ele existe, e um
  // campo obrigatório no schema pediria estado de conservação a quem só está
  // mandando a betoneira para a obra.
  if (!e.estado) {
    return falha("Informe o estado de conservação da peça na devolução.");
  }
  const estado = e.estado;

  const { data: itens, error: erroItens } = await supabase
    .from("termo_equipamento_item")
    .select("id")
    .eq("termo_id", e.termoId)
    .eq("unidade_id", e.unidadeId)
    .is("data_devolucao", null);

  if (erroItens) return falha("Não consegui ler os itens do termo.");
  if (!itens?.length) return falha("Esta peça já consta devolvida neste termo.");

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
  );
  if (!rDev.ok) return rDev;

  // O motivo sem assinatura entra porque 211 pessoas da base estão desligadas,
  // e uma que saiu com um notebook não volta para assinar. Exigir a assinatura
  // ali não protegeria ninguém — só impediria o registro da verdade.
  return encerrarTermo(
    e.termoId,
    {
      funcionario: { nome: e.assinante, cpf: null, imagem: e.assinatura },
      empresa: { nome: e.empresa, imagem: null },
    },
    e.motivoSemAssinatura,
  );
}

/**
 * Edita a peça — e NÃO move.
 *
 * Sem `obra_id` e sem `situacao`, de propósito: os dois mudam só por
 * `moverPeca` e `mudarSituacao`, que passam pelo livro. Um formulário de
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
    // Mesmo motivo de `moverPeca`: 0 linhas atualizadas não é erro para o
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
 * equipamento". `moverPeca` sempre respeitou isso — `custodia.ts` registra que
 * "funcionario NÃO está entre os destinos".
 *
 * A invariante está CERTA e o mutirão estava errado. Quem está com a peça se
 * registra emitindo o TERMO, que cria a posse por `moverPecasDoTermo` com
 * `origem: 'termo'`. `custodia-invariante.test.ts` impede a volta desta classe
 * de erro.
 */
