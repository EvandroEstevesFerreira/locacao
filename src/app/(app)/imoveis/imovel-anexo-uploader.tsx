"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { salvarAnexoImovelContrato } from "./actions";
import { Button } from "@/components/ui/button";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export function ImovelAnexoUploader({
  contratoId,
  imovelId,
  orgId,
  campo,
  tem,
  rotulo,
}: {
  contratoId: string;
  imovelId: string;
  orgId: string;
  campo: "anexo_contrato_path" | "caucao_comprovante_path";
  tem: boolean;
  rotulo: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setEnviando(true);
    const supabase = createClient();
    try {
      const uid = crypto.randomUUID();
      const path = `${orgId}/${imovelId}/${contratoId}/${campo}-${uid}-${nomeSeguro(file.name)}`;
      const { error } = await supabase.storage
        .from("imoveis")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error("Falha ao enviar o arquivo.");
        return;
      }
      await salvarAnexoImovelContrato(contratoId, campo, path, imovelId);
      toast.success("Arquivo anexado.");
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => handleFile(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {enviando ? "Enviando…" : tem ? `Substituir ${rotulo}` : `Anexar ${rotulo}`}
      </Button>
    </>
  );
}
