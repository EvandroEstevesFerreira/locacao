"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck, Lock } from "lucide-react";
import { toast } from "sonner";

import { ESTADOS, ESTADO_INFO } from "@/lib/frota";
import { hojeISOSaoPaulo, formatarData } from "@/lib/locacao";
import type { TermoItemLinha } from "@/lib/data/termo";
import { FormError } from "@/components/shared/form-error";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { registrarDevolucao, encerrarTermo } from "../../actions";

type Marcado = { estado: string; data: string };

/**
 * Devolução por item e encerramento assinado.
 *
 * A devolução é PARCIAL de propósito, e sem assinatura: exigir assinatura a
 * cada furadeira que volta faria o almoxarife perseguir o funcionário o dia
 * inteiro, e o resultado seria ninguém registrar devolução nenhuma. A
 * assinatura é do encerramento, uma vez só.
 */
export function TermoDevolucao({
  termoId,
  itens,
  funcionarioNome,
  funcionarioCpf,
  nomeEmpresa,
  encerrado,
  dataEntrega,
}: {
  termoId: string;
  itens: TermoItemLinha[];
  funcionarioNome: string;
  funcionarioCpf: string | null;
  nomeEmpresa: string;
  encerrado: boolean;
  dataEntrega: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [marcados, setMarcados] = useState<Record<string, Marcado>>({});
  const [assinaturaFunc, setAssinaturaFunc] = useState("");
  const [assinaturaEmpresa, setAssinaturaEmpresa] = useState("");

  const pendentes = itens.filter((i) => !i.data_devolucao);
  const marcadosIds = Object.keys(marcados);

  function alternar(id: string) {
    setMarcados((m) => {
      if (!m[id]) return { ...m, [id]: { estado: "bom", data: hojeISOSaoPaulo() } };
      const resto = { ...m };
      delete resto[id];
      return resto;
    });
  }

  function devolver() {
    setErro(null);
    if (marcadosIds.length === 0) return setErro("Marque ao menos um item devolvido.");

    iniciar(async () => {
      const r = await registrarDevolucao(
        termoId,
        marcadosIds.map((id) => ({
          item_id: id,
          data_entrega: dataEntrega,
          data_devolucao: marcados[id].data,
          estado_devolucao: marcados[id].estado,
        })),
      );
      if (!r.ok) return setErro(r.erro);
      setMarcados({});
      toast.success("Devolução registrada. As peças voltaram para disponível.");
      router.refresh();
    });
  }

  function encerrar() {
    setErro(null);
    if (!assinaturaFunc) {
      return setErro("O funcionário precisa assinar o encerramento.");
    }

    iniciar(async () => {
      const r = await encerrarTermo(termoId, {
        funcionario: {
          nome: funcionarioNome,
          cpf: funcionarioCpf,
          imagem: assinaturaFunc,
        },
        empresa: { nome: nomeEmpresa, imagem: assinaturaEmpresa || null },
      });
      if (!r.ok) return setErro(r.erro);
      toast.success("Termo encerrado.");
      router.refresh();
    });
  }

  if (encerrado) {
    return (
      <p className="text-sm text-muted-foreground">
        Termo encerrado. Itens sem devolução ficaram registrados como pendência no
        documento.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {pendentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todos os itens foram devolvidos. Encerre o termo para fechar o documento.
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {pendentes.map((i) => {
            const m = marcados[i.id];
            return (
              <div
                key={i.id}
                className="grid items-center gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_9rem_9rem]"
              >
                <input
                  type="checkbox"
                  className="size-4"
                  aria-label={`Devolver ${i.item_descricao}`}
                  checked={Boolean(m)}
                  disabled={pendente}
                  onChange={() => alternar(i.id)}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.item_descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.patrimonio ?? `${i.quantidade} un.`} · saiu como{" "}
                    {ESTADO_INFO[i.estado_entrega as keyof typeof ESTADO_INFO]?.label ??
                      i.estado_entrega}
                  </p>
                </div>

                <NativeSelect
                  aria-label={`Estado na devolução de ${i.item_descricao}`}
                  value={m?.estado ?? "bom"}
                  disabled={pendente || !m}
                  onChange={(e) =>
                    setMarcados((x) => ({ ...x, [i.id]: { ...x[i.id], estado: e.target.value } }))
                  }
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_INFO[e].label}
                    </option>
                  ))}
                </NativeSelect>

                <Input
                  type="date"
                  aria-label={`Data da devolução de ${i.item_descricao}`}
                  value={m?.data ?? hojeISOSaoPaulo()}
                  disabled={pendente || !m}
                  onChange={(e) =>
                    setMarcados((x) => ({ ...x, [i.id]: { ...x[i.id], data: e.target.value } }))
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Os já devolvidos ficam à vista, e não escondidos: quem confere precisa
          ver o que já voltou para saber o que falta. */}
      {itens.some((i) => i.data_devolucao) ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Já devolvidos</p>
          <div className="divide-y rounded-md border text-sm">
            {itens
              .filter((i) => i.data_devolucao)
              .map((i) => (
                <div key={i.id} className="flex justify-between px-3 py-2">
                  <span>{i.item_descricao}</span>
                  <span className="text-muted-foreground">
                    {formatarData(i.data_devolucao)} ·{" "}
                    {i.estado_devolucao
                      ? (ESTADO_INFO[i.estado_devolucao as keyof typeof ESTADO_INFO]
                          ?.label ?? i.estado_devolucao)
                      : "—"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <FormError>{erro}</FormError>

      {pendentes.length > 0 ? (
        <div className="flex justify-end">
          <Button type="button" disabled={pendente} onClick={devolver}>
            {pendente ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
            {pendente
              ? "Registrando…"
              : `Registrar devolução${marcadosIds.length ? ` (${marcadosIds.length})` : ""}`}
          </Button>
        </div>
      ) : null}

      <div className="space-y-3 border-t pt-4">
        <p className="text-sm font-medium">Encerrar o termo</p>
        <p className="text-xs text-muted-foreground">
          O encerramento é assinado. Itens sem devolução continuam registrados como
          pendência — é o que fecha o termo de quem foi desligado devendo
          equipamento.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SignaturePad
            name="assinatura_devolucao_funcionario"
            label={`Assinatura de ${funcionarioNome}`}
            onChange={setAssinaturaFunc}
          />
          <SignaturePad
            name="assinatura_devolucao_empresa"
            label={`Assinatura de ${nomeEmpresa} (opcional)`}
            onChange={setAssinaturaEmpresa}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" disabled={pendente} onClick={encerrar}>
            {pendente ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {pendente ? "Encerrando…" : "Encerrar termo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
