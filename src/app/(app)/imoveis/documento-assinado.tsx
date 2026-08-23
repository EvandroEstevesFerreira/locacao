"use client";

// Anexo do documento assinado — o papel de volta ao sistema.
//
// Fecha o ciclo do módulo: o Loca gera o PDF, a obra imprime, colhe assinatura
// e digitaliza. Sem este componente, a última etapa terminava numa gaveta, que
// é exatamente o problema que originou o módulo. `documento_path` existe nas
// três tabelas desde as migrations 0044 e 0045, esperando por isto.
//
// O upload vai do navegador DIRETO para o Storage, como no
// `ImovelAnexoUploader`. Passar o arquivo por server action o faria trafegar
// pelo limite de corpo da action e ocupar memória da função à toa; a server
// action recebe só o caminho.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileCheck2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  salvarDocumentoAssinado,
  removerDocumentoAssinado,
  type EntidadeDocumento,
} from "./actions";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";

/** Nome de arquivo seguro para chave do Storage, preservando a extensão. */
function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export function DocumentoAssinado({
  entidade,
  registroId,
  imovelId,
  orgId,
  url,
  podeEditar,
}: {
  entidade: EntidadeDocumento;
  registroId: string;
  imovelId: string;
  orgId: string;
  /** URL assinada do digitalizado, quando já existe. */
  url: string | null;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function enviar(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setEnviando(true);
    const supabase = createClient();
    try {
      // A primeira pasta TEM de ser o org_id: a policy `imoveis_obj_insert`
      // (migration 0017) compara `storage.foldername(name)[1]` com a
      // organização da sessão. Qualquer outro prefixo é recusado.
      const uid = crypto.randomUUID();
      const path = `${orgId}/${imovelId}/alojamento/${entidade}-${registroId}-${uid}-${nomeSeguro(file.name)}`;
      const { error } = await supabase.storage
        .from("imoveis")
        .upload(path, file, { upsert: false });
      if (error) {
        toast.error("Falha ao enviar o arquivo.");
        return;
      }
      const r = await salvarDocumentoAssinado(entidade, registroId, imovelId, path);
      if (!r.ok) {
        // O arquivo já subiu; sem a linha no banco ninguém o alcança. Limpa,
        // para não deixar órfão no bucket.
        await supabase.storage.from("imoveis").remove([path]);
        toast.error(r.erro);
        return;
      }
      toast.success("Documento assinado anexado.");
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (url) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          render={<Link href={url} target="_blank" />}
        >
          <FileCheck2 className="size-3.5" aria-hidden />
          Assinado
        </Button>
        {/* Confirmação de propósito: o digitalizado costuma ser a ÚNICA cópia
            com assinatura — o papel volta para a gaveta da obra e o arquivo
            some do Storage junto com a linha. */}
        {podeEditar ? (
          <ConfirmDelete
            action={removerDocumentoAssinado}
            id={registroId}
            hidden={{ entidade, imovel_id: imovelId }}
            mensagem="Remover o documento assinado? O arquivo digitalizado é apagado junto e costuma ser a única cópia com assinatura dentro do sistema."
          />
        ) : null}
      </div>
    );
  }

  if (!podeEditar) return null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => enviar(e.target.files)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" aria-hidden />
        {enviando ? "Enviando…" : "Anexar assinado"}
      </Button>
    </>
  );
}
