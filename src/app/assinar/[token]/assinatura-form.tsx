"use client";

// O formulário que o funcionário vê no celular.
//
// Sem menu, sem navegação, sem link para o resto do sistema: quem abre isto não
// tem login e não deve descobrir que existe um sistema atrás. A página inteira é
// o documento e o aceite.

import { useState, useTransition } from "react";
import { CircleCheckBig, ShieldCheck } from "lucide-react";
import { assinarPeloLink } from "./actions";
import { apenasDigitos, cpfValido } from "@/lib/assinatura-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** `12345678900` → `123.456.789-00`, enquanto se digita. */
function mascarar(bruto: string): string {
  const d = apenasDigitos(bruto).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function AssinaturaForm({ token }: { token: string }) {
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [assinado, setAssinado] = useState(false);
  const [pendente, startTransition] = useTransition();

  const completo = cpfValido(cpf);

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    startTransition(async () => {
      const r = await assinarPeloLink({ token, cpf, imagem: null });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setAssinado(true);
    });
  }

  if (assinado) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <CircleCheckBig className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">Assinatura registrada.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Você vai receber a sua via em PDF por e-mail assim que o setor concluir
          a entrega. Pode fechar esta página.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Digite o seu <strong>CPF</strong> para confirmar que é você. Ele não
          fica guardado nesta página — serve só para conferir com o cadastro.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cpf">CPF</Label>
        <Input
          id="cpf"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={cpf}
          disabled={pendente}
          onChange={(e) => setCpf(mascarar(e.target.value))}
        />
      </div>

      <Button type="submit" className="w-full" disabled={pendente || !completo}>
        {pendente ? "Registrando…" : "Li e aceito o termo"}
      </Button>

      {/* A recusa por CPF NÃO gasta o link: um dígito trocado não pode custar o
          documento. Por isso o formulário continua aqui depois do erro. */}
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <p className="text-xs text-muted-foreground">
        Ao confirmar, você declara ter recebido os itens listados acima e assume
        a responsabilidade por eles.
      </p>
    </form>
  );
}
