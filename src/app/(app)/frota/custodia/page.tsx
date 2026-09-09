// Mutirão de regularização da custódia.
//
// POR QUE ESTA TELA EXISTE, e por que ela é temporária por natureza. A
// importação do inventário criou 128 peças já "em uso" e nunca criou o vínculo
// com a pessoa: `custodia_peca` conhecia 2 de 95. O nome de quem está com cada
// máquina ficou no TEXTO das observações, no formato "Com: <nome> (conforme
// planilha)".
//
// A tela lê aquele texto, propõe o funcionário do cadastro e espera
// confirmação. Quando as 95 estiverem regularizadas ela fica vazia — e vazia é
// o estado final desejado, não um defeito.

import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { listarMutiraoDeCustodia } from "@/lib/data/custodia";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MutiraoForm } from "./_components/mutirao-form";

export const metadata = { title: "Regularizar custódia — Loca" };

export default async function MutiraoCustodiaPage() {
  const perfil = await getCurrentPerfil();
  // 404, e não uma tela vazia: quem não pode editar cadastro não tem o que
  // fazer aqui, e a rota não deve confirmar que ela existe.
  if (!podeEditarCadastros(perfil?.papel)) notFound();

  const { propostas, funcionarios } = await listarMutiraoDeCustodia();

  const automaticas = propostas.filter(
    (p) => p.casamento.tipo === "exato" || p.casamento.tipo === "unico",
  ).length;
  const ambiguas = propostas.filter((p) => p.casamento.tipo === "ambiguo").length;
  const semCasamento = propostas.filter((p) => p.casamento.tipo === "nenhum").length;

  return (
    <div className="pagina-lista space-y-6">
      <PageHeader
        titulo="Regularizar custódia"
        descricao="Peças em uso sem dono registrado, com o detentor proposto a partir da planilha de coleta."
      />

      {propostas.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" />}
          titulo="Nada a regularizar"
          descricao="Toda peça em uso já tem dono registrado, ou não há nome na planilha para propor. Esta tela some quando o mutirão acaba — vazia é o estado final."
        />
      ) : (
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="text-base">
              {propostas.length} {propostas.length === 1 ? "peça" : "peças"} a
              regularizar
            </CardTitle>
            <CardDescription>
              {automaticas} com casamento certo, já marcadas · {ambiguas} com mais de
              um candidato · {semCasamento} sem casamento. As duas últimas ficam em
              branco de propósito: confirmar o que não se leu é o mesmo que
              adivinhar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MutiraoForm propostas={propostas} funcionarios={funcionarios} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
