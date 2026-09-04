// Romaneio de recebimento — o documento que fecha a entrada do equipamento.
//
// Sai dos primitivos de `pdf-form.tsx`, sem componente novo: mesma moldura dos
// seis documentos do alojamento, mesma numeração de página, mesmo cabeçalho.
//
// É gerado no FECHAMENTO e vai anexo ao e-mail do fornecedor. Por isso o número
// do registro aparece em destaque no cabeçalho: é por ele que a obra e o
// fornecedor vão se referir a esta entrega daqui em diante.

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

export type ItemRomaneio = {
  descricao: string;
  patrimonio: string | null;
  quantidade: number;
  condicao: string;
  observacoes: string | null;
};

export type DadosRomaneio = {
  numero: string;
  orgNome: string;
  fornecedor: string;
  obra: string;
  contratoNumero: string | null;
  contratoRegistro: string | null;
  recebidoEm: string;
  conferente: string | null;
  notaFornecedor: string | null;
  observacoes: string | null;
  itens: ItemRomaneio[];
  localData: string;
};

const CONDICAO_PT: Record<string, string> = {
  ok: "Conforme",
  avaria: "Com avaria",
  divergencia: "Divergência",
};

function identificacao(d: DadosRomaneio): Campo[] {
  return [
    { label: "Fornecedor", valor: d.fornecedor },
    { label: "Obra", valor: d.obra },
    {
      label: "Contrato",
      // Os DOIS números do contrato, quando existem: o nosso identifica o
      // registro, o deles é o que o fornecedor tem no próprio sistema.
      valor: [d.contratoRegistro, d.contratoNumero].filter(Boolean).join(" · ") || null,
    },
    { label: "Nota / romaneio do fornecedor", valor: d.notaFornecedor },
    { label: "Data do recebimento", valor: d.recebidoEm },
    { label: "Conferido por", valor: d.conferente },
  ];
}

export function Romaneio({ dados }: { dados: DadosRomaneio }) {
  const comRessalva = dados.itens.filter((i) => i.condicao !== "ok");

  return (
    <Documento
      codigo={dados.numero}
      titulo="Romaneio de recebimento de equipamento"
      subtitulo={`${dados.orgNome} — conferência na entrega`}
      rodape={`${dados.orgNome} — controle de locações`}
    >
      <Secao n={1} titulo="Identificação" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={2} titulo="Itens recebidos">
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
          linha numa tabela de trinta itens. */}
      {comRessalva.length > 0 ? (
        <Secao n={3} titulo="Ressalvas da conferência" quebrar={false}>
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
          { papel: "Conferente — obra", nome: dados.conferente ?? undefined },
          { papel: `Entregador — ${dados.fornecedor}` },
        ]}
      />
    </Documento>
  );
}
