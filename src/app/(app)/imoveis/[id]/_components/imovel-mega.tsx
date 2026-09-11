// A seção "No Mega" na tela do imóvel.
//
// 21 contratos vigentes e R$ 66.575/mês de aluguel: o Loca sabia o contrato e
// não sabia o pagamento. Esta seção responde "este aluguel foi pago?" sem abrir
// o ERP noutra aba.
//
// DIFERENTE DA TELA DE CONTRATO EM UM PONTO: aqui a seção aparece MESMO sem
// espelho, quando falta o vínculo. Um imóvel sem código do Mega não é um imóvel
// sem pagamento — é um cadastro pela metade, e some-lo da tela esconde
// justamente o que precisa ser feito.

import { obterEspelhoDoImovel, contarImoveisDoLocador } from "@/lib/data/mega";
import { EspelhoMega } from "@/components/shared/espelho-mega";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BuscarCodigoMega } from "./buscar-codigo-mega";

export async function ImovelMega({
  imovelId,
  codigoMega,
  temDocumento,
  podeEditar,
}: {
  imovelId: string;
  codigoMega: string | null;
  temDocumento: boolean;
  podeEditar: boolean;
}) {
  const espelho = codigoMega ? await obterEspelhoDoImovel(codigoMega) : null;

  if (espelho) {
    // Quantos imóveis dividem este locador. Imobiliária que administra um
    // conjunto é o caso normal, e a conta de "pago" abaixo é a DELE, não a
    // deste imóvel — dizer isso evita que alguém some as telas.
    const quantos = await contarImoveisDoLocador(codigoMega!);
    return (
      <EspelhoMega
        espelho={espelho}
        rodape={
          quantos > 1
            ? `Este locador recebe por ${quantos} imóveis. Os valores acima são de todos eles somados, não só deste.`
            : "Os títulos são do locador inteiro, não só deste imóvel."
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>No Mega</CardTitle>
        <CardDescription>Pagamentos deste aluguel no ERP.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!temDocumento ? (
          /* O PEDIDO É DE UM DADO, E DIZ PARA QUE SERVE. "Cadastro incompleto"
             não move ninguém; "é por ele que o Loca acha o pagamento", sim. */
          <p className="text-sm text-muted-foreground">
            Preencha o <strong>CPF ou CNPJ do locador</strong> no cadastro do
            imóvel. É por ele que o Loca encontra os pagamentos deste aluguel no
            Mega.
          </p>
        ) : !codigoMega ? (
          <>
            <p className="text-sm text-muted-foreground">
              O documento do locador está preenchido, mas o agente do Mega ainda
              não foi localizado.
            </p>
            {podeEditar ? <BuscarCodigoMega imovelId={imovelId} /> : null}
          </>
        ) : (
          /* Com código e sem título: é afirmação legítima, e diferente das
             outras duas. O agente existe e não tem conta a pagar na janela. */
          <p className="text-sm text-muted-foreground">
            O locador está vinculado ao agente <strong>{codigoMega}</strong> do
            Mega, mas nenhum título apareceu na última sincronização.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
