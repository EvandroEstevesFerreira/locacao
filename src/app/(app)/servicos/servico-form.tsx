"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIA_SERVICO,
  CATEGORIA_SERVICO_INFO,
  servicoSchema,
  type ServicoDados,
  type ServicoInput,
} from "@/lib/servicos";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { formatarBRL } from "@/lib/locacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarServico } from "./actions";

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  fornecedor_id: string;
  quantidade: number;
  valor_unitario_centavos: number;
  cadencia: string;
  data_inicio: string;
  data_fim: string | null;
  renova_automaticamente: boolean;
  conferido_em: string | null;
  status: string;
  observacoes: string | null;
};

export function ServicoForm({
  servico,
  fornecedores,
}: {
  servico?: Servico;
  fornecedores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    // Três parâmetros de tipo porque o schema TRANSFORMA: os opcionais viram
    // `null` na saída. Entrada é o que o formulário guarda, saída é o que a
    // action recebe.
  } = useForm<ServicoInput, unknown, ServicoDados>({
    resolver: zodResolver(servicoSchema),
    defaultValues: {
      id: servico?.id,
      nome: servico?.nome ?? "",
      categoria: (servico?.categoria as ServicoInput["categoria"]) ?? "licenca",
      fornecedor_id: servico?.fornecedor_id ?? "",
      quantidade: servico?.quantidade ?? 1,
      valor_unitario_centavos: servico?.valor_unitario_centavos ?? 0,
      cadencia: (servico?.cadencia as ServicoInput["cadencia"]) ?? "mensal",
      data_inicio: servico?.data_inicio ?? "",
      data_fim: servico?.data_fim ?? "",
      renova_automaticamente: servico?.renova_automaticamente ?? true,
      conferido_em: servico?.conferido_em ?? "",
      status: (servico?.status as ServicoInput["status"]) ?? "ativo",
      observacoes: servico?.observacoes ?? "",
    },
  });

  // `useWatch` e não `watch()`: o `watch` do useForm devolve função nova a cada
  // render, o React Compiler desiste de memoizar o componente inteiro e o lint
  // acusa `react-hooks/incompatible-library`.
  const quantidade = Number(useWatch({ control, name: "quantidade" }) ?? 0);
  const unitario = Number(useWatch({ control, name: "valor_unitario_centavos" }) ?? 0);
  const renova = useWatch({ control, name: "renova_automaticamente" });
  const total = quantidade * unitario;

  function onSubmit(values: ServicoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarServico(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(servico ? "Serviço atualizado." : "Serviço cadastrado.");
      router.replace("/servicos");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
      className="space-y-5"
    >
      <input type="hidden" {...register("id")} />

      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome do serviço</Label>
        <Input
          id="nome"
          placeholder="Ex.: Microsoft 365 Business Premium"
          aria-invalid={!!errors.nome}
          disabled={pendente}
          {...register("nome")}
        />
        {errors.nome ? (
          <p className="text-xs text-destructive">{errors.nome.message}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="categoria">Categoria</Label>
          <NativeSelect id="categoria" disabled={pendente} {...register("categoria")}>
            {CATEGORIA_SERVICO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_SERVICO_INFO[c].label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fornecedor_id">Fornecedor</Label>
          <NativeSelect
            id="fornecedor_id"
            disabled={pendente}
            aria-invalid={!!errors.fornecedor_id}
            {...register("fornecedor_id")}
          >
            <option value="">Selecione…</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </NativeSelect>
          {errors.fornecedor_id ? (
            <p className="text-xs text-destructive">{errors.fornecedor_id.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="quantidade">Licenças contratadas</Label>
          <Input
            id="quantidade"
            type="number"
            min={1}
            step={1}
            aria-invalid={!!errors.quantidade}
            disabled={pendente}
            {...register("quantidade")}
          />
          {errors.quantidade ? (
            <p className="text-xs text-destructive">{errors.quantidade.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="valor_unitario_centavos">
            Valor de UMA licença{" "}
            <span className="font-normal text-muted-foreground">(em centavos)</span>
          </Label>
          <Input
            id="valor_unitario_centavos"
            type="number"
            min={0}
            step={1}
            aria-invalid={!!errors.valor_unitario_centavos}
            disabled={pendente}
            {...register("valor_unitario_centavos")}
          />
          {errors.valor_unitario_centavos ? (
            <p className="text-xs text-destructive">
              {errors.valor_unitario_centavos.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              R$ 70,00 são 7000. O valor é guardado em centavos para o rateio
              fechar ao centavo.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cadencia">Cobrança</Label>
          <NativeSelect id="cadencia" disabled={pendente} {...register("cadencia")}>
            <option value="mensal">Mensal</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="semanal">Semanal</option>
            <option value="diaria">Diária</option>
          </NativeSelect>
        </div>
      </div>

      {/* O total é o que o rateio divide. Mostrá-lo aqui evita a descoberta
          tardia de que alguém digitou o valor do contrato inteiro no campo
          unitário — erro que multiplicaria o custo pela quantidade. */}
      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
        Total do período:{" "}
        <strong className="tabular-nums">{formatarBRL(total / 100)}</strong>{" "}
        <span className="text-muted-foreground">
          ({quantidade} × {formatarBRL(unitario / 100)})
        </span>
      </p>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_inicio">Início da vigência</Label>
          <Input
            id="data_inicio"
            type="date"
            aria-invalid={!!errors.data_inicio}
            disabled={pendente}
            {...register("data_inicio")}
          />
          {errors.data_inicio ? (
            <p className="text-xs text-destructive">{errors.data_inicio.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_fim">
            Fim da vigência{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="data_fim"
            type="date"
            aria-invalid={!!errors.data_fim}
            disabled={pendente}
            {...register("data_fim")}
          />
          {errors.data_fim ? (
            <p className="text-xs text-destructive">{errors.data_fim.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Em branco = vigência indeterminada, e sem aviso de renovação.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="conferido_em">
            Conferido em{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="conferido_em"
            type="date"
            disabled={pendente}
            {...register("conferido_em")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            disabled={pendente}
            {...register("renova_automaticamente")}
          />
          Renova automaticamente
        </label>
        <p className="text-xs text-muted-foreground">
          {renova
            ? "O aviso vai cobrar a decisão de cancelar antes que o contrato se renove sozinho."
            : "O aviso vai cobrar a decisão de renovar antes que o contrato vença."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <NativeSelect id="status" disabled={pendente} {...register("status")}>
          <option value="ativo">Ativo</option>
          <option value="encerrado">Encerrado</option>
          <option value="cancelado">Cancelado</option>
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea id="observacoes" rows={3} disabled={pendente} {...register("observacoes")} />
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {servico ? "Salvar" : "Cadastrar"}
        </Button>
        <Button variant="ghost" render={<Link href="/servicos" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
