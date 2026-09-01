"use client";

// Formulários dos registros do alojamento.
//
// Ambos em react-hook-form: passam de 3 campos e têm validação cruzada de
// verdade — a suspensão exige dias e data de início, e a devolução exige
// tratativa. Regra do AGENTS.md, mesmo caminho do ReparoForm.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  medidaDisciplinarSchema,
  entregaOcupanteSchema,
  TIPOS_MEDIDA,
  TIPO_MEDIDA_INFO,
  TIPOS_ENTREGA,
  TIPO_ENTREGA_INFO,
  MOTIVOS_DEVOLUCAO,
  MOTIVO_DEVOLUCAO_INFO,
  TRATATIVAS,
  TRATATIVA_INFO,
  CIENCIAS,
  CIENCIA_INFO,
  REGRAS_POLITICA,
  ITENS_PADRAO,
  type MedidaDisciplinarInput,
  type MedidaDisciplinarDados,
  type EntregaOcupanteInput,
  type EntregaOcupanteDados,
  type TipoEntrega,
} from "@/lib/alojamento";
import { salvarMedidaDisciplinar, salvarEntregaOcupante } from "./actions";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

type Ocupante = { id: string; nome: string };

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return <p className="text-xs text-destructive">{mensagem}</p>;
}

export function MedidaForm({
  imovelId,
  ocupantes,
}: {
  imovelId: string;
  ocupantes: Ocupante[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const vazio: MedidaDisciplinarInput = {
    ocupante_id: ocupantes[0]?.id ?? "",
    imovel_id: imovelId,
    data: "",
    tipo: "escrita",
    suspensao_dias: "",
    suspensao_inicio: "",
    suspensao_fim: "",
    fato_em: "",
    fato_local: "",
    fato_descricao: "",
    testemunhas: "",
    regras_violadas: [],
    clt_artigo: "",
    reincidencia: false,
    fundamentacao: "",
    ciencia: "",
    ciencia_em: "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<MedidaDisciplinarInput, unknown, MedidaDisciplinarDados>({
    resolver: zodResolver(medidaDisciplinarSchema),
    defaultValues: vazio,
  });

  // `useWatch` em vez de `watch`: o segundo não é memoizável e o lint acusa.
  const tipo = useWatch({ control, name: "tipo" });

  function onSubmit(values: MedidaDisciplinarDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarMedidaDisciplinar(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Medida disciplinar registrada.");
      reset(vazio);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-4">
      <input type="hidden" {...register("imovel_id")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="md_ocupante">Alojado</Label>
          <NativeSelect id="md_ocupante" disabled={pendente} {...register("ocupante_id")}>
            {ocupantes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </NativeSelect>
          <Erro mensagem={errors.ocupante_id?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="md_data">Data da medida</Label>
          <Input id="md_data" type="date" disabled={pendente} {...register("data")} />
          <Erro mensagem={errors.data?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="md_tipo">Tipo</Label>
          <NativeSelect id="md_tipo" disabled={pendente} {...register("tipo")}>
            {TIPOS_MEDIDA.map((t) => (
              <option key={t} value={t}>
                {TIPO_MEDIDA_INFO[t].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {tipo === "suspensao" ? (
        <div className="grid gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="md_dias">Dias de suspensão</Label>
            <Input
              id="md_dias"
              type="number"
              min="1"
              max="30"
              disabled={pendente}
              {...register("suspensao_dias")}
            />
            <Erro mensagem={errors.suspensao_dias?.message} />
            <p className="text-xs text-muted-foreground">
              Máximo de 30 dias (CLT, art. 474).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md_inicio">Início</Label>
            <Input id="md_inicio" type="date" disabled={pendente} {...register("suspensao_inicio")} />
            <Erro mensagem={errors.suspensao_inicio?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md_fim">Fim</Label>
            <Input id="md_fim" type="date" disabled={pendente} {...register("suspensao_fim")} />
            <Erro mensagem={errors.suspensao_fim?.message} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="md_fato_em">Data e hora do fato</Label>
          <Input id="md_fato_em" type="datetime-local" disabled={pendente} {...register("fato_em")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="md_local">Local</Label>
          <Input id="md_local" disabled={pendente} {...register("fato_local")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="md_descricao">Descrição objetiva do fato</Label>
        <Textarea
          id="md_descricao"
          rows={4}
          placeholder="O que aconteceu, como e em que circunstâncias."
          disabled={pendente}
          {...register("fato_descricao")}
        />
        <Erro mensagem={errors.fato_descricao?.message} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Regra descumprida</legend>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {REGRAS_POLITICA.map((r) => (
            <label key={r.chave} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={r.chave}
                disabled={pendente}
                {...register("regras_violadas")}
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="md_clt">Alínea do art. 482 (se houver)</Label>
          <Input id="md_clt" placeholder="ex.: b" disabled={pendente} {...register("clt_artigo")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="md_ciencia">Ciência do empregado</Label>
          <NativeSelect id="md_ciencia" disabled={pendente} {...register("ciencia")}>
            <option value="">Ainda não registrada</option>
            {CIENCIAS.map((c) => (
              <option key={c} value={c}>
                {CIENCIA_INFO[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="md_ciencia_em">Data da ciência</Label>
          <Input id="md_ciencia_em" type="date" disabled={pendente} {...register("ciencia_em")} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" disabled={pendente} {...register("reincidencia")} />
          Reincidência nos últimos 12 meses
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="md_fund">Fundamentação da medida</Label>
        <Textarea
          id="md_fund"
          rows={3}
          placeholder="Por que esta penalidade, considerando gravidade, histórico e proporcionalidade."
          disabled={pendente}
          {...register("fundamentacao")}
        />
      </div>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Registrando…
          </>
        ) : (
          "Registrar medida"
        )}
      </Button>
    </form>
  );
}

export function EntregaForm({
  imovelId,
  ocupantes,
}: {
  imovelId: string;
  ocupantes: Ocupante[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const vazio: EntregaOcupanteInput = {
    ocupante_id: ocupantes[0]?.id ?? "",
    imovel_id: imovelId,
    tipo: "chaves",
    entregue_em: "",
    devolvido_em: "",
    devolucao_motivo: "",
    itens: [],
    avarias: "",
    tratativa: "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EntregaOcupanteInput, unknown, EntregaOcupanteDados>({
    resolver: zodResolver(entregaOcupanteSchema),
    defaultValues: vazio,
  });

  const tipo = (useWatch({ control, name: "tipo" }) ?? "chaves") as TipoEntrega;
  const devolvido = useWatch({ control, name: "devolvido_em" });

  function onSubmit(values: EntregaOcupanteDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarEntregaOcupante(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Entrega registrada.");
      reset(vazio);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-4">
      <input type="hidden" {...register("imovel_id")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="en_ocupante">Alojado</Label>
          <NativeSelect id="en_ocupante" disabled={pendente} {...register("ocupante_id")}>
            {ocupantes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </NativeSelect>
          <Erro mensagem={errors.ocupante_id?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="en_tipo">O que foi entregue</Label>
          <NativeSelect id="en_tipo" disabled={pendente} {...register("tipo")}>
            {TIPOS_ENTREGA.map((t) => (
              <option key={t} value={t}>
                {TIPO_ENTREGA_INFO[t].label} ({TIPO_ENTREGA_INFO[t].doc})
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="en_entrega">Data da entrega</Label>
          <Input id="en_entrega" type="date" disabled={pendente} {...register("entregue_em")} />
          <Erro mensagem={errors.entregue_em?.message} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Itens</legend>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {ITENS_PADRAO[tipo].map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={item} disabled={pendente} {...register("itens")} />
              {item}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="en_devolucao">Data da devolução</Label>
          <Input id="en_devolucao" type="date" disabled={pendente} {...register("devolvido_em")} />
          <Erro mensagem={errors.devolvido_em?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="en_motivo">Motivo da devolução</Label>
          <NativeSelect id="en_motivo" disabled={pendente} {...register("devolucao_motivo")}>
            <option value="">—</option>
            {MOTIVOS_DEVOLUCAO.map((m) => (
              <option key={m} value={m}>
                {MOTIVO_DEVOLUCAO_INFO[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="en_tratativa">Tratativa</Label>
          <NativeSelect id="en_tratativa" disabled={pendente} {...register("tratativa")}>
            <option value="">—</option>
            {TRATATIVAS.map((t) => (
              <option key={t} value={t}>
                {TRATATIVA_INFO[t]}
              </option>
            ))}
          </NativeSelect>
          <Erro mensagem={errors.tratativa?.message} />
        </div>
      </div>

      {devolvido ? (
        <div className="space-y-1.5">
          <Label htmlFor="en_avarias">Avarias e faltas</Label>
          <Textarea
            id="en_avarias"
            rows={3}
            placeholder="Descreva com detalhe suficiente para identificação posterior."
            disabled={pendente}
            {...register("avarias")}
          />
        </div>
      ) : null}

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Registrando…
          </>
        ) : (
          "Registrar entrega"
        )}
      </Button>
    </form>
  );
}
