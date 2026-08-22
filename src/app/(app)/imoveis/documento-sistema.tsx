// Linha de um documento GERADO pelo sistema, na tela de Documentos do
// alojamento.
//
// Diferente do documento enviado: não tem excluir (não há arquivo no Storage),
// tem "editar texto" — que leva a Configurações, só para quem pode configurar o
// sistema. Autoria e consumo têm públicos diferentes: o encarregado imprime na
// obra, o master edita a cláusula.

import Link from "next/link";
import { Download, FileText, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export type VarianteDocumento = { rotulo: string; query: string };

export function DocumentoSistema({
  tipo,
  titulo,
  descricao,
  podeEditar,
  variantes,
}: {
  tipo: string;
  titulo: string;
  descricao: string;
  /** Mostra o atalho para editar o texto em Configurações (apenas master). */
  podeEditar: boolean;
  /** Quando o documento tem mais de uma folha (semanal e mensal, por exemplo). */
  variantes?: VarianteDocumento[];
}) {
  const opcoes: VarianteDocumento[] = variantes ?? [{ rotulo: "Baixar", query: "" }];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {opcoes.map((o) => (
          <Button key={o.rotulo} variant="outline" size="sm" render={
            <Link href={`/api/documentos/${tipo}/pdf${o.query}`} target="_blank" />
          }>
            <Download className="size-3.5" aria-hidden />
            {o.rotulo}
          </Button>
        ))}
        {podeEditar ? (
          <Button variant="ghost" size="sm" render={
            <Link href={`/configuracoes/templates/${tipo}`} />
          }>
            <PencilLine className="size-3.5" aria-hidden />
            Editar texto
          </Button>
        ) : null}
      </div>
    </div>
  );
}
