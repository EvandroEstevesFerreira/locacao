"use client";

// O mutirão de custódia: o que a planilha diz, quem é essa pessoa no cadastro,
// e o termo que registra a posse.
//
// POR QUE EMITE TERMO EM VEZ DE GRAVAR CUSTÓDIA. A primeira versão desta tela
// tinha "Registrar 88 custódias" e falhava em todas: o check
// `custodia_funcionario_exige_termo` (migration 0059) recusa posse de
// funcionário sem termo, com o motivo escrito ao lado — "o valor do termo é
// justamente ser a única fonte de verdade sobre quem respondeu pelo
// equipamento". `moverPeca` sempre respeitou isso; `custodia.ts` registra que
// "funcionario NÃO está entre os destinos".
//
// A invariante está certa, e o caminho é o termo. Emitir sem colher assinatura
// na hora só ficou possível na 0.96.0 — antes dela, regularizar 95 peças
// exigiria 95 pessoas assinando na tela.
//
// A REGRA DA TELA: nada é emitido sem eu ter visto. As propostas automáticas vêm
// marcadas, as ambíguas vêm com um seletor e DESMARCADAS, e as que não casaram
// vêm com o cadastro inteiro. Marcar o ambíguo por padrão seria pedir
// confirmação de algo que a pessoa não leu.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { PropostaMutirao } from "@/lib/data/custodia";
import { emitirTermosDoMutirao } from "../actions";
import { FormError } from "@/components/shared/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

/** Peças por rodada. Espelha o `max` de `mutiraoTermosSchema`: cada termo gera
 *  um PDF e um e-mail, e cinquenta numa requisição estouraria o tempo da
 *  função — deixando metade emitida sem ninguém saber quais. */
const POR_RODADA = 12;

type Funcionario = { id: string; nome: string; cpf: string | null; email: string | null };

/** Como distinguir duas fichas com o MESMO nome (há 8 casos no cadastro). */
function distintivo(f: Funcionario): string {
  if (f.cpf) return `CPF ${f.cpf}`;
  if (f.email) return f.email;
  return "sem CPF nem e-mail";
}

export function MutiraoForm({
  propostas,
  funcionarios,
}: {
  propostas: PropostaMutirao[];
  funcionarios: Funcionario[];
}) {
  // Escolha por peça. Vazio = sem pessoa definida.
  const [escolha, setEscolha] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const p of propostas) {
      // Só o que casou com CERTEZA vem preenchido. Ambíguo e sem casamento
      // ficam em branco de propósito: confirmar o que não se leu é adivinhar.
      if (p.casamento.tipo === "exato" || p.casamento.tipo === "unico") {
        inicial[p.unidadeId] = p.casamento.funcionario.id;
      }
    }
    return inicial;
  });

  const definidas = useMemo(
    () => Object.values(escolha).filter((v) => v !== "").length,
    [escolha],
  );

  const porId = useMemo(
    () => new Map(funcionarios.map((f) => [f.id, f])),
    [funcionarios],
  );

  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function emitir() {
    setErro(null);
    const pares = Object.entries(escolha)
      .filter(([, funcionarioId]) => funcionarioId !== "")
      .slice(0, POR_RODADA)
      .map(([unidade_id, funcionario_id]) => ({ unidade_id, funcionario_id }));
    if (pares.length === 0) return setErro("Nenhuma peça com pessoa definida.");

    iniciar(async () => {
      const r = await emitirTermosDoMutirao({ pares });
      if (!r.ok) return setErro(r.erro);
      toast.success(r.aviso ?? "Termos emitidos.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-2 font-medium">Peça</th>
              <th className="p-2 font-medium">Na planilha</th>
              <th className="p-2 font-medium">Funcionário no cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {propostas.map((p) => {
              const c = p.casamento;
              const automatico = c.tipo === "exato" || c.tipo === "unico";
              // Ambíguo oferece só os candidatos; o resto oferece o cadastro
              // inteiro. Filtrar demais faria a pessoa não achar quem procura.
              const opcoes =
                c.tipo === "ambiguo"
                  ? c.candidatos.map((x) => porId.get(x.id)!).filter(Boolean)
                  : funcionarios;
              const escolhido = escolha[p.unidadeId] ?? "";
              return (
                <tr key={p.unidadeId}>
                  <td className="p-2 align-top">
                    <span className="font-mono font-medium">{p.identificador}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.itemDescricao}
                      {p.obraRotulo ? ` · ${p.obraRotulo}` : ""}
                    </span>
                  </td>
                  <td className="p-2 align-top">
                    {p.nomeNoTexto}
                    <span className="mt-1 block">
                      {automatico ? (
                        <Badge variant="secondary">
                          {c.tipo === "exato" ? "Nome idêntico" : "Casou"}
                        </Badge>
                      ) : c.tipo === "ambiguo" ? (
                        <Badge variant="outline">
                          {c.candidatos.length} candidatos — escolha
                        </Badge>
                      ) : (
                        <Badge variant="outline">Não casou — escolha à mão</Badge>
                      )}
                    </span>
                  </td>
                  <td className="p-2 align-top">
                    <NativeSelect
                      value={escolhido}
                      aria-label={`Funcionário de ${p.identificador}`}
                      onChange={(e) =>
                        setEscolha((a) => ({ ...a, [p.unidadeId]: e.target.value }))
                      }
                    >
                      <option value="">Sem pessoa definida</option>
                      {opcoes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                          {c.tipo === "ambiguo" ? ` — ${distintivo(f)}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Registrar quem está com a peça é <strong>emitir o termo de
          responsabilidade</strong> — é ele que cria a posse, por decisão de
          projeto: o termo é a única fonte de verdade sobre quem respondeu pelo
          equipamento. Cada funcionário recebe um termo com as peças dele, a via
          em PDF e o link para assinar; sem assinatura, o sistema cobra a cada 3
          dias.
          <strong className="mt-1 block">
            Só funciona com o modo de teste de e-mail ligado. Com ele, as vias
            vão todas para a caixa de teste em vez de para os funcionários — e o
            servidor recusa a emissão se ele estiver desligado.
          </strong>
        </span>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pendente || definidas === 0}
          onClick={emitir}
        >
          {pendente ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Emitindo…
            </>
          ) : (
            <>
              <FileSignature className="size-4" aria-hidden />
              Emitir {Math.min(definidas, POR_RODADA)}{" "}
              {Math.min(definidas, POR_RODADA) === 1 ? "termo" : "termos"}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {definidas} com pessoa definida
          {definidas > POR_RODADA
            ? ` · ${POR_RODADA} por rodada, clique de novo até zerar`
            : ""}
          {propostas.length - definidas > 0
            ? ` · ${propostas.length - definidas} sem pessoa, ficam de fora`
            : ""}
        </p>
      </div>
    </div>
  );
}
