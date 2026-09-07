import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import {
  estadoCertificado,
  GRAVIDADE,
  type EspecieCertificado,
  type EstadoCertificado,
} from "@/lib/certificado";

export { piorPorPeca } from "@/lib/certificado";

/** Uma exigência do tipo, com o certificado atual da peça (ou a falta dele). */
export type PendenciaCertificado = {
  especie: EspecieCertificado;
  periodicidadeMeses: number | null;
  certificadoId: string | null;
  venceEm: string | null;
  estado: EstadoCertificado;
};

/** Um certificado lançado, para o histórico. */
export type CertificadoDaPeca = {
  id: string;
  especie: EspecieCertificado;
  emitidoEm: string | null;
  venceEm: string;
  numero: string | null;
  responsavel: string | null;
  arquivoPath: string | null;
  observacoes: string | null;
  /** `false` quando existe outro mais novo da mesma espécie. */
  atual: boolean;
};

/**
 * As exigências do tipo desta peça, com o certificado atual de cada uma.
 *
 * Vem da view `certificado_pendencia`, que é quem faz o cruzamento — sem ela,
 * uma exigência que ninguém cumpriu nunca não teria linha em lugar nenhum, e o
 * caso perigoso seria o único invisível.
 *
 * Devolve na ordem da gravidade: ausente, vencido, próximo, em dia. Quem abre a
 * tela da peça precisa ver primeiro o que impede a máquina de operar.
 *
 * Erro devolve vazio e registra: é seção de listagem dentro de uma página que
 * tem mais o que mostrar, e derrubá-la inteira por causa dela seria pior.
 */
export async function listarPendenciasDaPeca(
  unidadeId: string,
  diasAviso = 30,
): Promise<PendenciaCertificado[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificado_pendencia")
    .select("especie, periodicidade_meses, certificado_id, vence_em")
    .eq("unidade_id", unidadeId);

  if (error) {
    console.error("listarPendenciasDaPeca", error);
    return [];
  }

  const hoje = hojeISOSaoPaulo();
  return (data ?? [])
    .map((p) => ({
      especie: p.especie as EspecieCertificado,
      periodicidadeMeses: p.periodicidade_meses ?? null,
      certificadoId: p.certificado_id ?? null,
      venceEm: p.vence_em ?? null,
      estado: estadoCertificado(p.vence_em ?? null, hoje, diasAviso),
    }))
    .sort(
      (a, b) =>
        GRAVIDADE[a.estado] - GRAVIDADE[b.estado] ||
        (a.venceEm ?? "").localeCompare(b.venceEm ?? ""),
    );
}

/**
 * Todos os certificados já lançados na peça, do mais novo para o mais velho.
 *
 * É o histórico, e ele é o motivo de a tabela não ter unicidade por
 * (peça, espécie): a inspeção de 2025 tem de continuar existindo depois que a
 * de 2026 for lançada, porque é dela que a fiscalização pergunta.
 *
 * `atual` é calculado aqui e não no banco: é o primeiro de cada espécie na
 * ordem de vencimento, e a mesma consulta já traz tudo ordenado.
 */
export async function listarCertificadosDaPeca(
  unidadeId: string,
): Promise<CertificadoDaPeca[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificado_equipamento")
    .select(
      "id, especie, emitido_em, vence_em, numero, responsavel, arquivo_path, observacoes",
    )
    .eq("unidade_id", unidadeId)
    .order("vence_em", { ascending: false });

  if (error) {
    console.error("listarCertificadosDaPeca", error);
    return [];
  }

  const vistos = new Set<string>();
  return (data ?? []).map((c) => {
    const atual = !vistos.has(c.especie);
    vistos.add(c.especie);
    return {
      id: c.id,
      especie: c.especie as EspecieCertificado,
      emitidoEm: c.emitido_em ?? null,
      venceEm: c.vence_em,
      numero: c.numero ?? null,
      responsavel: c.responsavel ?? null,
      arquivoPath: c.arquivo_path ?? null,
      observacoes: c.observacoes ?? null,
      atual,
    };
  });
}

/** Uma pendência do parque inteiro, para a lista da frota e o painel. */
export type PendenciaDoParque = {
  unidadeId: string;
  identificador: string;
  obraId: string | null;
  modelo: string;
  tipo: string;
  especie: EspecieCertificado;
  venceEm: string | null;
  estado: EstadoCertificado;
};

/**
 * As pendências de certificado de todo o parque.
 *
 * Serve à lista da frota (selo na linha) e ao filtro por estado. Traz TUDO,
 * inclusive o que está em dia: a tela precisa distinguir "peça sem pendência"
 * de "peça cujo tipo não exige nada", e a segunda simplesmente não aparece aqui.
 */
export async function listarPendenciasDoParque(
  diasAviso = 30,
): Promise<PendenciaDoParque[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificado_pendencia")
    .select("unidade_id, identificador, obra_id, modelo, tipo, especie, vence_em");

  if (error) {
    console.error("listarPendenciasDoParque", error);
    return [];
  }

  const hoje = hojeISOSaoPaulo();
  return (data ?? []).map((p) => ({
    unidadeId: p.unidade_id,
    identificador: p.identificador,
    obraId: p.obra_id ?? null,
    modelo: p.modelo,
    tipo: p.tipo,
    especie: p.especie as EspecieCertificado,
    venceEm: p.vence_em ?? null,
    estado: estadoCertificado(p.vence_em ?? null, hoje, diasAviso),
  }));
}
