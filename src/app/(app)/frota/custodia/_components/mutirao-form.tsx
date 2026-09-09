"use client";

// Conferência do mutirão de custódia: o que a planilha diz, e quem é essa
// pessoa no cadastro.
//
// POR QUE ESTA TELA NÃO GRAVA, e a razão é do banco.
//
// A primeira versão tinha "Registrar 88 custódias" e falhava em todas. O check
// `custodia_funcionario_exige_termo` (migration 0059) recusa posse de
// funcionário sem termo:
//
//   check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null))
//
// com o motivo escrito ao lado: "posse de funcionário só nasce por termo
// assinado. No BANCO, e não só na tela: a tela pode estar velha, e o valor do
// termo é justamente ser a única fonte de verdade sobre quem respondeu pelo
// equipamento". `moverPeca` sempre respeitou — `custodia.ts` registra que
// "funcionario NÃO está entre os destinos".
//
// A invariante está certa e o mutirão estava errado. Botão que promete gravar e
// não grava é pior que nenhum botão, então aqui se CONFERE. O casamento de
// nomes, que é o trabalho difícil, já está feito — e é ele que a emissão dos
// termos vai consumir.

import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { PropostaMutirao } from "@/lib/data/custodia";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";

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
          <strong>Esta tela ainda não grava.</strong> Quem está com a peça se
          registra <strong>emitindo o termo de responsabilidade</strong> — é o
          termo que cria a posse, por decisão de projeto: ele é a única fonte de
          verdade sobre quem respondeu pelo equipamento. Use a lista para
          conferir os <strong>{definidas}</strong> casamentos antes de emitir.
        </span>
      </div>
    </div>
  );
}
