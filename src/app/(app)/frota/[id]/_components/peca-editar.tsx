"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  editarPecaSchema,
  type EditarPecaInput,
  type EditarPecaDados,
} from "@/lib/custodia";
import type { PecaDetalhe } from "@/lib/data/custodia";
import { ESTADOS, ESTADO_INFO } from "@/lib/frota";
import { FormError } from "@/components/shared/form-error";
import { FichaCampos, useFicha } from "./ficha-campos";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { editarPeca } from "../../actions";

/**
 * Cadastro da peça — sem obra e sem situação, de propósito.
 *
 * Esses dois só mudam por Mover e por Baixar/Perder/Restaurar, que passam pelo
 * livro de custódia (`peca-mover.tsx`, `peca-situacao.tsx`). Um formulário de
 * edição com `obra_id` dentro seria a primeira porta a furar a custódia.
 *
 * O bloco de TI aparece por PERFIL da categoria (`perfilCampos === "ti"`), não
 * pelo nome dela — acoplar a exibição a "nome === 'TI'" quebra quando alguém
 * renomeia a categoria para "Tecnologia".
 */
export function PecaEditar({ peca }: { peca: PecaDetalhe }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  // A ficha vive fora do react-hook-form: os campos mudam por configuração, e o
  // RHF precisa conhecer a forma do formulário quando é criado. Ver o cabeçalho
  // de `ficha-campos.tsx`.
  const { ficha, definir } = useFicha(peca.ficha ?? {});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditarPecaInput, unknown, EditarPecaDados>({
    resolver: zodResolver(editarPecaSchema),
    defaultValues: {
      // O `id` vem da peça, nunca de `undefined`: com `undefined` o
      // react-hook-form semeia "" a partir do DOM do campo oculto, e o
      // `uuid()` do schema reprova o submit em silêncio (defeito da 0.39.1).
      id: peca.id,
      identificador: peca.identificador,
      numero_serie: peca.numeroSerie ?? "",
      ano: peca.ano == null ? "" : String(peca.ano),
      estado: peca.estado ?? "",
      observacoes: peca.observacoes ?? "",
      imei: peca.imei ?? "",
      imei_2: peca.imei2 ?? "",
      linha_telefonica: peca.linhaTelefonica ?? "",
      operadora: peca.operadora ?? "",
      service_tag: peca.serviceTag ?? "",
      memoria_gb: peca.memoriaGb == null ? "" : String(peca.memoriaGb),
      configuracao: peca.configuracao ?? "",
      tem_medidor: peca.temMedidor,
    },
  });

  function onSubmit(values: EditarPecaDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await editarPeca({ ...values, ficha });
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Cadastro da peça atualizado.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      <input type="hidden" {...register("id")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="identificador">Patrimônio</Label>
          <Input
            id="identificador"
            maxLength={80}
            aria-invalid={!!errors.identificador}
            disabled={pendente}
            {...register("identificador")}
          />
          {errors.identificador ? (
            <p className="text-xs text-destructive">{errors.identificador.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="numero_serie">
            Número de série{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="numero_serie"
            maxLength={80}
            aria-invalid={!!errors.numero_serie}
            disabled={pendente}
            {...register("numero_serie")}
          />
          {errors.numero_serie ? (
            <p className="text-xs text-destructive">{errors.numero_serie.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ano">
            Ano <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="ano"
            type="number"
            min={1950}
            max={2100}
            aria-invalid={!!errors.ano}
            disabled={pendente}
            {...register("ano")}
          />
          {errors.ano ? <p className="text-xs text-destructive">{errors.ano.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="estado">
            Estado <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <NativeSelect id="estado" disabled={pendente} {...register("estado")}>
            <option value="">Não informado</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_INFO[e].label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="observacoes">
            Observações{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="observacoes"
            rows={3}
            maxLength={300}
            aria-invalid={!!errors.observacoes}
            disabled={pendente}
            {...register("observacoes")}
          />
          {errors.observacoes ? (
            <p className="text-xs text-destructive">{errors.observacoes.message}</p>
          ) : null}
        </div>
      </div>

      {peca.perfilCampos === "ti" ? (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm font-medium">Dados de TI</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="imei">
                IMEI <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="imei"
                maxLength={15}
                aria-invalid={!!errors.imei}
                disabled={pendente}
                {...register("imei")}
              />
              {errors.imei ? (
                <p className="text-xs text-destructive">{errors.imei.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imei_2">
                IMEI 2 <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="imei_2"
                maxLength={15}
                aria-invalid={!!errors.imei_2}
                disabled={pendente}
                {...register("imei_2")}
              />
              {errors.imei_2 ? (
                <p className="text-xs text-destructive">{errors.imei_2.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="linha_telefonica">
                Linha telefônica{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="linha_telefonica"
                maxLength={20}
                aria-invalid={!!errors.linha_telefonica}
                disabled={pendente}
                {...register("linha_telefonica")}
              />
              {errors.linha_telefonica ? (
                <p className="text-xs text-destructive">{errors.linha_telefonica.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="operadora">
                Operadora{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="operadora"
                maxLength={40}
                aria-invalid={!!errors.operadora}
                disabled={pendente}
                {...register("operadora")}
              />
              {errors.operadora ? (
                <p className="text-xs text-destructive">{errors.operadora.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="service_tag">
                Service tag{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="service_tag"
                maxLength={60}
                aria-invalid={!!errors.service_tag}
                disabled={pendente}
                {...register("service_tag")}
              />
              {errors.service_tag ? (
                <p className="text-xs text-destructive">{errors.service_tag.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="memoria_gb">
                Memória (GB){" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="memoria_gb"
                type="number"
                min={1}
                max={1024}
                aria-invalid={!!errors.memoria_gb}
                disabled={pendente}
                {...register("memoria_gb")}
              />
              {errors.memoria_gb ? (
                <p className="text-xs text-destructive">{errors.memoria_gb.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="configuracao">
                Configuração{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="configuracao"
                maxLength={200}
                aria-invalid={!!errors.configuracao}
                disabled={pendente}
                {...register("configuracao")}
              />
              {errors.configuracao ? (
                <p className="text-xs text-destructive">{errors.configuracao.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* A marca que faz a peça aparecer no apontamento de uso. Fica junto do
          cadastro e não numa tela à parte: quem cadastra o gerador sabe, ali,
          que ele tem horímetro. */}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          disabled={pendente}
          {...register("tem_medidor")}
        />
        <span>
          Esta peça tem horímetro
          <span className="block text-xs text-muted-foreground">
            Habilita o lançamento de leituras e a conta de horas trabalhadas —
            que é o que responde “esta máquina está ociosa?” e “quando vence a
            revisão?”.
          </span>
        </span>
      </label>

      {/* Os campos que o TIPO deste item define. Vazio quando o item não tem
          tipo, ou quando o tipo não pede nada além do patrimônio. */}
      {peca.camposDoTipo.length > 0 ? (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Ficha do tipo</p>
            <p className="text-xs text-muted-foreground">
              Definida em Configurações › Categorias e tipos. Muda para cada
              família de equipamento.
            </p>
          </div>
          <FichaCampos
            campos={peca.camposDoTipo}
            ficha={ficha}
            definir={definir}
            desabilitado={pendente}
          />
        </div>
      ) : null}

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
