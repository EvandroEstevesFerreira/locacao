// Ordem de reparo — o documento que autoriza a peça a sair da obra.
//
// Sai dos primitivos de `pdf-form.tsx`, na mesma moldura do romaneio, do termo
// de devolução e do laudo.
//
// O QUE ELE TEM E OS OUTROS NÃO: um bloco de RECEBIMENTO NA OFICINA, com
// assinatura de quem pegou a peça. Ele é o único destes documentos que viaja
// JUNTO com o equipamento — sai da obra na mão de quem leva a máquina, e a
// assinatura de quem recebe é a única prova de onde ela foi parar.

import {
  Documento,
  Secao,
  CampoGrid,
  Assinaturas,
  AreaTexto,
  type Campo,
} from "@/lib/pdf-form";
import { Paragrafo } from "./blocos";

export type DadosOrdemReparo = {
  numero: string;
  orgNome: string;
  /** Identificador de patrimônio da peça. */
  peca: string;
  /** Descrição do item de catálogo. */
  item: string;
  descricao: string;
  executor: string | null;
  /** Rótulos já em português. */
  status: string;
  responsabilidade: string;
  abertoEm: string;
  enviadoEm: string | null;
  previstoPara: string | null;
  concluidoEm: string | null;
  valor: string;
  garantia: string | null;
  observacoes: string | null;
  /** Número da avaria que originou, quando houve. */
  avaria: string | null;
  localData: string;
};

function identificacao(d: DadosOrdemReparo): Campo[] {
  return [
    { label: "Peça / patrimônio", valor: d.peca },
    { label: "Equipamento", valor: d.item },
    { label: "Oficina / executor", valor: d.executor },
    {
      label: "Avaria de origem",
      // Nulo quando é manutenção PREVENTIVA. A distinção importa no papel: um
      // reparo que vem de dano tem responsável a apurar; uma revisão de rotina
      // é custo previsto da operação.
      valor: d.avaria,
    },
    { label: "Situação", valor: d.status },
    { label: "Quem paga", valor: d.responsabilidade },
  ];
}

function datas(d: DadosOrdemReparo): Campo[] {
  return [
    { label: "Aberta em", valor: d.abertoEm },
    { label: "Saída da obra", valor: d.enviadoEm },
    { label: "Previsão de retorno", valor: d.previstoPara },
    { label: "Concluída em", valor: d.concluidoEm },
  ];
}

export function OrdemReparo({ dados }: { dados: DadosOrdemReparo }) {
  return (
    <Documento
      codigo={dados.numero}
      titulo="Ordem de reparo de equipamento"
      subtitulo={`${dados.orgNome} — autorização de saída e serviço`}
      rodape={`${dados.orgNome} — controle de locações`}
    >
      <Secao n={1} titulo="Identificação" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={2} titulo="Serviço a executar" quebrar={false}>
        <Paragrafo texto={dados.descricao} />
      </Secao>

      <Secao n={3} titulo="Prazos" quebrar={false}>
        <CampoGrid colunas={2} campos={datas(dados)} />
      </Secao>

      <Secao n={4} titulo="Custo e garantia" quebrar={false}>
        <CampoGrid
          colunas={2}
          campos={[
            { label: "Valor do serviço", valor: dados.valor },
            // Nulo quando a oficina não declarou garantia. Imprimir o campo
            // vazio é melhor do que omiti-lo: a lacuna no papel é o que faz
            // alguém perguntar antes de assinar.
            { label: "Garantia", valor: dados.garantia },
          ]}
        />
      </Secao>

      <Secao titulo="Observações" quebrar={false}>
        {dados.observacoes ? (
          <Paragrafo texto={dados.observacoes} />
        ) : (
          <AreaTexto linhas={2} />
        )}
      </Secao>

      {/* Este documento viaja COM a máquina. A assinatura de quem a recebe na
          oficina é a única prova de onde ela foi parar — e é a linha que
          resolve a conversa quando a peça não volta. */}
      <Assinaturas
        localData={dados.localData}
        assinantes={[
          { papel: "Autorizado por — obra" },
          { papel: "Retirado por — transportador" },
          {
            papel: `Recebido na oficina — ${dados.executor ?? "executor"}`,
          },
        ]}
      />
    </Documento>
  );
}
