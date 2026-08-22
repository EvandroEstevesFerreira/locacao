// Registro dos documentos do alojamento que saem EM BRANCO, para impressão.
//
// Liga o `tipo` do catálogo (`src/lib/templates.ts`) ao componente que o compõe.
// A rota `/api/documentos/[tipo]/pdf` consulta este mapa; documentos que saem
// preenchidos com dados (contrato, termo do ocupante) têm rota própria, porque
// precisam buscar o registro específico.

import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import type { TipoDocumento } from "@/lib/templates";
import { MedidaDisciplinar } from "./frm-rh-002";
import { TermoChaves } from "./frm-rh-003";
import { KitAlojamento } from "./frm-rh-004";
import { ChecklistLimpeza, type Frequencia } from "./frm-rh-005";
import { PoliticaAlojamento } from "./pol-rh-001";

export type ConteudoDocumento = {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
};

type Renderizador = (
  conteudo: ConteudoDocumento,
  variante?: string | null,
) => ReactElement<DocumentProps>;

/** Documentos em branco, imprimíveis sem nenhum registro do sistema. */
export const DOCUMENTOS_EM_BRANCO: Partial<
  Record<TipoDocumento, Renderizador>
> = {
  politica_alojamento: (c) => <PoliticaAlojamento {...c} />,
  medida_disciplinar: (c) => <MedidaDisciplinar {...c} />,
  termo_chaves: (c) => <TermoChaves {...c} />,
  kit_alojamento: (c) => <KitAlojamento {...c} />,
  // `?variante=mensal` gera a folha das 6 tarefas de frequência M. Sem ela, a
  // folha semanal com as diárias e semanais.
  checklist_limpeza: (c, variante) => (
    <ChecklistLimpeza
      {...c}
      frequencias={variante === "mensal" ? (["M"] as Frequencia[]) : undefined}
    />
  ),
};

export function ehDocumentoEmBranco(tipo: string): tipo is TipoDocumento {
  return tipo in DOCUMENTOS_EM_BRANCO;
}
