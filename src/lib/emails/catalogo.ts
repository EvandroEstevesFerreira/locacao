// O catálogo dos cenários de e-mail, com dados de exemplo.
//
// Separado da galeria porque tem DOIS consumidores: a pré-visualização local
// (`galeria.ts`, só em teste) e a rota de disparo de teste
// (`/api/dev/emails`, que vai a produção). Junto, a página de índice e o CSS da
// galeria entrariam no bundle sem nenhuma razão.

import * as ex from "./exemplos";
import * as t from "./templates";
import type { Contexto } from "./base";
import type { EmailPronto } from "./templates";

export type ItemCatalogo = {
  /** Identificador para nome de arquivo — sem acento, sem espaço. */
  id: string;
  titulo: string;
  /** Quando o Loca dispara este e-mail. */
  gatilho: string;
  /** `true` enquanto nenhum call site dispara este template. */
  aguardandoGatilho?: boolean;
  render(ctx: Contexto): EmailPronto;
};

/** Os cenários da pré-visualização, na ordem em que aparecem. */
export const CATALOGO: ItemCatalogo[] = [
  {
    id: "vencimentos-obra",
    titulo: "Avisos de vencimento — obra",
    gatilho: "Cron diário, para os destinatários de cada obra",
    render: (ctx) => t.vencimentosObra(ex.VENCIMENTOS_OBRA, ctx),
  },
  {
    id: "vencimentos-central",
    titulo: "Avisos de vencimento — resumo geral",
    gatilho: "Cron diário, para quem gerencia todos os contratos",
    render: (ctx) => t.vencimentosCentral(ex.VENCIMENTOS_CENTRAL, ctx),
  },
  {
    id: "acesso-criado",
    titulo: "Acesso criado",
    gatilho: "Master cadastra um usuário novo",
    render: (ctx) => t.acessoCriado(ex.ACESSO_CRIADO, ctx),
  },
  {
    id: "senha-redefinida",
    titulo: "Senha redefinida",
    gatilho: "Master redefine a senha de alguém",
    render: (ctx) => t.senhaRedefinida(ex.SENHA_REDEFINIDA, ctx),
  },
  {
    id: "relatorio",
    titulo: "Relatório automático",
    gatilho: "Cron semanal ou mensal, com o PDF anexo",
    render: (ctx) => t.relatorioAutomatico(ex.RELATORIO, ctx),
  },
  {
    id: "relatorio-vazio",
    titulo: "Relatório automático — período sem registro",
    gatilho: "Mesmo cron, quando não houve movimento",
    render: (ctx) => t.relatorioAutomatico(ex.RELATORIO_VAZIO, ctx),
  },
  {
    id: "recebimento",
    titulo: "Recebimento de equipamento",
    gatilho: "Fechamento do recebimento — vai para o fornecedor",
    aguardandoGatilho: true,
    render: (ctx) => t.recebimentoFornecedor(ex.RECEBIMENTO, ctx),
  },
  {
    id: "documento",
    titulo: "Documento gerado",
    gatilho: "Envio de contrato ou termo ao fornecedor / proprietário",
    aguardandoGatilho: true,
    render: (ctx) => t.documentoParaTerceiro(ex.DOCUMENTO_TERCEIRO, ctx),
  },
  {
    id: "avaria",
    titulo: "Avarias em vistoria",
    gatilho: "Avaria passa de aberta para cobrada — vai para o fornecedor",
    aguardandoGatilho: true,
    render: (ctx) => t.avariaCobranca(ex.AVARIA, ctx),
  },
  {
    id: "fluxo",
    titulo: "Fluxo de caixa",
    gatilho: "Cron mensal, para a gestão",
    aguardandoGatilho: true,
    render: (ctx) => t.fluxoCaixaMensal(ex.FLUXO, ctx),
  },
];

