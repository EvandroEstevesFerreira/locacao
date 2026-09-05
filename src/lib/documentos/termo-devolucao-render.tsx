import "server-only";

// Renderiza o termo de devolução em PDF.
//
// Separado de `termo-devolucao.tsx` de propósito, pela mesma razão do romaneio:
// o componente é JSX puro e pode ser importado por qualquer lugar; a
// RENDERIZAÇÃO puxa o `@react-pdf/renderer` inteiro, que é pesado e só roda no
// servidor. Uma server action que importasse o renderer direto arrastaria a
// biblioteca para o grafo de módulos de quem só queria o tipo dos dados.

import { renderToBuffer } from "@react-pdf/renderer";
import { TermoDevolucao, type DadosTermoDevolucao } from "./termo-devolucao";

/** O termo como Buffer, pronto para anexar ao e-mail. */
export async function gerarTermoDevolucaoPdf(
  dados: DadosTermoDevolucao,
): Promise<Buffer> {
  return renderToBuffer(<TermoDevolucao dados={dados} />);
}
