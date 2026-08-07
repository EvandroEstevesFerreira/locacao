"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { salvarContratoDoc } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";


function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

/** Anexa um documento adicional (aditivo/renovação) ao contrato. */
export function ContratoDocsUploader({
  contratoId,
  orgId,
}: {
  contratoId: string;
  orgId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("aditivo");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
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
      await salvarContratoDoc(contratoId, path, tipo, descricao, data);
      toast.success("Documento anexado.");
      setDescricao("");
      setData("");
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="doc_tipo">Tipo</Label>
        <NativeSelect
          id="doc_tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="aditivo">Aditivo</option>
          <option value="renovacao">Renovação</option>
          <option value="outro">Outro</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc_descricao">Descrição</Label>
        <Input
          id="doc_descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={160}
          placeholder="Ex.: Aditivo de prazo"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc_data">Data</Label>
        <Input
          id="doc_data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => handleFile(e.target.files)}
      />
      <div className="sm:col-span-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {enviando ? "Enviando…" : "Anexar aditivo / renovação"}
        </Button>
      </div>
    </div>
  );
}
