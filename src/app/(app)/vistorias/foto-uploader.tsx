"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { registrarFoto } from "./actions";
import { Button } from "@/components/ui/button";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
}

export function FotoUploader({
  vistoriaId,
  orgId,
}: {
  vistoriaId: string;
  orgId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviando(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        const uid = crypto.randomUUID();
        const path = `${orgId}/${vistoriaId}/${uid}-${nomeSeguro(file.name)}`;
        const { error } = await supabase.storage
          .from("vistorias")
          .upload(path, file, { upsert: false });
        if (error) {
          toast.error("Falha ao enviar foto", { description: file.name });
          continue;
        }
        await registrarFoto(vistoriaId, path);
      }
      toast.success("Fotos enviadas.");
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
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
      >
        <Camera className="size-4" />
        {enviando ? "Enviando…" : "Adicionar fotos"}
      </Button>
    </div>
  );
}
