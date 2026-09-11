// A seção "No Mega" na tela do contrato de locação.
//
// O card em si é compartilhado com o imóvel: a pergunta "isto está pago?" se
// responde igual dos dois lados. Aqui mora só o recorte — de quem são os
// títulos — e o silêncio quando não há espelho.

import { obterEspelhoDoFornecedor } from "@/lib/data/mega";
import { EspelhoMega } from "@/components/shared/espelho-mega";

export async function ContratoMega({ fornecedorId }: { fornecedorId: string }) {
  const espelho = await obterEspelhoDoFornecedor(fornecedorId);

  // Sem espelho, a seção inteira some. Um card vazio afirmaria "o Mega não tem
  // nada para este fornecedor" — e o mais provável é que o cron ainda não tenha
  // rodado, ou que o fornecedor esteja sem código do Mega no cadastro.
  if (!espelho) return null;

  return (
    <EspelhoMega
      espelho={espelho}
      rodape="Os títulos são do fornecedor inteiro, não só deste contrato."
    />
  );
}
