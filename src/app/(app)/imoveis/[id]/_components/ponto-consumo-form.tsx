"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { TIPOS_CONSUMO, tipoConsumoLabel } from "@/lib/imoveis";
import { salvarPontoConsumo } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * As concessionárias que já aparecem no contas a pagar da Sistenge, medidas em
 * 11/09/2026 sobre os 803 títulos do tipo CONTA.
 *
 * A LISTA É UM ATALHO, NÃO UMA TRAVA: o campo aceita qualquer código, porque
 * imóvel novo em cidade nova traz concessionária nova, e travar a lista faria o
 * cadastro parar até alguém mexer no código.
 */
const CONCESSIONARIAS = [
  { codigo: "2719", nome: "CPFL" },
  { codigo: "2726", nome: "SABESP" },
  { codigo: "2721", nome: "DESKTOP" },
  { codigo: "3187", nome: "NET GALILEU" },
  { codigo: "3036", nome: "BRK AMBIENTAL" },
];

export function PontoConsumoForm({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<string>("luz");
  const [identificador, setIdentificador] = useState("");
  const [concessionaria, setConcessionaria] = useState("");
  const [pendente, startTransition] = useTransition();

  if (!aberto) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Plus className="size-4" aria-hidden />
        Adicionar código
      </Button>
    );
  }

  const escolhida = CONCESSIONARIAS.find((c) => c.codigo === concessionaria);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pc-tipo">Tipo</Label>
          <select
            id="pc-tipo"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            disabled={pendente}
          >
            {TIPOS_CONSUMO.map((t) => (
              <option key={t} value={t}>
                {tipoConsumoLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pc-id">Instalação / RGI</Label>
          <Input
            id="pc-id"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            placeholder="3022287"
            disabled={pendente}
            inputMode="numeric"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pc-conc">Concessionária</Label>
          <select
            id="pc-conc"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={concessionaria}
            onChange={(e) => setConcessionaria(e.target.value)}
            disabled={pendente}
          >
            <option value="">Selecione…</option>
            {CONCESSIONARIAS.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Copie o número como está impresso na conta — só os dígitos. É o mesmo
        número que o financeiro põe no campo Documento ao lançar no Mega.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pendente}
          onClick={() =>
            startTransition(async () => {
              const r = await salvarPontoConsumo({
                imovel_id: imovelId,
                tipo,
                identificador,
                concessionaria_codigo_mega: concessionaria || null,
                concessionaria_nome: escolhida?.nome ?? null,
                ativo: true,
                observacoes: null,
              });
              if (!r.ok) {
                toast.error(r.erro);
                return;
              }
              toast.success("Código cadastrado.");
              setIdentificador("");
              setAberto(false);
              router.refresh();
            })
          }
        >
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendente}
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
