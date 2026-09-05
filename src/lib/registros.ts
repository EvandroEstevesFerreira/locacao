// Numeração de registros — o lado da aplicação.
//
// O número é atribuído por TRIGGER no banco (migration 0048), não aqui. São
// onze tabelas escritas por dezenas de actions, e bastaria uma esquecida para
// nascer registro sem número — que é justamente o defeito que a numeração
// existe para impedir. Este arquivo só sabe LER e EXIBIR.
//
// Client-safe: sem `server-only`, porque os rótulos aparecem em componentes de
// cliente (listagens filtráveis, badges) tanto quanto em PDF.

/**
 * Prefixo por tipo de registro. ESPELHA `public.prefixo_registro()` da
 * migration 0048 — mudar aqui sem mudar lá faz a tela chamar de CTR o que o
 * banco gravou como outra coisa.
 */
export const PREFIXO_REGISTRO = {
  contrato_locacao: "CTR",
  contrato_imovel: "CTI",
  recebimento: "REC",
  devolucao: "DEV",
  vistoria: "VIS",
  vistoria_imovel: "VIM",
  avaria: "AVA",
  reparo_imovel: "REP",
  medida_disciplinar: "MED",
  entrega_ocupante: "ENT",
  checklist_limpeza: "LIM",
  ocorrencia_imovel: "OCO",
  termo_equipamento: "TRM",
  treinamento_conclusao: "TRE",
} as const;

export type TipoRegistro = keyof typeof PREFIXO_REGISTRO;

/** Como cada tipo é chamado na tela. */
export const ROTULO_REGISTRO: Record<TipoRegistro, string> = {
  contrato_locacao: "Contrato de equipamento",
  contrato_imovel: "Contrato de imóvel",
  recebimento: "Recebimento",
  devolucao: "Devolução",
  vistoria: "Vistoria",
  vistoria_imovel: "Vistoria de imóvel",
  avaria: "Avaria",
  reparo_imovel: "Reparo",
  medida_disciplinar: "Medida disciplinar",
  entrega_ocupante: "Entrega ao alojado",
  checklist_limpeza: "Folha de limpeza",
  ocorrencia_imovel: "Ocorrência",
  termo_equipamento: "Termo de responsabilidade",
  treinamento_conclusao: "Comprovante de treinamento",
};

/** `CTR-2026-0007` → `{ tipo: "CTR", ano: 2026, sequencial: 7 }`. */
export type NumeroPartes = { prefixo: string; ano: number; sequencial: number };

const FORMATO = /^([A-Z]{3})-(\d{4})-(\d{4,})$/;

/**
 * Decompõe um número de registro. Devolve `null` para qualquer coisa fora do
 * formato — inclusive `null` e string vazia, que é o estado de um registro
 * ainda não numerado (rascunho de recebimento, na fase 1).
 */
export function partesDoNumero(numero: string | null | undefined): NumeroPartes | null {
  if (!numero) return null;
  const m = FORMATO.exec(numero.trim().toUpperCase());
  if (!m) return null;
  return { prefixo: m[1], ano: Number(m[2]), sequencial: Number(m[3]) };
}

/**
 * O número como aparece na tela. Registro sem número mostra um travessão, e não
 * string vazia: célula vazia numa tabela parece falha de carregamento.
 */
export function formatarNumero(numero: string | null | undefined): string {
  return numero?.trim() || "—";
}

/**
 * Aceita a forma completa e a abreviada que a pessoa digita na busca.
 *
 * Ninguém digita `AVA-2026-0009` inteiro para procurar: digita `9`, `0009` ou
 * `AVA-2026-9`. Normalizar aqui é o que faz a busca encontrar — sem isso, o
 * `ilike` só casaria com quem digitasse os quatro dígitos com os zeros.
 */
export function normalizarBuscaNumero(termo: string): string {
  const t = termo.trim().toUpperCase();
  const m = /^([A-Z]{3})-(\d{4})-(\d+)$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3].padStart(4, "0")}`;
  // Só dígitos: vira o sufixo com zeros à esquerda, para casar em `%-0009`.
  if (/^\d{1,4}$/.test(t)) return t.padStart(4, "0");
  return t;
}
