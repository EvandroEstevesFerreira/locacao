"use client";

// O fechamento — o passo irreversível.
//
// É a primeira vez que uma ação de usuário do Loca comunica um TERCEIRO. Por
// isso a confirmação não é um `confirm()` do navegador: o texto precisa dizer o
// que vai acontecer, para quem, e que não dá para voltar. Quem clica tem de
// saber que um e-mail sai da empresa.
//
// A caixa de ciência é validada TAMBÉM no servidor (`fecharRecebimentoSchema`).
// Confirmação só no cliente é decoração: qualquer requisição forjada passaria
// por cima dela.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { fecharRecebimento } from "../contratos/recebimento-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function FecharRecebimento({
  recebimentoId,
  totalItens,
  comRessalva,
  emailFornecedor,
}: {
  recebimentoId: string;
  totalItens: number;
  comRessalva: number;
  /** Nulo quando o fornecedor não tem e-mail — muda o texto do aviso. */
  emailFornecedor: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    startTransition(async () => {
      const r = await fecharRecebimento({ id: recebimentoId, ciente });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      // `aviso` é o caso "fechou, mas o e-mail não saiu". Toast comum diria
      // "tudo certo" e esconderia a metade que falhou.
      if (r.aviso) toast.warning(r.aviso, { duration: 8000 });
      else toast.success("Recebimento fechado.");
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <Button size="sm" disabled={totalItens === 0} onClick={() => setAberto(true)}>
        <Lock className="size-3.5" aria-hidden />
        Fechar recebimento
      </Button>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="space-y-3 rounded-lg border border-dashed p-4 text-sm"
    >
      <p className="flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Fechar é irreversível.
      </p>

      <ul className="ml-6 list-disc space-y-1 text-muted-foreground">
        <li>
          O recebimento ganha número e <strong>deixa de ser editável</strong>.
        </li>
        <li>
          Os {totalItens} {totalItens === 1 ? "item" : "itens"} viram a data de
          retirada no contrato, que alimenta o cálculo de custo.
        </li>
        <li>
          {emailFornecedor ? (
            <>
              Um e-mail com o romaneio em PDF sai para{" "}
              <strong>{emailFornecedor}</strong>.
            </>
          ) : (
            <>
              O fornecedor <strong>não tem e-mail cadastrado</strong> e não será
              avisado. O recebimento fecha do mesmo jeito.
            </>
          )}
        </li>
        {comRessalva > 0 ? (
          <li>
            {comRessalva} {comRessalva === 1 ? "item vai" : "itens vão"} com
            ressalva de avaria ou divergência — o fornecedor vê isso no romaneio.
          </li>
        ) : null}
      </ul>

      <Label className="flex items-start gap-2 font-normal">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={ciente}
          onChange={(e) => setCiente(e.target.checked)}
          disabled={pendente}
        />
        <span>
          Conferi os itens e estou ciente de que o fechamento não pode ser
          desfeito.
        </span>
      </Label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pendente || !ciente}>
          {pendente ? "Fechando…" : "Confirmar fechamento"}
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
        {erro ? <p className="text-destructive">{erro}</p> : null}
      </div>
    </form>
  );
}
