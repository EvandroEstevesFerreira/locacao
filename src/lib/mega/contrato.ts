import { z } from "zod";

/**
 * O que a rota `FaturaPagar/Saldo/Agente` do Mega devolve, achatado.
 *
 * Este arquivo NÃO é `server-only` de propósito: ele não tem segredo nenhum,
 * só forma de dado, e a tela do contrato precisa do tipo.
 *
 * A forma aqui foi medida numa resposta real de 5.372 parcelas, não lida na
 * documentação do ERP — que já errou uma vez sobre esta mesma rota (diz que o
 * agente vai como `1-516`; a rota recusa e quer o código cru).
 */

/**
 * `dd/MM/yyyy` para `yyyy-mm-dd`.
 *
 * O Mega manda data como texto no formato brasileiro. Passar isso para
 * `new Date()` é o caminho curto e errado: o JS lê `01/12/2024` como
 * 12 de janeiro, e um vencimento deslocado em onze meses não se denuncia
 * sozinho numa lista.
 */
export function dataMegaParaISO(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(bruto.trim());
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const iso = `${ano}-${mes}-${dia}`;
  // Data impossível (31/02) precisa ser RECUSADA, não normalizada: o Date
  // rolaria para 03/03 e o espelho passaria a mostrar um vencimento que não
  // existe em documento nenhum.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCDate() !== Number(dia) || d.getUTCMonth() + 1 !== Number(mes)) {
    return null;
  }
  return iso;
}

/** Texto que sobrou vazio é ausência, não string vazia. */
const texto = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  });

const dataObrigatoria = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    const iso = dataMegaParaISO(typeof v === "string" ? v : null);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Data inválida ou ausente." });
      return z.NEVER;
    }
    return iso;
  });

const dataOpcional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => dataMegaParaISO(typeof v === "string" ? v : null));

/**
 * O agente é um objeto aninhado, e `Codigo` é o número que a própria rota exige
 * de volta — o mesmo que o Loca guarda em `fornecedor.codigo_mega`.
 *
 * `Cnpj` e `Nome` vêm de brinde e valem ouro: é com eles que se confere se o
 * código digitado no Loca aponta mesmo para a empresa certa.
 */
const agenteSchema = z.object({
  Codigo: z.union([z.number(), z.string()]),
  Nome: texto,
  Cnpj: texto,
});

export const tituloMegaSchema = z
  .object({
    Agente: agenteSchema,
    Filial: z.union([z.object({ Id: z.union([z.number(), z.string(), z.null()]) }), z.null(), z.undefined()]),
    NumeroAP: z.union([z.number(), z.string()]),
    NumeroParcela: z.union([z.string(), z.number()]),
    TipoDocumento: texto,
    NumeroDocumento: texto,
    DataVencimento: dataObrigatoria,
    DataProrrogado: dataOpcional,
    ValorParcela: z.number(),
    SaldoAtual: z.number(),
  })
  .transform((r) => ({
    codigoAgente: String(r.Agente.Codigo),
    agenteNome: r.Agente.Nome,
    agenteCnpj: r.Agente.Cnpj,
    numeroAp: String(r.NumeroAP),
    numeroParcela: String(r.NumeroParcela),
    filial: r.Filial?.Id !== null && r.Filial?.Id !== undefined ? String(r.Filial.Id) : null,
    tipoDocumento: r.TipoDocumento,
    numeroDocumento: r.NumeroDocumento,
    dataVencimento: r.DataVencimento,
    dataProrrogado: r.DataProrrogado,
    valorParcela: r.ValorParcela,
    saldoAtual: r.SaldoAtual,
  }));

export type TituloMega = z.infer<typeof tituloMegaSchema>;

/**
 * Converte a resposta inteira, sobrevivendo às linhas estranhas.
 *
 * TOLERANTE DE PROPÓSITO. Um `parse` do array inteiro derrubaria 5.371 títulos
 * bons por causa de um registro fora do formato, e o espelho do dia se perderia
 * inteiro. Quem recusa fica contado, para a rodada poder reclamar no log em vez
 * de sumir em silêncio.
 */
export function parseTitulos(bruto: unknown): {
  titulos: TituloMega[];
  recusados: number;
} {
  if (!Array.isArray(bruto)) return { titulos: [], recusados: 0 };
  const titulos: TituloMega[] = [];
  let recusados = 0;
  for (const linha of bruto) {
    const r = tituloMegaSchema.safeParse(linha);
    if (r.success) titulos.push(r.data);
    else recusados += 1;
  }
  return { titulos, recusados };
}

/** `SaldoAtual` zerado é o que significa "pago". Não há outro sinal na rota. */
export function estaQuitado(t: Pick<TituloMega, "saldoAtual">): boolean {
  return t.saldoAtual === 0;
}

/**
 * O agente, como `/api/globalagente/Agente/{id}` devolve.
 *
 * ATENÇÃO ÀS CHAVES EM MINÚSCULA. Esta rota devolve `nome`/`cnpj`, enquanto a
 * de contas a pagar devolve `Nome`/`Cnpj`. É a mesma API, com duas convenções —
 * confiar na memória aqui rende um objeto de campos `undefined`.
 */
export const agenteMegaSchema = z
  .object({
    codigo: z.union([z.number(), z.string()]),
    nome: texto,
    nomeFantasia: texto,
    cnpj: texto,
  })
  .transform((a) => ({
    codigo: String(a.codigo),
    nome: a.nome ?? a.nomeFantasia,
    cnpj: a.cnpj,
    // SÓ CONFIE NO CNPJ QUANDO ELE PARECER UM CNPJ. Em agente de retenção
    // (ISS, INSS, COFINS) o Mega devolve o PRÓPRIO CÓDIGO com padding neste
    // campo — o guia do ERP avisa, e `"516            "` casaria com nada.
    documento: somenteDocumento(a.cnpj),
  }));

export type AgenteMega = z.infer<typeof agenteMegaSchema>;

/** Os dígitos, se o campo tiver cara de CPF ou CNPJ. Senão, nulo. */
export function somenteDocumento(bruto: string | null): string | null {
  if (!bruto) return null;
  const d = bruto.replace(/[^0-9A-Z]/gi, "").toUpperCase();
  return d.length === 11 || d.length === 14 ? d : null;
}
