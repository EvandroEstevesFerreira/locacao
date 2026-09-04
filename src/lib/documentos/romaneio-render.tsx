import "server-only";

// Renderiza o romaneio em PDF.
//
// Separado de `romaneio.tsx` de propósito: o componente é JSX puro e pode ser
// importado por qualquer lugar; a RENDERIZAÇÃO puxa o `@react-pdf/renderer`
// inteiro, que é pesado e só roda no servidor. Uma server action que importasse
// o renderer direto arrastaria a biblioteca para o grafo de módulos de quem só
// queria o tipo dos dados.

import { renderToBuffer } from "@react-pdf/renderer";
import { Romaneio, type DadosRomaneio } from "./romaneio";

/** O romaneio como Buffer, pronto para anexar ao e-mail. */
export async function gerarRomaneioPdf(dados: DadosRomaneio): Promise<Buffer> {
  return renderToBuffer(<Romaneio dados={dados} />);
}
