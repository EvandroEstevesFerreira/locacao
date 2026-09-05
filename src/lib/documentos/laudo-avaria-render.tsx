import "server-only";

// Renderiza o laudo de avaria em PDF.
//
// Separado de `laudo-avaria.tsx` pela mesma razão do romaneio e do termo: o
// componente é JSX puro e pode ser importado por qualquer lugar; a RENDERIZAÇÃO
// puxa o `@react-pdf/renderer` inteiro, que é pesado e só roda no servidor.

import { renderToBuffer } from "@react-pdf/renderer";
import { LaudoAvaria, type DadosLaudoAvaria } from "./laudo-avaria";

/** O laudo como Buffer. */
export async function gerarLaudoAvariaPdf(
  dados: DadosLaudoAvaria,
): Promise<Buffer> {
  return renderToBuffer(<LaudoAvaria dados={dados} />);
}
