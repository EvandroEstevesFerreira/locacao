import { History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarDataHora } from "@/lib/locacao";

const ACAO_LABEL: Record<string, string> = {
  INSERT: "Criado",
  UPDATE: "Alterado",
  DELETE: "Excluído",
};

/**
 * Linha do tempo de auditoria de uma entidade (audit_log). A RLS restringe a
 * leitura ao master; para os demais o resultado é vazio e nada é renderizado.
 */
export async function AtividadeTimeline({
  entidade,
  registroId,
}: {
  entidade: string;
  registroId: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, acao, autor, criado_em")
    .eq("entidade", entidade)
    .eq("registro_id", registroId)
    .order("criado_em", { ascending: false })
    .limit(30);

  if (!data || data.length === 0) return null;

  const autorIds = [...new Set(data.map((d) => d.autor).filter(Boolean))] as string[];
  const nomePorId = new Map<string, string>();
  if (autorIds.length > 0) {
    const { data: perfis } = await supabase
      .from("perfil")
      .select("id, nome")
      .in("id", autorIds);
    for (const p of perfis ?? []) nomePorId.set(p.id, p.nome ?? "—");
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <History className="size-4" /> Atividade (auditoria)
      </p>
      <ol className="space-y-1.5">
        {data.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-2 text-sm">
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatarDataHora(e.criado_em)}
            </span>
            <span className="font-medium">{ACAO_LABEL[e.acao] ?? e.acao}</span>
            <span className="text-muted-foreground">
              por {e.autor ? nomePorId.get(e.autor) ?? "usuário" : "sistema"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
