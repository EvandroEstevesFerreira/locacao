"use client";

// Anexo de documento da CONTRAPARTE na vistoria: protocolo de retirada, OS.
//
// Espelha `foto-uploader.tsx` — sobe para a mesma bucket, registra a linha
// depois, e avisa quando o arquivo subiu mas a linha não. A diferença é que
// aqui o arquivo tem CLASSIFICAÇÃO: quem recebe um protocolo e uma OS no mesmo
// dia precisa distinguir um do outro seis meses depois.
//
// Aceita PDF e imagem. Protocolo fotografado no celular é o caso comum na obra
// — exigir PDF faria a pessoa não anexar nada.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { TIPO_ANEXO_VISTORIA, type TipoAnexoVistoria } from "@/lib/vistoria";
import { registrarAnexo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
}

export function AnexoUploader({
  vistoriaId,
  orgId,
}: {
  vistoriaId: string;
  orgId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoAnexoVistoria>("protocolo");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviando(true);
    const supabase = createClient();
    const falhas: string[] = [];
    let enviados = 0;
    try {
      for (const file of Array.from(files)) {
        const uid = crypto.randomUUID();
        // Subpasta `anexos/` de propósito: fotos e anexos dividem a bucket, e o
        // caminho é o que permite distinguir um do outro olhando o Storage.
        const path = `${orgId}/${vistoriaId}/anexos/${uid}-${nomeSeguro(file.name)}`;
        const { error } = await supabase.storage
          .from("vistorias")
          .upload(path, file, { upsert: false });
        if (error) {
          toast.error("Falha ao enviar o arquivo", { description: file.name });
          continue;
        }
        const r = await registrarAnexo(
          vistoriaId,
          path,
          tipo,
          descricao.trim() || null,
        );
        if (r?.error) {
          falhas.push(file.name);
          continue;
        }
        enviados += 1;
      }
      if (falhas.length > 0) {
        toast.error(`Não foi possível registrar ${falhas.length} arquivo(s).`, {
          description: falhas.join(", "),
        });
      }
      if (enviados > 0) {
        toast.success(enviados === 1 ? "Documento anexado." : "Documentos anexados.");
        setDescricao("");
      }
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor="anexo_tipo">Tipo</Label>
        <NativeSelect
          id="anexo_tipo"
          value={tipo}
          disabled={enviando}
          onChange={(e) => setTipo(e.target.value as TipoAnexoVistoria)}
        >
          {Object.entries(TIPO_ANEXO_VISTORIA).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="anexo_descricao">
          Número ou observação{" "}
          <span className="text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="anexo_descricao"
          placeholder="Ex.: OS 4471 da A2 Works"
          value={descricao}
          disabled={enviando}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
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
          <Paperclip className="size-4" aria-hidden />
          {enviando ? "Enviando…" : "Anexar"}
        </Button>
      </div>
    </div>
  );
}
