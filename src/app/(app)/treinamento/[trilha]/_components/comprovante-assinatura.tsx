"use client";

// O comprovante: assina uma vez, e depois só baixa.
//
// Concluir (acertar o questionário) e assinar são dois momentos de propósito
// — ver o comentário em `../../actions.ts`. Aqui só existe o segundo: assinar
// a conclusão que já existe, e depois abrir o PDF gerado por
// `/api/treinamento/[trilha]/comprovante`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileDown, PenLine } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Button } from "@/components/ui/button";
import { assinarComprovante } from "../../actions";

export function ComprovanteAssinatura({
  trilhaChave,
  jaAssinado,
  numeroRegistro,
}: {
  trilhaChave: string;
  jaAssinado: boolean;
  numeroRegistro: string | null;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState("");
  const [pendente, iniciar] = useTransition();

  function assinar() {
    setErro(null);
    if (!assinatura) return setErro("Assine o comprovante para concluir.");

    iniciar(async () => {
      const dados = new FormData();
      dados.set("trilha", trilhaChave);
      dados.set("assinatura", assinatura);

      const r = await assinarComprovante(dados);
      if (!r.ok) return setErro(r.erro);

      toast.success("Comprovante assinado.");
      router.refresh();
    });
  }

  if (jaAssinado) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Comprovante nº <span className="font-medium text-foreground">{numeroRegistro ?? "—"}</span>
        </p>
        <Button
          variant="outline"
          render={
            <a
              href={`/api/treinamento/${trilhaChave}/comprovante`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <FileDown className="size-4" />
          Baixar comprovante
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assine para gerar o comprovante em PDF desta conclusão.
      </p>
      <SignaturePad
        name="assinatura_comprovante"
        label="Sua assinatura"
        onChange={setAssinatura}
      />
      <FormError>{erro}</FormError>
      <div className="flex justify-end">
        <Button type="button" disabled={pendente} onClick={assinar}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PenLine className="size-4" />
          )}
          {pendente ? "Assinando…" : "Assinar comprovante"}
        </Button>
      </div>
    </div>
  );
}
