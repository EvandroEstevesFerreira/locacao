import type { TituloMega } from "./contrato";
import { imovelDaConta, type PontoConsumo } from "./consumo";

/**
 * A decisão do que gravar no espelho, separada de quem grava.
 *
 * Puro de propósito: a regra da data de quitação é a única coisa aqui que o
 * Mega não nos dá pronta, e regra inventada por nós precisa de teste. Sem
 * Supabase neste arquivo, ela se testa em memória.
 */

/** A linha como vai para `mega_titulo`. */
export type LinhaEspelho = {
  org_id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  codigo_mega: string;
  agente_cnpj: string | null;
  agente_nome: string | null;
  numero_ap: string;
  numero_parcela: string;
  filial: string | null;
  tipo_documento: string;
  numero_documento: string;
  data_vencimento: string;
  data_prorrogado: string | null;
  valor_parcela: number;
  saldo_atual: number;
  quitacao_vista_em: string | null;
  sincronizado_em: string;
};

export type LinhaExistente = {
  chave: string;
  quitacao_vista_em: string | null;
};

/**
 * A identidade de um título, igual à do índice único do banco.
 *
 * LARGA PORQUE PRECISA SER. `AP + parcela` não é único no Mega: retenções
 * (ISS, INSS, IR) reaproveitam o número da AP com outro tipo de documento.
 * Chavear estreito faria uma linha sobrescrever a outra, e o total do
 * fornecedor sairia menor que o real — do jeito silencioso, que ninguém nota.
 */
export function chaveDoTitulo(
  t: Pick<
    TituloMega,
    | "codigoAgente"
    | "numeroAp"
    | "numeroParcela"
    | "tipoDocumento"
    | "numeroDocumento"
    | "dataVencimento"
    | "valorParcela"
  >,
): string {
  return [
    t.codigoAgente,
    t.numeroAp,
    t.numeroParcela,
    t.tipoDocumento ?? "",
    t.numeroDocumento ?? "",
    t.dataVencimento,
    t.valorParcela.toFixed(2),
  ].join("|");
}

export function linhasParaEspelho({
  orgId,
  titulos,
  existentes,
  fornecedorPorCodigo,
  imovelPorCodigo,
  pontos,
  hojeISO,
}: {
  orgId: string;
  titulos: TituloMega[];
  existentes: LinhaExistente[];
  /** `codigo_mega` → `fornecedor.id`, do cadastro do Loca. */
  fornecedorPorCodigo: Map<string, string>;
  /**
   * `codigo_mega` → os imóveis daquele locador.
   *
   * É UMA LISTA, e não um imóvel, porque imobiliária é o caso normal: desde
   * abril/2026 a EXPRESSO ENGENHARIA recebe o aluguel de vários imóveis do MPD
   * Contagem num agente só. Com um Map de código→imóvel, o último cadastrado
   * vencia e todos os títulos caíam nele, em silêncio.
   */
  imovelPorCodigo?: Map<string, string[]>;
  /**
   * Os pontos de consumo cadastrados (instalação/RGI por imóvel).
   *
   * Conta de luz e de água não tem locador: o agente é a concessionária, que
   * atende dezenas de imóveis. Quem diz de qual imóvel é a conta é a
   * INSTALAÇÃO, no campo Documento.
   */
  pontos?: PontoConsumo[];
  /** Sempre `hojeISOSaoPaulo()`: a Vercel roda em UTC. */
  hojeISO: string;
}): LinhaEspelho[] {
  const antes = new Map(existentes.map((e) => [e.chave, e.quitacao_vista_em]));
  const agora = new Date().toISOString();

  return titulos.map((t) => {
    const quitado = t.saldoAtual === 0;
    const jaVisto = antes.get(chaveDoTitulo(t)) ?? null;

    // A DATA MAIS HONESTA QUE DÁ PARA TER. O Mega não devolve data de
    // pagamento, então guardamos quando o Loca VIU o saldo zerar — e, uma vez
    // visto, não se mexe mais: reescrever a cada rodada faria a data virar
    // "ontem" para sempre. Se o título é estornado e volta a ter saldo, a data
    // some junto, porque o espelho segue o Mega e não a nossa memória.
    const quitacao = quitado ? (jaVisto ?? hojeISO) : null;

    // UM DONO SÓ, e o fornecedor ganha. O banco tem CHECK cobrando isso: se o
    // mesmo código estivesse nos dois cadastros, o título apareceria somado
    // duas vezes — uma no contrato de equipamento, outra no de imóvel.
    const fornecedorId = fornecedorPorCodigo.get(t.codigoAgente) ?? null;
    const imoveis = fornecedorId ? [] : (imovelPorCodigo?.get(t.codigoAgente) ?? []);
    // SÓ APONTA PARA O IMÓVEL QUANDO NÃO HÁ DÚVIDA. Com o locador pagando
    // vários, atribuir a um deles seria inventar um rateio que o Mega não
    // informa. A tela acha os títulos pelo `codigo_mega`, que fica sempre.
    // TRÊS CAMINHOS ATÉ O IMÓVEL, nesta ordem: o locador exclusivo, e depois a
    // instalação da conta de consumo. O segundo é o único que funciona para
    // CPFL e SABESP, cujo agente atende a casa toda.
    const imovelId =
      imoveis.length === 1
        ? imoveis[0]
        : fornecedorId
          ? null
          : (pontos && pontos.length > 0 ? imovelDaConta(t, pontos) : null);

    return {
      org_id: orgId,
      fornecedor_id: fornecedorId,
      imovel_id: imovelId,
      codigo_mega: t.codigoAgente,
      agente_cnpj: t.agenteCnpj,
      agente_nome: t.agenteNome,
      numero_ap: t.numeroAp,
      numero_parcela: t.numeroParcela,
      filial: t.filial,
      // A chave do banco usa estas duas colunas, e coluna anulável em índice
      // único deixa dois NULLs conviverem — duplicando o título a cada rodada.
      tipo_documento: t.tipoDocumento ?? "",
      numero_documento: t.numeroDocumento ?? "",
      data_vencimento: t.dataVencimento,
      data_prorrogado: t.dataProrrogado,
      valor_parcela: t.valorParcela,
      saldo_atual: t.saldoAtual,
      quitacao_vista_em: quitacao,
      sincronizado_em: agora,
    };
  });
}

/**
 * Uma linha por chave, ficando com a última.
 *
 * O upsert do PostgREST FALHA INTEIRO se o mesmo alvo aparecer duas vezes no
 * mesmo comando ("cannot affect row a second time") — e são duas janelas de
 * consulta por fornecedor. Elas não se sobrepõem, então em tese não repete; mas
 * o custo de garantir é um Map, e o custo de não garantir é a rodada do dia
 * inteiro morrer por causa de um título repetido.
 */
export function dedupPorChave(linhas: LinhaEspelho[]): LinhaEspelho[] {
  const porChave = new Map<string, LinhaEspelho>();
  for (const l of linhas) {
    porChave.set(
      chaveDoTitulo({
        codigoAgente: l.codigo_mega,
        numeroAp: l.numero_ap,
        numeroParcela: l.numero_parcela,
        tipoDocumento: l.tipo_documento,
        numeroDocumento: l.numero_documento,
        dataVencimento: l.data_vencimento,
        valorParcela: l.valor_parcela,
      }),
      l,
    );
  }
  return [...porChave.values()];
}

/** O resumo de uma rodada, para o log e para `mega_sync`. */
export type ResumoRodada = {
  fornecedoresLidos: number;
  titulosVistos: number;
  recusados: number;
  falhas: { codigo: string; motivo: string }[];
};
