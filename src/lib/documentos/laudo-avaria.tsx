// Laudo de avaria — o documento que sustenta a cobrança.
//
// Sai dos primitivos de `pdf-form.tsx`, na mesma moldura do romaneio e do termo
// de devolução.
//
// A DIFERENÇA DELE PARA OS OUTROS DOIS: romaneio e termo registram um FATO
// (chegou, voltou). O laudo registra uma APURAÇÃO, e ela pode estar inconclusa.
// Por isso ele imprime "A apurar" com todas as letras quando a responsabilidade
// ainda não foi definida, em vez de omitir o campo: um laudo que não diz quem
// responde, sem dizer que não sabe, é lido como se soubesse.

import {
  Documento,
  Secao,
  CampoGrid,
  Assinaturas,
  AreaTexto,
  type Campo,
} from "@/lib/pdf-form";
import { Paragrafo } from "./blocos";

export type DadosLaudoAvaria = {
  numero: string;
  orgNome: string;
  fornecedor: string | null;
  obra: string;
  contratoNumero: string | null;
  contratoRegistro: string | null;
  /** Data em que a avaria foi constatada. */
  data: string;
  descricao: string;
  laudo: string | null;
  /** Rótulo já em português: "A apurar", "Do fornecedor"… */
  responsabilidade: string;
  /** Rótulo já em português: "Aberta", "Cobrada", "Resolvida". */
  status: string;
  custoEstimado: string;
  peca: string | null;
  /** Número da devolução em que foi constatada, quando foi. */
  devolucao: string | null;
  localData: string;
};

function identificacao(d: DadosLaudoAvaria): Campo[] {
  return [
    { label: "Obra", valor: d.obra },
    { label: "Fornecedor", valor: d.fornecedor },
    {
      label: "Contrato",
      // Os DOIS números do contrato, quando existem: o nosso identifica o
      // registro, o deles é o que o fornecedor tem no próprio sistema.
      valor: [d.contratoRegistro, d.contratoNumero].filter(Boolean).join(" · ") || null,
    },
    { label: "Peça / patrimônio", valor: d.peca },
    { label: "Constatada em", valor: d.data },
    {
      label: "Constatada na devolução",
      // Nulo quando a avaria foi vista EM USO. Distinguir importa: dano
      // constatado na devolução é discussão com o fornecedor; dano constatado
      // em uso é problema da obra até que se prove o contrário.
      valor: d.devolucao,
    },
  ];
}

export function LaudoAvaria({ dados }: { dados: DadosLaudoAvaria }) {
  return (
    <Documento
      codigo={dados.numero}
      titulo="Laudo de avaria de equipamento"
      subtitulo={`${dados.orgNome} — apuração de dano`}
      rodape={`${dados.orgNome} — controle de locações`}
    >
      <Secao n={1} titulo="Identificação" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={2} titulo="Dano constatado" quebrar={false}>
        <Paragrafo texto={dados.descricao} />
      </Secao>

      <Secao n={3} titulo="Apuração" quebrar={false}>
        {dados.laudo ? (
          <Paragrafo texto={dados.laudo} />
        ) : (
          // Um laudo sem apuração escrita ainda é um documento válido — ele
          // registra o dano e a data. A área em branco existe para a apuração
          // ser escrita à mão em campo, que é como ela costuma nascer.
          <AreaTexto linhas={6} />
        )}
      </Secao>

      <Secao n={4} titulo="Conclusão" quebrar={false}>
        <CampoGrid
          colunas={2}
          campos={[
            { label: "Responsabilidade", valor: dados.responsabilidade },
            { label: "Situação", valor: dados.status },
            { label: "Custo estimado", valor: dados.custoEstimado },
          ]}
        />
      </Secao>

      <Assinaturas
        localData={dados.localData}
        assinantes={[
          { papel: "Responsável pela apuração — obra" },
          { papel: "Ciência — gestão de equipamentos" },
        ]}
      />
    </Documento>
  );
}
