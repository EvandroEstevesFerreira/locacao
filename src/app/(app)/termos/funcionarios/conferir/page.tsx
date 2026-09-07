import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";

import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { listarFuncionarios } from "@/lib/data/termo";
import { precisaConferencia } from "@/lib/termo";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConferirEmails, type LinhaConferencia } from "./conferir-emails";

export const metadata = { title: "Conferir e-mails — Loca" };

/**
 * A tela que destrava os 95 termos.
 *
 * A CORRENTE: 95 máquinas constam em uso sem responsável; custódia de pessoa
 * exige termo (trava do banco); termo exige assinatura; assinatura à distância
 * exige convite por e-mail; e convite não sai para endereço **deduzido** que
 * ninguém conferiu. Hoje são 0 de 97 conferidos, e é aqui que isso muda.
 *
 * SÓ LISTA QUEM TEM ENDEREÇO DEDUZIDO. Quem digitou o próprio e-mail já entrou
 * confirmado, e quem não tem endereço nenhum não tem o que conferir — mostrar os
 * dois casos aqui encheria a lista de linhas em que não há nada a fazer, e é
 * assim que uma tela de conferência deixa de ser conferida.
 *
 * A dedução é recalculada e COMPARADA com o gravado: se o endereço no cadastro
 * não é o que o nome produziria, alguém já o digitou à mão — e digitar já é
 * conferir. Essa pessoa não aparece.
 */
export default async function ConferirEmailsPage() {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/termos");

  const funcionarios = await listarFuncionarios({ apenasAtivos: true });

  // A regra vive em `precisaConferencia`, e não aqui: o contador na lista de
  // funcionários faz a mesma pergunta, e duas cópias divergiriam na primeira
  // correção — um botão dizendo “conferir 97” abrindo uma tela com 94 linhas.
  const linhas: LinhaConferencia[] = funcionarios
    .filter(precisaConferencia)
    .map((f) => ({
      id: f.id,
      nome: f.nome,
      cargo: f.cargo,
      email: f.email!,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo="Conferir e-mails"
        descricao={
          linhas.length === 0
            ? "Nenhum endereço deduzido esperando conferência."
            : `${linhas.length} ${
                linhas.length === 1 ? "endereço deduzido" : "endereços deduzidos"
              } do nome, ainda sem conferência.`
        }
        acoes={
          <Button variant="outline" render={<Link href="/termos/funcionarios" />}>
            <ArrowLeft className="size-4" aria-hidden />
            Funcionários
          </Button>
        }
      />

      {linhas.length === 0 ? (
        <EmptyState
          icon={<MailCheck />}
          titulo="Nada a conferir"
          descricao="Todo endereço deduzido do nome já foi conferido por alguém — ou foi digitado à mão, que é a mesma coisa."
          acao={{ label: "Ver funcionários", href: "/termos/funcionarios" }}
        />
      ) : (
        <>
          <Card>
            <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
              <p>
                Estes endereços foram <strong>deduzidos do nome</strong> no padrão{" "}
                <span className="font-mono text-xs">
                  nome.sobrenome@sistenge.com
                </span>
                . Enquanto ninguém confirmar, <strong>nenhum termo é enviado</strong>{" "}
                para eles — e é isso que hoje impede as 95 máquinas em uso de
                terem um responsável assinado.
              </p>
              <p>
                Não há botão para marcar todos, de propósito: a conferência só
                vale se alguém olhar endereço por endereço. Confirmar é dizer que{" "}
                <em>este</em> endereço é dessa pessoa.
              </p>
            </CardContent>
          </Card>

          <ConferirEmails linhas={linhas} />
        </>
      )}
    </div>
  );
}
