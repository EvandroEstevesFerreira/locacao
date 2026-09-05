// Termo de devolução de equipamento — o documento que fecha a saída.
//
// Sai dos primitivos de `pdf-form.tsx`, sem componente novo: mesma moldura do
// romaneio de recebimento e dos documentos do alojamento.
//
// É gerado no FECHAMENTO e vai anexo ao e-mail do fornecedor. Ele é a prova de
// que o equipamento voltou — a peça que faltava quando o fornecedor cobra
// diária de coisa que já está no pátio dele.

import {
  Documento,
  Secao,
  CampoGrid,
  Tabela,
  Assinaturas,
  AreaTexto,
  type Campo,
} from "@/lib/pdf-form";
import { Paragrafo } from "./blocos";

export type ItemTermoDevolucao = {
  descricao: string;
  patrimonio: string | null;
  quantidade: number;
  condicao: string;
  observacoes: string | null;
};

export type DadosTermoDevolucao = {
  numero: string;
  orgNome: string;
  fornecedor: string;
  obra: string;
  contratoNumero: string | null;
  contratoRegistro: string | null;
  devolvidoEm: string;
  responsavel: string | null;
  notaFornecedor: string | null;
  observacoes: string | null;
  itens: ItemTermoDevolucao[];
  localData: string;
};

// Não reaproveita o mapa do romaneio: os conjuntos são diferentes de propósito
// (lá existe "divergência", aqui existe "faltante"), e um mapa compartilhado
// convidaria a fundir os dois enums — que é justamente o que não deve
// acontecer. Ver `CONDICOES_DEVOLUCAO` em `src/lib/devolucao.ts`.
const CONDICAO_PT: Record<string, string> = {
  ok: "Conforme",
  avaria: "Com avaria",
  faltante: "Não devolvido",
};

function identificacao(d: DadosTermoDevolucao): Campo[] {
  return [
    { label: "Fornecedor", valor: d.fornecedor },
    { label: "Obra", valor: d.obra },
    {
      label: "Contrato",
      // Os DOIS números do contrato, quando existem: o nosso identifica o
      // registro, o deles é o que o fornecedor tem no próprio sistema.
      valor: [d.contratoRegistro, d.contratoNumero].filter(Boolean).join(" · ") || null,
    },
    { label: "Nota / contra-nota do fornecedor", valor: d.notaFornecedor },
    { label: "Data da devolução", valor: d.devolvidoEm },
    { label: "Entregue por", valor: d.responsavel },
  ];
}

export function TermoDevolucao({ dados }: { dados: DadosTermoDevolucao }) {
  const comRessalva = dados.itens.filter((i) => i.condicao !== "ok");

  return (
    <Documento
      codigo={dados.numero}
      titulo="Termo de devolução de equipamento"
      subtitulo={`${dados.orgNome} — conferência na retirada`}
      rodape={`${dados.orgNome} — controle de locações`}
    >
      <Secao n={1} titulo="Identificação" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={2} titulo="Itens devolvidos">
        <Tabela
          colunas={[
            { titulo: "Item", largura: 44 },
            { titulo: "Patrimônio / série", largura: 20 },
            { titulo: "Qtd.", largura: 8, alinhar: "center" },
            { titulo: "Condição", largura: 14 },
            { titulo: "Observações", largura: 14 },
          ]}
          linhas={dados.itens.map((i) => ({
            celulas: [
              i.descricao,
              i.patrimonio ?? "—",
              String(i.quantidade),
              CONDICAO_PT[i.condicao] ?? i.condicao,
              i.observacoes ?? "—",
            ],
          }))}
          densa
        />
      </Secao>

      {/* A ressalva vem DEPOIS da tabela e em seção própria: no papel, quem
          assina precisa ver o que está sendo ressalvado sem procurar linha a
          linha numa tabela de trinta itens. E aqui ela vale dinheiro — é sobre
          este texto que a cobrança de reposição vai ser discutida. */}
      {comRessalva.length > 0 ? (
        <Secao n={3} titulo="Ressalvas da devolução" quebrar={false}>
          {comRessalva.map((i, n) => (
            <Paragrafo
              key={n}
              texto={`${i.descricao}${i.patrimonio ? ` (${i.patrimonio})` : ""} — ${
                CONDICAO_PT[i.condicao] ?? i.condicao
              }: ${i.observacoes ?? "sem descrição"}`}
            />
          ))}
        </Secao>
      ) : null}

      <Secao titulo="Observações" quebrar={false}>
        {dados.observacoes ? (
          <Paragrafo texto={dados.observacoes} />
        ) : (
          <AreaTexto linhas={2} />
        )}
      </Secao>

      <Assinaturas
        localData={dados.localData}
        assinantes={[
          { papel: "Entregue por — obra", nome: dados.responsavel ?? undefined },
          { papel: `Recebido por — ${dados.fornecedor}` },
        ]}
      />
    </Documento>
  );
}
