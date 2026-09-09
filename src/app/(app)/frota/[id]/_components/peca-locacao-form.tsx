"use client";

// A amarração da peça locada: a linha do contrato, ou o dono provisório.
//
// Dois campos e nenhuma validação cruzada, então `useActionState` bastaria —
// mas a action devolve `ActionResult` com `aviso`, e o aviso ("dono provisório X
// removido") é a parte que explica o que aconteceu. Daí o `useTransition`, como
// nos outros formulários de ação única do projeto.
//
// O provisório fica DESABILITADO quando há contrato: ele existe para a peça que
// ainda não tem contrato no Loca, e deixá-lo editável ao lado de um contrato
// convidaria a preencher um campo que a action vai limpar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { amarrarPecaAoContrato } from "../../actions";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export type OpcaoLinha = {
  itemLocadoId: string;
  contratoNumero: string;
  obra: string | null;
};

export function PecaLocacaoForm({
  pecaId,
  linhas,
  fornecedores,
  itemLocadoAtual,
  fornecedorProvisorioAtual,
}: {
  pecaId: string;
  /** Linhas de contrato elegíveis, já filtradas pelas quatro condições. */
  linhas: OpcaoLinha[];
  fornecedores: { id: string; nome: string }[];
  itemLocadoAtual: string | null;
  fornecedorProvisorioAtual: string | null;
}) {
  const router = useRouter();
  const [itemLocadoId, setItemLocadoId] = useState(itemLocadoAtual ?? "");
  const [fornecedorId, setFornecedorId] = useState(fornecedorProvisorioAtual ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const temContrato = itemLocadoId !== "";

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await amarrarPecaAoContrato({
        peca_id: pecaId,
        item_locado_id: itemLocadoId || "",
        fornecedor_provisorio_id: fornecedorId || "",
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success(r.aviso ?? "Locação atualizada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="peca_contrato">Contrato de locação</Label>
          <NativeSelect
            id="peca_contrato"
            value={itemLocadoId}
            disabled={pendente || linhas.length === 0}
            onChange={(e) => setItemLocadoId(e.target.value)}
          >
            <option value="">Sem contrato no Loca</option>
            {linhas.map((l) => (
              <option key={l.itemLocadoId} value={l.itemLocadoId}>
                {l.contratoNumero}
                {l.obra ? ` · ${l.obra}` : ""}
              </option>
            ))}
          </NativeSelect>
          {linhas.length === 0 ? (
            /* Explica o critério em vez de oferecer um seletor vazio. Sem isto,
               a pessoa conclui que o sistema está quebrado. */
            <p className="text-xs text-muted-foreground">
              Nenhum contrato tem linha em aberto deste item sem peça vinculada.
              Acrescente o item ao contrato, ou registre o dono abaixo enquanto
              o contrato não existir.
            </p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <Label htmlFor="peca_fornecedor">Empresa responsável (provisório)</Label>
          <NativeSelect
            id="peca_fornecedor"
            value={temContrato ? "" : fornecedorId}
            disabled={pendente || temContrato}
            onChange={(e) => setFornecedorId(e.target.value)}
          >
            <option value="">Não informado</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {temContrato
              ? "Com contrato amarrado, a empresa vem dele — este campo é limpo ao salvar."
              : "Vale enquanto a peça não tem contrato no Loca. O contrato sempre manda."}
          </p>
        </div>
      </div>

      <FormError>{erro}</FormError>

      <Button type="button" size="sm" disabled={pendente} onClick={salvar}>
        {pendente ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          <>
            <Link2 className="size-3.5" aria-hidden />
            Salvar locação
          </>
        )}
      </Button>
    </div>
  );
}
