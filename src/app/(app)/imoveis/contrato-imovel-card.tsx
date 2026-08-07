"use client";

import { useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContratoImovelForm,
  type ContratoImovelExistente,
} from "./contrato-imovel-form";

/**
 * Card de um contrato do imóvel. Alterna entre a visão de leitura
 * (`children`, renderizada no servidor com URLs assinadas dos anexos) e o
 * formulário de edição, reaproveitando o mesmo `ContratoImovelForm` do cadastro.
 */
export function ContratoImovelCard({
  imovelId,
  contrato,
  dataLabel,
  vigente,
  podeEditar,
  deleteSlot,
  children,
}: {
  imovelId: string;
  contrato: ContratoImovelExistente;
  dataLabel: string;
  vigente: boolean;
  podeEditar: boolean;
  deleteSlot?: ReactNode;
  children: ReactNode;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <div className="border border-border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Editar contrato — {dataLabel}</span>
          <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
        <ContratoImovelForm
          imovelId={imovelId}
          contrato={contrato}
          onDoneLabel="Salvar alterações"
        />
      </div>
    );
  }

  return (
    <div className="border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{dataLabel}</span>
          {vigente ? <Badge>Vigente</Badge> : null}
        </div>
        {podeEditar ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
              <Pencil className="size-4" /> Editar
            </Button>
            {deleteSlot}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
