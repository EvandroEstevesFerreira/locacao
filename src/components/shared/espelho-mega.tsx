// O que o Mega diz sobre os pagamentos — de um fornecedor ou de um locador.
//
// O Loca sabe o que foi contratado e o que corre. Quem sabe o que saiu do caixa
// é o ERP — e até aqui essa resposta exigia abrir o Mega noutra aba e procurar
// à mão.
//
// COMPARTILHADO PORQUE A PERGUNTA É A MESMA. Locação de equipamento e aluguel
// de imóvel pagam agentes diferentes, mas "isto está pago?" se responde do
// mesmo jeito. Duas cópias divergiriam, e a divergência apareceria como dois
// totais diferentes para o mesmo dado.
//
// ESTA SEÇÃO NÃO DÁ BAIXA EM NADA e não escreve no financeiro do Loca.

import { CircleCheck, CircleAlert, TriangleAlert, CalendarClock } from "lucide-react";
import { SITUACAO_TITULO_INFO } from "@/lib/mega/vencimento";
import type { EspelhoDoFornecedor } from "@/lib/data/mega";
import { formatarBRL, formatarData, formatarDataHora } from "@/lib/locacao";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function EspelhoMega({
  espelho,
  rodape,
}: {
  espelho: EspelhoDoFornecedor;
  /** O que dizer sobre o recorte: fornecedor inteiro, locador inteiro… */
  rodape: string;
}) {
  const { titulos, pago, emAberto, atrasado, sincronizadoEm, ultimoErro } = espelho;

  return (
    <Card>
      <CardHeader>
        <CardTitle>No Mega</CardTitle>
        <CardDescription>
          Títulos a pagar no ERP.{" "}
          {/* A FRESCURA DO DADO É PARTE DO DADO. "Pago" copiado há duas semanas
              e "pago" de hoje de manhã merecem confiança diferente, e sem a
              data ninguém consegue distinguir os dois. */}
          {sincronizadoEm ? (
            <>Copiado em {formatarDataHora(sincronizadoEm)}.</>
          ) : (
            <>Ainda não sincronizado.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ultimoErro ? (
          <p className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              A última sincronização falhou, então os valores abaixo podem estar
              desatualizados.
            </span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="mt-1 text-lg font-semibold">{formatarBRL(pago)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="mt-1 text-lg font-semibold">{formatarBRL(emAberto)}</p>
          </div>
          {/* O atraso ganha célula própria porque é a única destas três que pede
              uma ação hoje. Diluído dentro de "em aberto", passa. */}
          <div>
            <p className="text-xs text-muted-foreground">Atrasado</p>
            <p className="mt-1 text-lg font-semibold">
              {atrasado > 0 ? formatarBRL(atrasado) : "—"}
            </p>
          </div>
        </div>

        <ul className="divide-y rounded-md border">
          {titulos.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-2 text-sm">
              {t.quitado ? (
                <CircleCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <CircleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {t.numeroDocumento ? `Doc. ${t.numeroDocumento}` : `AP ${t.numeroAp}`}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · parcela {t.numeroParcela} ·{" "}
                  {/* "PAGO EM" E "PAGAR EM" SÃO FATOS DIFERENTES e a mesma data
                      serve aos dois: com saldo zerado ela é o dia em que se
                      pagou; com saldo em aberto, o dia em que se vai pagar.
                      Escrever "pagar em" num título quitado faria a tela pedir
                      um pagamento que já saiu. */}
                  {t.pagoEm ? (
                    <>pago em {formatarData(t.pagoEm)}</>
                  ) : (
                    <>pagar em {formatarData(t.vencimentoEfetivo)}</>
                  )}
                </span>
                {/* A DATA ORIGINAL SÓ APARECE QUANDO FOI ADIADA, e nunca no
                    lugar da de pagar. Sem esta linha, o título prorrogado
                    parece divergir da nota; com ela no lugar errado, alguém
                    paga na data velha. */}
                {t.prorrogado ? (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3 shrink-0" aria-hidden />
                    Prorrogado — vencia em {formatarData(t.dataVencimento)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums">{formatarBRL(t.valorParcela)}</span>
              <Badge variant={SITUACAO_TITULO_INFO[t.situacao].variant} className="shrink-0">
                {SITUACAO_TITULO_INFO[t.situacao].label}
              </Badge>
            </li>
          ))}
        </ul>

        {/* DE ONDE VEM A DATA, DITO EM VOZ ALTA. Ela é do ERP, não uma
            observação nossa — e quem lê "pago em" precisa saber que está lendo
            a prorrogação, que é a data que o financeiro usa para pagar. */}
        <p className="text-xs text-muted-foreground">
          A data é a prorrogada do Mega, que é a que o financeiro usa para pagar.
          Enquanto há saldo ela é a data prevista; com o título quitado, é o dia
          do pagamento. {rodape}
        </p>
      </CardContent>
    </Card>
  );
}
