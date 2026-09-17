"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { ESTADOS, ESTADO_INFO } from "@/lib/frota";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { movimentarPeca } from "../../actions";

type Destino = "funcionario" | "obra" | "almoxarifado" | "fornecedor";

/**
 * Mover a peça — a porta única. Reúne os quatro destinos (inclusive
 * "funcionário", que antes só existia no termo) e, quando a peça sai de uma
 * pessoa, a devolução assinada — antes um formulário à parte em
 * `/frota/[id]/transferir`, rota já removida.
 */
export function PecaMover({
  unidadeId,
  obras,
  fornecedores,
  funcionarios,
  posseAtual,
}: {
  unidadeId: string;
  obras: { id: string; rotulo: string }[];
  fornecedores: { id: string; nome: string }[];
  funcionarios: { id: string; nome: string }[];
  posseAtual: { tipo: string; nome: string | null } | null;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Destino>("obra");
  const [obraId, setObraId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [data, setData] = useState(hojeISOSaoPaulo());
  const [observacoes, setObservacoes] = useState("");
  const [situacaoFinal, setSituacaoFinal] = useState("disponivel");
  const [estado, setEstado] = useState<string>("bom");
  const [assinatura, setAssinatura] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const saiDePessoa = posseAtual?.tipo === "funcionario";
  // A PERGUNTA DA DEVOLUCAO VALE PARA TODA VOLTA AO ALMOXARIFADO.
  //
  // "ao devolver um equipamento devemos selecionar se ele fica disponivel" foi
  // o pedido, e ele nao dizia "quando vier de uma pessoa". A peca que volta de
  // uma obra esta tao `em_uso` quanto a que volta do Joao, e a peca que volta
  // da oficina tambem pode ter voltado imprestavel. A escolha e real sempre que
  // ha posse aberta e o destino e a prateleira.
  const ehDevolucao = posseAtual !== null && tipo === "almoxarifado";

  function mover() {
    setErro(null);
    iniciar(async () => {
      const r = await movimentarPeca({
        unidade_id: unidadeId,
        tipo,
        obra_id: tipo === "obra" ? obraId || null : null,
        fornecedor_id: tipo === "fornecedor" ? fornecedorId || null : null,
        funcionario_id: tipo === "funcionario" ? funcionarioId || null : null,
        data,
        observacoes: observacoes || null,
        situacao_final: ehDevolucao ? situacaoFinal : null,
        // NUNCA mandar `estado_devolucao` fora do caso de devolução: sozinho
        // ele acorda a exigência de assinatura-ou-motivo no schema, e uma
        // movimentação que não devolve nada de ninguém ficaria presa pedindo
        // as duas coisas. Ver o comentário em `custodia.ts`, no `superRefine`.
        estado_devolucao: saiDePessoa ? estado : null,
        assinatura_devolucao: saiDePessoa ? assinatura || null : null,
        motivo_sem_assinatura: saiDePessoa ? motivo || null : null,
      });
      if (!r.ok) return setErro(r.erro);
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Movimentação registrada no histórico da peça.");

      // DESTINO PESSOA CONTINUA EM DUAS ASSINATURAS, e é de propósito: a
      // devolução foi assinada aqui, a entrega é assinada no termo, que pede
      // CPF, previsão e a assinatura da empresa. O que esta tela resolve é a
      // pessoa não precisar mais descobrir sozinha qual botão apertar.
      //
      // COM AVISO, NAO NAVEGA. O aviso quer dizer que algum passo do caminho
      // nao se completou — o termo anterior pode nao ter sido encerrado. Levar
      // para /termos/novo assim mesmo convida a emitir um segundo termo sobre a
      // mesma peca: duas pessoas respondendo no papel por uma maquina so, e
      // `temTermoEmAberto` barrando toda movimentacao seguinte ate alguem
      // desfazer isso a mao. A pessoa le o alerta, confere a ficha e decide.
      if (tipo === "funcionario" && !r.aviso) {
        router.push(`/termos/novo?peca=${unidadeId}&funcionario=${funcionarioId}`);
        return;
      }
      setObservacoes("");
      // A data volta para hoje: mantida, o segundo movimento sairia com a data
      // do primeiro e seria recusado pelo check `fim >= inicio` do livro.
      setData(hojeISOSaoPaulo());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {saiDePessoa ? (
        <div className="space-y-4 rounded-md border bg-muted/40 p-3">
          <div className="text-sm">
            <p className="font-medium">Devolução</p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground">{posseAtual?.nome}</span>{" "}
              está com esta peça. Registre a devolução para movimentá-la.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estado_devolucao">Estado na devolução</Label>
            <NativeSelect
              id="estado_devolucao"
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

          <SignaturePad
            name="assinatura_devolucao"
            label={`Assinatura de ${posseAtual?.nome ?? "quem devolve"}`}
            onChange={setAssinatura}
          />

          <div className="space-y-1.5">
            <Label htmlFor="motivo_sem_assinatura">
              Motivo de não assinar{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="motivo_sem_assinatura"
              placeholder="A pessoa não está presente, por exemplo."
              value={motivo}
              disabled={pendente}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="destino">Para onde vai</Label>
          <NativeSelect
            id="destino"
            value={tipo}
            disabled={pendente}
            onChange={(e) => setTipo(e.target.value as Destino)}
          >
            <option value="funcionario">Funcionário</option>
            <option value="obra">Obra</option>
            <option value="almoxarifado">Almoxarifado central</option>
            <option value="fornecedor">Manutenção em fornecedor</option>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_movimentacao">Data</Label>
          <Input
            id="data_movimentacao"
            type="date"
            value={data}
            disabled={pendente}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        {tipo === "funcionario" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="funcionario_destino">Quem vai receber</Label>
            <NativeSelect
              id="funcionario_destino"
              value={funcionarioId}
              disabled={pendente}
              onChange={(e) => setFuncionarioId(e.target.value)}
            >
              <option value="">Selecione a pessoa…</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {tipo === "obra" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obra_destino">Obra</Label>
            <NativeSelect
              id="obra_destino"
              value={obraId}
              disabled={pendente}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Selecione a obra…</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {tipo === "fornecedor" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fornecedor_destino">Fornecedor</Label>
            <NativeSelect
              id="fornecedor_destino"
              value={fornecedorId}
              disabled={pendente}
              onChange={(e) => setFornecedorId(e.target.value)}
            >
              <option value="">Selecione o fornecedor…</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {ehDevolucao ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="situacao_final">Como ela volta</Label>
            <NativeSelect
              id="situacao_final"
              value={situacaoFinal}
              disabled={pendente}
              onChange={(e) => setSituacaoFinal(e.target.value)}
            >
              <option value="disponivel">Disponível para uso</option>
              <option value="baixada">Baixada</option>
              <option value="perdida">Perdida</option>
            </NativeSelect>
          </div>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="obs_movimentacao">Observações (opcional)</Label>
          <Input
            id="obs_movimentacao"
            maxLength={300}
            placeholder="Quem levou, em que veículo, o que foi combinado…"
            value={observacoes}
            disabled={pendente}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex justify-end">
        <Button type="button" disabled={pendente} onClick={mover}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Truck className="size-4" />
          )}
          {pendente ? "Registrando…" : "Registrar movimentação"}
        </Button>
      </div>
    </div>
  );
}
