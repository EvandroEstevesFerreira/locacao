"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { camposFichaSchema, validarFicha } from "@/lib/catalogo";
import { moverPecaSchema, editarPecaSchema } from "@/lib/custodia";
import { abrirCustodia } from "@/lib/custodia-servidor";
import {
  podeTransicionar,
  motivoBloqueio,
  SITUACOES,
  type Situacao,
} from "@/lib/frota";

/**
 * Move a peça entre almoxarifado, obra e fornecedor em manutenção.
 *
 * Esta action é o ato que NÃO EXISTIA: `adicionarUnidade` gravava situação e
 * obra no cadastro e nenhum caminho humano os alterava depois. O "Onde está"
 * da tela de Frota era um valor digitado uma vez e nunca mais atualizado.
 *
 * `funcionario` não é destino possível — o schema não o aceita. Entregar a
 * pessoa é `/termos/novo`, com assinatura.
 */
export async function moverPeca(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para movimentar peças.");
  }

  const parsed = moverPecaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabase = await createClient();

  const { data: peca, error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .select("id, situacao")
    .eq("id", d.unidade_id)
    .single();
  if (erroPeca || !peca) return falha("Peça não encontrada.");

  const de = (peca as unknown as { situacao: Situacao }).situacao;

  // Peça em uso não se move pela Frota: alguém assinou por ela. A matriz de
  // `frota.ts` é a fonte única dessa regra, e a devolução do termo é o
  // caminho.
  const destinoSituacao: Situacao = d.tipo === "fornecedor" ? "manutencao" : "disponivel";
  if (!podeTransicionar(de, destinoSituacao, "manual")) {
    return falha(
      motivoBloqueio(de, destinoSituacao) ??
        "Esta peça não pode ser movimentada na situação atual.",
    );
  }

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

  const { data: mudou, error } = await supabase
    .from("equipamento_unidade")
    .update({ situacao: destinoSituacao })
    .eq("id", d.unidade_id)
    // `.select("id")` porque UPDATE de ZERO linhas não é erro para o PostgREST:
    // uma policy de RLS que filtra a linha devolve `error: null` e nada mudado,
    // e sem isto a action diria "movido" com a peça parada.
    .select("id");
  if (error || !mudou?.length) {
    console.error("moverPeca/situacao", error ?? "update atingiu 0 linhas");
    return falha(
      "A posse foi registrada, mas a situação da peça não mudou no cadastro — " +
        "provavelmente falta de permissão para alterar a peça. Avise um administrador.",
    );
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${d.unidade_id}`);
  return { ok: true };
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
      tem_horimetro: d.tem_horimetro,
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
