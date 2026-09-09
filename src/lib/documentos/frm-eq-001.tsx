// FRM-EQ-001 — Termo de Responsabilidade por Uso de Equipamento.
//
// ESTRUTURA aqui; TEXTO das cláusulas em `documento_template`, tipo
// `termo_equipamento`, editável em Configurações. Mesma divisão do FRM-RH-001:
// revisar cláusula é assunto do Jurídico, e não pode exigir deploy.
//
// FICHA OPERACIONAL, não recibo. A devolução é COLUNA na tabela de itens, e não
// um segundo documento: quem confere a volta precisa ver, na mesma linha, em
// que estado a peça saiu e em que estado voltou. Dois papéis obrigariam a
// comparar duas folhas, que é onde a divergência se perde.

import { View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  WARNING_BORDA,
  WARNING_FUNDO,
  WARNING_TEXTO,
} from "@/lib/brand-colors";
import { Narrativa } from "./blocos";
import {
  Documento,
  Secao,
  CampoGrid,
  Tabela,
  Assinaturas,
  type Campo,
  type Coluna,
  type LinhaTabela,
  type Assinante,
} from "@/lib/pdf-form";

const COLUNAS_ITENS: Coluna[] = [
  { titulo: "Item", largura: 30 },
  { titulo: "Patrimônio", largura: 15 },
  { titulo: "Qtd.", largura: 8 },
  { titulo: "Estado na entrega", largura: 16 },
  { titulo: "Devolvido em", largura: 15 },
  { titulo: "Estado na devolução", largura: 16 },
];

export type ItemTermoDoc = {
  descricao: string;
  patrimonio?: string | null;
  quantidade: string;
  estadoEntrega: string;
  dataDevolucao?: string | null;
  estadoDevolucao?: string | null;
};

const { tarja, tarjaTexto } = StyleSheet.create({
  tarja: {
    borderLeft: `3 solid ${WARNING_BORDA}`,
    backgroundColor: WARNING_FUNDO,
    padding: 8,
    marginBottom: 10,
  },
  tarjaTexto: { fontSize: 9, color: WARNING_TEXTO },
});

export function TermoEquipamento({
  orgNome,
  numero,
  campos,
  itens,
  paragrafos,
  localData,
  assinantes,
  versao,
  publicadoEm,
  assinaturaPendente = false,
}: {
  orgNome: string;
  /** `TRM-2026-0001`. Ausente enquanto for rascunho. */
  numero?: string | null;
  campos: Campo[];
  itens: ItemTermoDoc[];
  paragrafos: string[];
  localData: string;
  assinantes: Assinante[];
  versao?: string;
  publicadoEm?: string;
  /**
   * Termo EMITIDO em que falta a assinatura do funcionário.
   *
   * Vale só para emitido: o rascunho sai em branco de propósito, para colher
   * assinatura à caneta, e a tarja ali seria ruído sobre um documento que
   * ninguém disse que valia.
   *
   * Um termo de responsabilidade sem assinatura que não se anuncia como tal é um
   * papel que parece valer e não vale — mesma regra que fez o painel de
   * fechamento do recebimento parar de mentir na 0.90.3.
   */
  assinaturaPendente?: boolean;
}) {
  const linhas: LinhaTabela[] = itens.map((i) => ({
    celulas: [
      i.descricao,
      i.patrimonio ?? "—",
      i.quantidade,
      i.estadoEntrega,
      // Travessão, e não vazio: célula em branco num documento assinado parece
      // esquecimento, e quem confere não sabe se ninguém preencheu ou se o
      // item não voltou.
      i.dataDevolucao ?? "—",
      i.estadoDevolucao ?? "—",
    ],
  }));

  return (
    <Documento
      codigo="FRM-EQ-001"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo="Termo de Responsabilidade por Uso de Equipamento"
      subtitulo={numero ? `${orgNome} — ${numero}` : `${orgNome} — rascunho`}
    >
      {assinaturaPendente ? (
        <View style={tarja}>
          <Text style={tarjaTexto}>
            PENDENTE DE ASSINATURA DO FUNCIONÁRIO — este termo foi emitido e o
            equipamento está sob responsabilidade do funcionário, mas a
            assinatura dele ainda não foi colhida.
          </Text>
        </View>
      ) : null}

      <Secao n={1} titulo="Identificação">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      {/* quebrar={false}: sem isso o cabeçalho da tabela fica órfão no pé de
          uma página e as linhas caem na seguinte. */}
      <Secao n={2} titulo="Equipamento entregue" quebrar={false}>
        <Tabela colunas={COLUNAS_ITENS} linhas={linhas} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Declaração" />

      {/* `modo="imagem"` imprime o traço desenhado na tela. Antes da 0.49.0 o
          primitivo só sabia desenhar linha em branco, e quem assinava no
          celular assinava no vazio. */}
      <Assinaturas modo="imagem" assinantes={assinantes} localData={localData} />
    </Documento>
  );
}
