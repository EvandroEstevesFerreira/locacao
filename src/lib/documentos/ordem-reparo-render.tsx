import "server-only";

// Renderiza a ordem de reparo em PDF.
//
// Separado de `ordem-reparo.tsx` pela mesma razão dos outros documentos: o
// componente é JSX puro; a RENDERIZAÇÃO puxa o `@react-pdf/renderer` inteiro,
// que é pesado e só roda no servidor.

import { renderToBuffer } from "@react-pdf/renderer";
import { OrdemReparo, type DadosOrdemReparo } from "./ordem-reparo";

/** A ordem como Buffer. */
export async function gerarOrdemReparoPdf(
  dados: DadosOrdemReparo,
): Promise<Buffer> {
  return renderToBuffer(<OrdemReparo dados={dados} />);
}
