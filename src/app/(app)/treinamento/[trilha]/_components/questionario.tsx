"use client";

// O questionário: responde, corrige no servidor, e mostra por que errou.
//
// Repare no tipo de `perguntas` abaixo: não há `correta` nem `porque`. É a
// página que monta este array, listando só `id`, `enunciado`, `alternativas`
// e `aula` — o gabarito nunca sai do servidor. O `porque` de uma pergunta
// errada só chega aqui na RESPOSTA da action, depois que a pessoa já
// respondeu, e só para essa pergunta.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { concluirTrilha } from "../../actions";

type PerguntaSemGabarito = {
  id: string;
  enunciado: string;
  alternativas: string[];
  aula: string;
};

type Errada = { perguntaId: string; porque: string; aula: string };

export function Questionario({
  trilhaChave,
  perguntas,
  aulaTitulo,
}: {
  trilhaChave: string;
  perguntas: PerguntaSemGabarito[];
  aulaTitulo: Record<string, string>;
}) {
  const router = useRouter();
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [erradas, setErradas] = useState<Errada[] | null>(null);
  const [pendente, iniciar] = useTransition();

  const faltam = perguntas.filter(
    (p) => respostas[p.id] === undefined,
  ).length;
  const errosPorPergunta = new Map(erradas?.map((e) => [e.perguntaId, e]) ?? []);

  function responder(perguntaId: string, alternativa: number) {
    setRespostas((r) => ({ ...r, [perguntaId]: alternativa }));
  }

  function enviar() {
    setErro(null);

    iniciar(async () => {
      const r = await concluirTrilha({ trilha: trilhaChave, respostas });
      if (r.ok) {
        setErradas(null);
        toast.success(
          "Treinamento concluído. O comprovante está no fim da página.",
        );
        router.refresh();
        return;
      }

      setErro(r.erro);
      setErradas(r.erradas ?? null);
    });
  }

  return (
    <div className="space-y-6">
      {perguntas.map((p, i) => {
        const errada = errosPorPergunta.get(p.id);
        return (
          <fieldset key={p.id} className="space-y-2">
            <legend className="text-sm font-medium">
              {i + 1}. {p.enunciado}
            </legend>
            <div className="space-y-1.5">
              {p.alternativas.map((alt, idx) => {
                const id = `pergunta-${p.id}-${idx}`;
                return (
                  <div key={id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={id}
                      name={`pergunta-${p.id}`}
                      className="size-4"
                      disabled={pendente}
                      checked={respostas[p.id] === idx}
                      onChange={() => responder(p.id, idx)}
                    />
                    <Label htmlFor={id} className="font-normal">
                      {alt}
                    </Label>
                  </div>
                );
              })}
            </div>

            {errada ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <p>{errada.porque}</p>
                <a
                  href={`#aula-${errada.aula}`}
                  className="mt-1 inline-block underline underline-offset-2"
                >
                  Revisar a aula: {aulaTitulo[errada.aula] ?? errada.aula}
                </a>
              </div>
            ) : null}
          </fieldset>
        );
      })}

      <FormError>{erro}</FormError>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {faltam === 0
            ? null
            : `Falta responder ${faltam} ${faltam === 1 ? "pergunta" : "perguntas"}.`}
        </p>
        <Button
          type="button"
          disabled={pendente || faltam > 0}
          onClick={enviar}
        >
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CircleCheck className="size-4" />
          )}
          {pendente
            ? "Enviando…"
            : erradas
              ? "Tentar de novo"
              : "Enviar respostas"}
        </Button>
      </div>
    </div>
  );
}
