"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_OBRA,
  STATUS_OBRA_INFO,
  obraSchema,
  type ObraDados,
  type ObraInput,
  type StatusObra,
} from "@/lib/obra";
import {
  TIPO_CENTRO_CUSTO,
  TIPO_CENTRO_CUSTO_INFO,
  aceitaControleDeObra,
  type TipoCentroCusto,
} from "@/lib/centro-custo";
import type { ObraOpcao } from "@/lib/data/obras";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarObra } from "./actions";

type Obra = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  responsavel: string | null;
  centro_custo: string | null;
  status: StatusObra;
  tipo: TipoCentroCusto;
  pai_id: string | null;
  destinatarios_alerta: string[] | null;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  data_fim_real: string | null;
};

export function ObraForm({
  obra,
  vinculados = [],
  paisPossiveis = [],
}: {
  obra?: Obra;
  /** E-mails que já recebem por estarem vinculados à obra. Só para exibir. */
  vinculados?: string[];
  /** Departamentos de raiz que podem ser pai — já sem o próprio registro. */
  paisPossiveis?: ObraOpcao[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    // Três parâmetros de tipo porque o schema TRANSFORMA: os campos opcionais
    // viram `null` na saída (ver textoOpcional em src/lib/obra.ts). Entrada é o
    // que o formulário guarda, saída é o que a action recebe — sem os três, o
    // TypeScript reclama que os Resolver são "dois tipos diferentes com o mesmo
    // nome".
  } = useForm<ObraInput, unknown, ObraDados>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      id: obra?.id,
      tipo: obra?.tipo ?? "obra",
      pai_id: obra?.pai_id ?? "",
      codigo: obra?.codigo ?? "",
      nome: obra?.nome ?? "",
      endereco: obra?.endereco ?? "",
      responsavel: obra?.responsavel ?? "",
      centro_custo: obra?.centro_custo ?? "",
      status: obra?.status ?? "ativa",
      destinatarios_alerta: (obra?.destinatarios_alerta ?? []).join("\n"),
    },
  });

  // O tipo comanda metade do formulário, então é lido do estado e não da prop:
  // na criação ele muda enquanto a pessoa preenche.
  // `useWatch` e não `watch()`: o `watch` do useForm devolve função nova a cada
  // render, que o React Compiler não consegue memoizar — ele desiste de
  // compilar o componente inteiro e avisa. `useWatch` é a forma que assina o
  // campo sem esse efeito.
  const tipo = (useWatch({ control, name: "tipo" }) ?? "obra") as TipoCentroCusto;
  const ehObra = aceitaControleDeObra(tipo);
  const ehDepartamento = !ehObra;

  function onSubmit(values: ObraDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarObra(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(
        obra ? "Centro de custo atualizado." : "Centro de custo cadastrado.",
      );
      router.replace("/obras");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      {/* Num cadastro novo este input manda `""`, e o schema TEM de aceitar —
          ver `idOpcional` em @/lib/campos. */}
      <input type="hidden" {...register("id")} />

      {/* O TIPO é escolhido uma vez e nunca mais. Converter um centro de custo
          que já tem custódia, lançamento e termo emitido não é um `update` numa
          coluna — é migração de dados. O trigger da migration 0114 recusa a
          troca; aqui o campo simplesmente não é oferecido na edição. */}
      {obra ? (
        <input type="hidden" {...register("tipo")} />
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="tipo">Tipo</Label>
          <NativeSelect id="tipo" disabled={pendente} {...register("tipo")}>
            {TIPO_CENTRO_CUSTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_CENTRO_CUSTO_INFO[t].label}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {TIPO_CENTRO_CUSTO_INFO[tipo].descricao} O tipo não pode ser alterado depois.
          </p>
        </div>
      )}

      {ehDepartamento ? (
        <div className="space-y-1.5">
          <Label htmlFor="pai_id">
            Departamento superior{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <NativeSelect id="pai_id" disabled={pendente} {...register("pai_id")}>
            <option value="">Nenhum — é um departamento de primeiro nível</option>
            {paisPossiveis.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nome}
              </option>
            ))}
          </NativeSelect>
          {errors.pai_id ? (
            <p className="text-xs text-destructive">{errors.pai_id.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              A hierarquia tem dois níveis: um setor não recebe outro setor.
            </p>
          )}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          {/* Sem o "*": quem diz que o campo falta é o zod, com a mensagem
              embaixo do próprio campo — é a razão de existir da migração. */}
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            placeholder={ehDepartamento ? "Ex.: 810" : "Ex.: OB-001"}
            aria-invalid={!!errors.codigo}
            disabled={pendente}
            {...register("codigo")}
          />
          {errors.codigo ? (
            <p className="text-xs text-destructive">{errors.codigo.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" disabled={pendente} {...register("status")}>
            {/* Departamento não pausa: ele existe ou foi extinto. "Pausada"
                descreve obra cujo contrato parou, e o CHECK da 0114 a recusa. */}
            {STATUS_OBRA.filter((s) => ehObra || s !== "pausada").map((s) => (
              <option key={s} value={s}>
                {STATUS_OBRA_INFO[s].label}
              </option>
            ))}
          </NativeSelect>
          {errors.status ? (
            <p className="text-xs text-destructive">{errors.status.message}</p>
          ) : null}
        </div>
      </div>

      {/* O período alimenta o "% de prazo decorrido" no acompanhamento da obra.
          Todas opcionais: nenhuma obra cadastrada tem estas datas. Departamento
          não tem prazo — não "atrasa" —, então o bloco não existe para ele. */}
      {ehObra ? (
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_inicio">Início da obra</Label>
          <Input
            id="data_inicio"
            type="date"
            disabled={pendente}
            {...register("data_inicio")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_fim_prevista">Fim previsto</Label>
          <Input
            id="data_fim_prevista"
            type="date"
            aria-invalid={!!errors.data_fim_prevista}
            disabled={pendente}
            {...register("data_fim_prevista")}
          />
          {errors.data_fim_prevista ? (
            <p className="text-xs text-destructive">
              {errors.data_fim_prevista.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_fim_real">
            Fim real{" "}
            <span className="font-normal text-muted-foreground">
              (no encerramento)
            </span>
          </Label>
          <Input
            id="data_fim_real"
            type="date"
            disabled={pendente}
            {...register("data_fim_real")}
          />
        </div>
      </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          placeholder={ehDepartamento ? "Ex.: Recursos Humanos" : "Ex.: Edifício Aurora"}
          aria-invalid={!!errors.nome}
          disabled={pendente}
          {...register("nome")}
        />
        {errors.nome ? (
          <p className="text-xs text-destructive">{errors.nome.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="endereco">
          Endereço{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="endereco" disabled={pendente} {...register("endereco")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="responsavel">
            Responsável{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="responsavel" disabled={pendente} {...register("responsavel")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="centro_custo">
            Centro de custo{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="centro_custo"
            disabled={pendente}
            {...register("centro_custo")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="destinatarios_alerta">
          E-mails extras para avisos{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="destinatarios_alerta"
          rows={3}
          disabled={pendente}
          placeholder={"mestre.obra@terceirizada.com.br\nalmoxarifado@obra.com.br"}
          aria-invalid={!!errors.destinatarios_alerta}
          {...register("destinatarios_alerta")}
        />
        {errors.destinatarios_alerta ? (
          <p className="text-xs text-destructive">
            {errors.destinatarios_alerta.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Um por linha. Use apenas para quem <strong>não tem login</strong> no
          Loca — quem está vinculado à obra já recebe automaticamente.
        </p>
        {/* Mostrar quem já é coberto evita o erro mais provável: digitar de
            novo endereços que o vínculo com a obra já entrega. */}
        {vinculados.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Já recebem por estarem vinculados a esta obra:{" "}
            <span className="text-foreground">{vinculados.join(", ")}</span>.
          </p>
        ) : obra ? (
          <p className="text-xs text-muted-foreground">
            Nenhum usuário está vinculado a esta obra. Sem e-mails extras, os
            avisos dela vão só para a lista central.
          </p>
        ) : null}
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" render={<Link href="/obras" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
