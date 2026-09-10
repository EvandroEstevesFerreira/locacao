"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { ESTADOS, ESTADO_INFO } from "@/lib/frota";
import { hojeISOSaoPaulo, formatarData } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { devolverParaTransferir } from "./actions";

/**
 * A devolução que abre a transferência.
 *
 * Um formulário só, e não um passo a passo: são cinco campos, e quem está com o
 * funcionário na frente não deve navegar entre telas para registrar uma coisa
 * que acontece num minuto.
 */
export function TransferirForm({
  unidadeId,
  identificador,
  quemEntrega,
  desde,
  candidatos,
}: {
  unidadeId: string;
  identificador: string;
  quemEntrega: { id: string; nome: string };
  desde: string;
  candidatos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const [data, setData] = useState(hojeISOSaoPaulo());
  const [estado, setEstado] = useState<string>("bom");
  const [observacoes, setObservacoes] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [motivo, setMotivo] = useState("");
  const [destinatario, setDestinatario] = useState("");

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const r = await devolverParaTransferir({
        unidade_id: unidadeId,
        data_devolucao: data,
        estado_devolucao: estado,
        observacoes: observacoes || null,
        assinante: quemEntrega.nome,
        assinatura: assinatura || null,
        motivo_sem_assinatura: motivo || null,
        destinatario_id: destinatario || null,
      });

      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      if (r.aviso) toast.warning(r.aviso);
      else toast.success(`${identificador} devolvida por ${quemEntrega.nome}.`);

      // Leva direto para a segunda metade, com peça e pessoa já preenchidas.
      // Sem isso a transferência terminaria no meio, e a pessoa teria de achar
      // sozinha o caminho que ela veio evitar.
      router.push(
        destinatario
          ? `/termos/novo?peca=${unidadeId}&funcionario=${destinatario}`
          : `/frota/${unidadeId}`,
      );
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p>
          <span className="font-medium">{identificador}</span> está com{" "}
          <span className="font-medium">{quemEntrega.nome}</span> desde{" "}
          {formatarData(desde)}.
        </p>
        <p className="mt-1 text-muted-foreground">
          A devolução encerra o termo dele. O termo de quem recebe é o passo
          seguinte — pode ser assinado depois, e até lá a peça fica disponível.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="data">Data da devolução</Label>
          <Input
            id="data"
            type="date"
            value={data}
            disabled={pendente}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="estado">Em que estado voltou</Label>
          <NativeSelect
            id="estado"
            value={estado}
            disabled={pendente}
            onChange={(e) => setEstado(e.target.value)}
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_INFO[e].label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="destinatario">
            Vai para{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <NativeSelect
            id="destinatario"
            value={destinatario}
            disabled={pendente}
            onChange={(e) => setDestinatario(e.target.value)}
          >
            <option value="">Ainda não sei — só devolver</option>
            {candidatos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Informando aqui, a peça guarda o lembrete e o termo de entrega já
            abre preenchido. Não é reserva: se outra pessoa levar antes, o
            lembrete some.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="obs">
            Observações{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="obs"
            rows={2}
            value={observacoes}
            disabled={pendente}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <SignaturePad
        name="assinatura_transferencia"
        label={`Assinatura de ${quemEntrega.nome}`}
        onChange={setAssinatura}
      />

      {/* SÓ APARECE QUANDO A ASSINATURA FALTA. Mostrar o campo o tempo todo
          convidaria a pular a assinatura, e o caminho sem ela viraria o mais
          curto — que é exatamente o que o motivo obrigatório existe para
          impedir. */}
      {!assinatura ? (
        <div className="space-y-1.5">
          <Label htmlFor="motivo">Por que não há assinatura</Label>
          <Textarea
            id="motivo"
            rows={2}
            value={motivo}
            disabled={pendente}
            placeholder="Ex.: desligado em 12/08, equipamento recolhido pelo RH."
            onChange={(e) => setMotivo(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Quem foi desligado não volta para assinar — e é justamente esse o
            caso que mais precisa ficar registrado. O documento vai mostrar que
            não foi assinado, com este motivo.
          </p>
        </div>
      ) : null}

      <FormError>{erro}</FormError>

      <div className="flex justify-end">
        <Button type="button" disabled={pendente} onClick={enviar}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="size-4" />
          )}
          {destinatario ? "Devolver e entregar" : "Registrar devolução"}
        </Button>
      </div>
    </div>
  );
}
