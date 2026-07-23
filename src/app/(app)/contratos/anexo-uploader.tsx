"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { salvarAnexoContrato } from "./actions";
import { Button } from "@/components/ui/button";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export function AnexoUploader({
  contratoId,
  orgId,
  tem,
}: {
  contratoId: string;
  orgId: string;
  tem: boolean;
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
      const path = `${orgId}/${contratoId}/${uid}-${nomeSeguro(file.name)}`;
      const { error } = await supabase.storage
        .from("contratos")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error("Falha ao enviar o arquivo.");
        return;
      }
      await salvarAnexoContrato(contratoId, path);
      toast.success("Contrato anexado.");
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
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
        {enviando ? "Enviando…" : tem ? "Substituir arquivo" : "Anexar contrato"}
      </Button>
    </div>
  );
}
