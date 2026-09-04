import { TrendingUp } from "lucide-react";

import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { hojeISOSaoPaulo, formatarData } from "@/lib/locacao";
import { segundaDaSemana } from "@/lib/avanco";
import { listarObrasComAvanco } from "@/lib/data/avanco";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { LancamentoSemanal } from "./_components/lancamento-semanal";

export default async function AvancoPage() {
  // `hojeISOSaoPaulo`, nunca `new Date()`: o Vercel roda em UTC e das 21h à
  // meia-noite em Brasília a semana calculada seria a seguinte.
  const hojeISO = hojeISOSaoPaulo();
  const semana = segundaDaSemana(hojeISO);
  const [obras, perfil] = await Promise.all([
    listarObrasComAvanco(semana),
    getCurrentPerfil(),
  ]);

  const pendentes = obras.filter((o) => o.semanaAtual === null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Avanço das obras"
        descricao={
          <>
            Semana de {formatarData(semana)}
            {obras.length > 0
              ? pendentes === 0
                ? " · todas as obras lançadas"
                : ` · ${pendentes} de ${obras.length} sem lançamento`
              : null}
          </>
        }
      />

      {obras.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          titulo="Nenhuma obra ativa"
          descricao="O avanço é lançado por obra ativa. Cadastre uma obra ou reative alguma para começar."
          acao={{ label: "Ver obras", href: "/obras" }}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <LancamentoSemanal
              obras={obras}
              semana={semana}
              hojeISO={hojeISO}
              podeLancar={podeEditarCadastros(perfil?.papel)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
