"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { salvarDocumentoBiblioteca } from "./actions";
import { CATEGORIAS_BIBLIOTECA, CATEGORIA_BIBLIOTECA_INFO } from "@/lib/biblioteca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";


function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export function BibliotecaUploader({ orgId }: { orgId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("normativo");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!titulo.trim()) {
      toast.error("Informe um título antes de escolher o arquivo.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setEnviando(true);
    const supabase = createClient();
    try {
      const uid = crypto.randomUUID();
      const path = `${orgId}/biblioteca/${uid}-${nomeSeguro(file.name)}`;
      const { error } = await supabase.storage
        .from("imoveis")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error("Falha ao enviar o arquivo.");
        return;
      }
      await salvarDocumentoBiblioteca(path, categoria, titulo, descricao);
      toast.success("Documento adicionado à biblioteca.");
      setTitulo("");
      setDescricao("");
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="bib_categoria">Categoria</Label>
        <NativeSelect
          id="bib_categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          {CATEGORIAS_BIBLIOTECA.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_BIBLIOTECA_INFO[c].label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bib_titulo">Título *</Label>
        <Input
          id="bib_titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={160}
          placeholder="Ex.: POL-RH-001 — Política de Alojamento"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bib_descricao">Descrição</Label>
        <Input
          id="bib_descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={200}
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*,.docx,.pptx,.xlsx,.doc,.ppt"
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
          {enviando ? "Enviando…" : "Adicionar documento"}
        </Button>
      </div>
    </div>
  );
}
