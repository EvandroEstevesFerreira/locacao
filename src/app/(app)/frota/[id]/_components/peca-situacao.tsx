"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArchiveX } from "lucide-react";
import { toast } from "sonner";

import { transicoesManuais, SITUACAO_INFO, type Situacao } from "@/lib/frota";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { mudarSituacao } from "../../actions";

export function PecaSituacao({ pecaId, atual }: { pecaId: string; atual: Situacao }) {
  const router = useRouter();
  const destinos = transicoesManuais(atual);
  const [para, setPara] = useState<string>(destinos[0] ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (destinos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nesta situação a peça não muda por aqui. Peça em uso volta pela
        devolução do termo — alguém assinou por ela.
      </p>
    );
  }

  function aplicar() {
    setErro(null);
    iniciar(async () => {
      const fd = new FormData();
      fd.set("id", pecaId);
      fd.set("situacao", para);
      const r = await mudarSituacao(fd);
      if (!r.ok) return setErro(r.erro);
      toast.success("Situação da peça atualizada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="nova_situacao">Nova situação</Label>
        <NativeSelect
          id="nova_situacao"
          value={para}
          disabled={pendente}
          onChange={(e) => setPara(e.target.value)}
        >
          {destinos.map((d) => (
            <option key={d} value={d}>
              {SITUACAO_INFO[d].label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled={pendente} onClick={aplicar}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArchiveX className="size-4" />
          )}
          {pendente ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
