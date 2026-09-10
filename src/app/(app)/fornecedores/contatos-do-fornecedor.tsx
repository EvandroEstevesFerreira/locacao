"use client";

// Os contatos do fornecedor: vários, com cargo, e um principal.
//
// Componente próprio para o `fornecedor-form.tsx` não virar um muro — ele já
// carrega nome, CNPJ, código do Mega, e-mail, observações e o vínculo com obras.
//
// O PRINCIPAL É UM RADIO, e não um checkbox por linha. O banco garante um só
// (`idx_fornecedor_contato_principal`, índice único parcial), e um checkbox por
// linha convidaria a marcar dois — reprovando no salvamento, depois de a pessoa
// ter preenchido tudo. O radio deixa a regra visível antes do erro.
//
// O telefone é formatado ao SAIR do campo, e não a cada tecla: máscara que
// reposiciona o cursor no meio da digitação é a diferença entre ajudar e
// atrapalhar. Quem digita "11947071104" vê "+55 (11) 94707-1104" quando termina.

import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { Plus, X } from "lucide-react";
import type { FornecedorInput } from "@/lib/fornecedor";
import { formatarTelefone } from "@/lib/telefone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContatosDoFornecedor({
  control,
  register,
  pendente,
  setValue,
}: {
  control: Control<FornecedorInput>;
  register: UseFormRegister<FornecedorInput>;
  pendente: boolean;
  setValue: UseFormSetValue<FornecedorInput>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "contatos" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Contatos</p>
          <p className="text-xs text-muted-foreground">
            Quem atender pelo fornecedor. O principal é quem se procura primeiro
            — o romaneio continua indo para o e-mail da empresa, acima.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendente}
          onClick={() =>
            append({
              nome: "",
              cargo: "",
              telefone: "",
              // O PRIMEIRO da lista nasce principal; os seguintes, não. Sem
              // isso, fornecedor com um contato só ficaria sem principal e a
              // lista não teria a quem apontar.
              principal: fields.length === 0,
            })
          }
        >
          <Plus className="size-3.5" aria-hidden />
          Adicionar contato
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Nenhum contato cadastrado. Sem contato, sobra o e-mail da empresa — que
          serve para o documento, não para resolver um problema por telefone.
        </p>
      ) : (
        <ul className="space-y-3">
          {fields.map((campo, i) => (
            <li key={campo.id} className="rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={`contato_nome_${i}`}>Nome</Label>
                  <Input
                    id={`contato_nome_${i}`}
                    disabled={pendente}
                    {...register(`contatos.${i}.nome`)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`contato_cargo_${i}`}>
                    Cargo{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id={`contato_cargo_${i}`}
                    placeholder="Comercial, faturamento…"
                    disabled={pendente}
                    {...register(`contatos.${i}.cargo`)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`contato_tel_${i}`}>
                    Telefone{" "}
                    <span className="font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id={`contato_tel_${i}`}
                    inputMode="tel"
                    placeholder="+55 (11) 94707-1104"
                    disabled={pendente}
                    {...register(`contatos.${i}.telefone`, {
                      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                        const bonito = formatarTelefone(e.target.value);
                        if (bonito !== null) {
                          setValue(`contatos.${i}.telefone`, bonito);
                        }
                      },
                    })}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover contato ${i + 1}`}
                  disabled={pendente}
                  onClick={() => remove(i)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>

              <Label className="mt-3 flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  className="size-4"
                  // Mesmo `name` em todas as linhas: é o que faz o navegador
                  // desmarcar a anterior sozinho, sem estado nosso.
                  {...register(`contatos.${i}.principal`)}
                  name="contato_principal"
                  disabled={pendente}
                  onChange={() => {
                    // O radio nativo só informa quem foi marcado; quem
                    // DESMARCA os outros no formulário é isto. Sem o laço, duas
                    // linhas chegariam com `principal: true` e o índice único
                    // do banco reprovaria o salvamento inteiro.
                    fields.forEach((_, j) => {
                      setValue(`contatos.${j}.principal`, j === i);
                    });
                  }}
                />
                <span className="text-sm">Contato principal</span>
              </Label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
