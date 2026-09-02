"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileSignature } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Button } from "@/components/ui/button";
import { emitirTermo } from "../../actions";

/**
 * Emissão de um termo que ficou em rascunho.
 *
 * O caminho normal é o assistente de `/termos/novo`, que salva e emite na
 * mesma sessão. Este bloco existe para o rascunho que sobrou de uma emissão
 * interrompida — internet caiu, aba fechada — e que, sem ele, ficaria com os
 * itens gravados, sem número e sem forma de virar documento.
 */
export function TermoEmissao({
  termoId,
  funcionarioNome,
  funcionarioCpf,
  nomeEmpresa,
}: {
  termoId: string;
  funcionarioNome: string;
  funcionarioCpf: string | null;
  nomeEmpresa: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [assinaturaFunc, setAssinaturaFunc] = useState("");
  const [assinaturaEmpresa, setAssinaturaEmpresa] = useState("");

  function emitir() {
    setErro(null);
    if (!assinaturaFunc) {
      return setErro("O funcionário precisa assinar para o termo ser emitido.");
    }

    iniciar(async () => {
      const r = await emitirTermo(termoId, {
        funcionario: {
          nome: funcionarioNome,
          cpf: funcionarioCpf,
          imagem: assinaturaFunc,
        },
        empresa: { nome: nomeEmpresa, imagem: assinaturaEmpresa || null },
      });
      if (!r.ok) return setErro(r.erro);
      toast.success("Termo emitido. O equipamento consta com o funcionário.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        O termo ainda é rascunho: não gastou número e o equipamento continua
        disponível na frota. A emissão é o que registra a entrega.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SignaturePad
          name="assinatura_entrega_funcionario"
          label={`Assinatura de ${funcionarioNome}`}
          onChange={setAssinaturaFunc}
        />
        <SignaturePad
          name="assinatura_entrega_empresa"
          label={`Assinatura de ${nomeEmpresa} (opcional)`}
          onChange={setAssinaturaEmpresa}
        />
      </div>
      <FormError>{erro}</FormError>
      <div className="flex justify-end">
        <Button type="button" disabled={pendente} onClick={emitir}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileSignature className="size-4" />
          )}
          {pendente ? "Emitindo…" : "Emitir termo"}
        </Button>
      </div>
    </div>
  );
}
