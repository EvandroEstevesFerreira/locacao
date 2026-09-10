// Os três números do contrato, e a conferência entre eles.
//
// Existe como componente próprio para o resumo não ficar preso à consulta mais
// pesada da rota: obra, fornecedor, cadência e status vêm da linha de contrato e
// aparecem de imediato, enquanto só estas células esperam o cálculo dos itens. A
// leitura é a mesma da tabela de itens e está sob `cache()`, então não custa uma
// consulta extra.
//
// OS TRÊS NÚMEROS SÃO COISAS DIFERENTES, e antes só existia o terceiro:
//
//   Contratado   — o que está no DOCUMENTO. Digitado, não calculado.
//   Comprometido — o que os itens cadastrados projetam até o fim do contrato.
//   Acumulado    — o que já correu, de cada retirada até hoje.
//
// O valor não está em exibir os três, e sim em COMPARAR os dois primeiros. Sem
// isso, cadastrar seis aparelhos onde o contrato prevê sete passa em silêncio e
// o contrato subfatura até alguém conferir no papel.

import { AlertTriangle, Check } from "lucide-react";
import { obterItensLocadosCalculados } from "@/lib/data/contratos";
import {
  comprometidoDoContrato,
  conciliarContrato,
  dataDeISO,
  formatarBRL,
  type Cadencia,
} from "@/lib/locacao";
import { Campo } from "@/components/shared/campo";

export async function ContratoCusto({
  contratoId,
  cadencia,
  prorata,
  fimPrevisto,
  valorContratado,
}: {
  contratoId: string;
  cadencia: Cadencia;
  prorata: boolean;
  /** 'yyyy-mm-dd'. Sem ele não há horizonte para projetar. */
  fimPrevisto: string | null;
  valorContratado: number | null;
}) {
  const linhas = await obterItensLocadosCalculados(contratoId, cadencia, prorata);
  const acumulado = linhas.reduce((s, l) => s + l.custo, 0);

  const comprometido = comprometidoDoContrato({
    linhas,
    cadencia,
    fimContrato: fimPrevisto ? dataDeISO(fimPrevisto) : null,
    prorata,
  });

  const conferencia =
    comprometido === null
      ? null
      : conciliarContrato({ contratado: valorContratado, comprometido });

  return (
    <>
      <Campo
        label="Valor do contrato"
        valor={valorContratado !== null ? formatarBRL(valorContratado) : null}
      />
      <Campo
        label="Comprometido"
        valor={comprometido !== null ? formatarBRL(comprometido) : null}
        node={
          comprometido === null ? (
            /* Sem fim previsto não há horizonte, e o travessão sozinho pareceria
               dado faltando. Dizer o motivo aponta o conserto. */
            <span className="text-sm text-muted-foreground">
              sem fim previsto
            </span>
          ) : undefined
        }
      />
      <Campo label="Custo estimado acumulado" valor={formatarBRL(acumulado)} destaque />

      {conferencia && conferencia.situacao !== "sem_referencia" ? (
        <div className="sm:col-span-4">
          {conferencia.situacao === "confere" ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="size-3.5 shrink-0" aria-hidden />
              Os itens cadastrados somam o valor do contrato.
            </p>
          ) : (
            /* Acima e abaixo são conversas diferentes, e por isso a mensagem
               muda: acima costuma ser prazo (o item corre até o fim quando
               deveria voltar antes); abaixo costuma ser item faltando. */
            <p className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {conferencia.situacao === "acima" ? (
                  <>
                    Os itens cadastrados projetam{" "}
                    <strong>{formatarBRL(conferencia.diferenca)} a mais</strong> que
                    o valor do contrato. Confira o prazo: item sem devolução
                    prevista corre até o fim do contrato.
                  </>
                ) : (
                  <>
                    Os itens cadastrados projetam{" "}
                    <strong>{formatarBRL(conferencia.diferenca)} a menos</strong> que
                    o valor do contrato. Pode faltar item, quantidade ou valor
                    unitário.
                  </>
                )}
              </span>
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}

/** Placeholder dos valores enquanto o cálculo dos itens não volta. */
export function ContratoCustoSkeleton() {
  return (
    <>
      {["Valor do contrato", "Comprometido", "Custo estimado acumulado"].map((r) => (
        <div key={r}>
          <p className="text-xs text-muted-foreground">{r}</p>
          <div className="mt-1 h-6 w-28 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </>
  );
}
