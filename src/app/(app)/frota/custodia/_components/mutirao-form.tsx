"use client";

// O mutirão de custódia: uma linha por peça, com o detentor proposto.
//
// A REGRA DA TELA: nada é gravado sem eu ter visto. As propostas automáticas vêm
// marcadas, as ambíguas vêm com um seletor e DESMARCADAS, e as que não casaram
// vêm com o cadastro inteiro para escolher à mão. Marcar o ambíguo por padrão
// seria pedir confirmação de algo que a pessoa não leu.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { PropostaMutirao } from "@/lib/data/custodia";
import { confirmarMutiraoCustodia } from "../../actions";
import { FormError } from "@/components/shared/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

type Funcionario = { id: string; nome: string; cpf: string | null; email: string | null };

/** Como distinguir duas fichas com o MESMO nome (há 8 casos no cadastro). */
function distintivo(f: Funcionario): string {
  if (f.cpf) return `CPF ${f.cpf}`;
  if (f.email) return f.email;
  return "sem CPF nem e-mail";
}

export function MutiraoForm({
  propostas,
  funcionarios,
}: {
  propostas: PropostaMutirao[];
  funcionarios: Funcionario[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Escolha por peça. Vazio = não gravar esta linha.
  const [escolha, setEscolha] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const p of propostas) {
      // Só o que casou com CERTEZA vem preenchido. Ambíguo e sem casamento
      // ficam em branco de propósito — ver o comentário do topo.
      if (p.casamento.tipo === "exato" || p.casamento.tipo === "unico") {
        inicial[p.unidadeId] = p.casamento.funcionario.id;
      }
    }
    return inicial;
  });

  const marcadas = useMemo(
    () => Object.values(escolha).filter((v) => v !== "").length,
    [escolha],
  );

  const porId = useMemo(
    () => new Map(funcionarios.map((f) => [f.id, f])),
    [funcionarios],
  );

  function confirmar() {
    setErro(null);
    const pares = Object.entries(escolha)
      .filter(([, funcionarioId]) => funcionarioId !== "")
      .map(([unidade_id, funcionario_id]) => ({ unidade_id, funcionario_id }));
    if (pares.length === 0) return setErro("Nenhuma peça selecionada.");

    iniciar(async () => {
      const r = await confirmarMutiraoCustodia({ pares });
      if (!r.ok) return setErro(r.erro);
      toast.success(r.aviso ?? "Custódia registrada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-2 font-medium">Peça</th>
              <th className="p-2 font-medium">Na planilha</th>
              <th className="p-2 font-medium">Funcionário</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {propostas.map((p) => {
              const c = p.casamento;
              const automatico = c.tipo === "exato" || c.tipo === "unico";
              // Ambíguo oferece só os candidatos; o resto oferece o cadastro
              // inteiro. Filtrar demais faria a pessoa não achar quem procura.
              const opcoes =
                c.tipo === "ambiguo"
                  ? c.candidatos.map((x) => porId.get(x.id)!).filter(Boolean)
                  : funcionarios;
              const escolhido = escolha[p.unidadeId] ?? "";
              return (
                <tr key={p.unidadeId}>
                  <td className="p-2 align-top">
                    <span className="font-mono font-medium">{p.identificador}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.itemDescricao}
                      {p.obraRotulo ? ` · ${p.obraRotulo}` : ""}
                    </span>
                  </td>
                  <td className="p-2 align-top">
                    {p.nomeNoTexto}
                    <span className="mt-1 block">
                      {automatico ? (
                        <Badge variant="secondary">
                          {c.tipo === "exato" ? "Nome idêntico" : "Casou"}
                        </Badge>
                      ) : c.tipo === "ambiguo" ? (
                        <Badge variant="outline">
                          {c.candidatos.length} candidatos — escolha
                        </Badge>
                      ) : (
                        <Badge variant="outline">Não casou — escolha à mão</Badge>
                      )}
                    </span>
                  </td>
                  <td className="p-2 align-top">
                    <NativeSelect
                      value={escolhido}
                      disabled={pendente}
                      aria-label={`Funcionário de ${p.identificador}`}
                      onChange={(e) =>
                        setEscolha((a) => ({ ...a, [p.unidadeId]: e.target.value }))
                      }
                    >
                      <option value="">Não registrar agora</option>
                      {opcoes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                          {c.tipo === "ambiguo" ? ` — ${distintivo(f)}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pendente || marcadas === 0} onClick={confirmar}>
          {pendente ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Registrando…
            </>
          ) : (
            <>
              <Check className="size-4" aria-hidden />
              Registrar {marcadas} {marcadas === 1 ? "custódia" : "custódias"}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {propostas.length - marcadas} de {propostas.length} ficam de fora nesta
          rodada.
        </p>
      </div>
    </div>
  );
}
