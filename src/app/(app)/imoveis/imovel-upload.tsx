"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  salvarFotoVistoriaImovel,
  salvarAnexoReparo,
  salvarAnexoOcorrencia,
} from "./actions";
import { Button } from "@/components/ui/button";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

type Kind = "vistoria_foto" | "reparo" | "ocorrencia";

/** Upload genérico para o bucket "imoveis" (fotos de vistoria, anexos). */
export function ImovelUpload({
  kind,
  registroId,
  imovelId,
  orgId,
  rotulo,
}: {
  kind: Kind;
  registroId: string;
  imovelId: string;
  orgId: string;
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
      const path = `${orgId}/${imovelId}/${kind}/${registroId}/${uid}-${nomeSeguro(file.name)}`;
      const { error } = await supabase.storage
        .from("imoveis")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error("Falha ao enviar o arquivo.");
        return;
      }
      if (kind === "vistoria_foto") await salvarFotoVistoriaImovel(registroId, imovelId, path);
      else if (kind === "reparo") await salvarAnexoReparo(registroId, imovelId, path);
      else await salvarAnexoOcorrencia(registroId, imovelId, path);
      toast.success("Arquivo enviado.");
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
        {enviando ? "Enviando…" : rotulo}
      </Button>
    </>
  );
}
