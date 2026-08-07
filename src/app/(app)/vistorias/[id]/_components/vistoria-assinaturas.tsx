// Seção de observações e assinaturas. Não faz fetch próprio: os campos vêm da
// mesma linha de `vistoria` que a página já carregou para o cabeçalho, então
// buscar de novo seria uma consulta a mais por nada.

import { formatarDataHora } from "@/lib/locacao";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RelatorioForm } from "../../relatorio-form";

export type AssinaturasDaVistoria = {
  id: string;
  observacoes: string | null;
  assinatura_empresa_nome: string | null;
  assinatura_empresa_img: string | null;
  assinatura_empresa_em: string | null;
  assinatura_retirante_nome: string | null;
  assinatura_retirante_img: string | null;
  assinatura_retirante_em: string | null;
};

export function VistoriaAssinaturas({
  vistoria,
  usuarioNome,
  podeEditar,
}: {
  vistoria: AssinaturasDaVistoria;
  usuarioNome: string;
  podeEditar: boolean;
}) {
  const empresaImg = vistoria.assinatura_empresa_img;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Observações e assinaturas</CardTitle>
        <CardDescription>
          Observações e as duas assinaturas (representante e quem retira). Entram
          no PDF do relatório.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {podeEditar ? (
          <RelatorioForm
            vistoriaId={vistoria.id}
            usuarioNome={usuarioNome}
            defaults={{
              observacoes: vistoria.observacoes ?? "",
              empresaNome: vistoria.assinatura_empresa_nome ?? "",
              empresaImg: empresaImg ?? "",
              empresaEm: vistoria.assinatura_empresa_em
                ? formatarDataHora(vistoria.assinatura_empresa_em)
                : "",
              retiranteNome: vistoria.assinatura_retirante_nome ?? "",
              retiranteImg: vistoria.assinatura_retirante_img ?? "",
              retiranteEm: vistoria.assinatura_retirante_em
                ? formatarDataHora(vistoria.assinatura_retirante_em)
                : "",
            }}
          />
        ) : (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {vistoria.observacoes || "Sem observações."}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <AssinaturaSomenteLeitura
                label="Representante Sistenge"
                nome={vistoria.assinatura_empresa_nome ?? "—"}
                assinado={!!empresaImg}
                em={
                  vistoria.assinatura_empresa_em
                    ? formatarDataHora(vistoria.assinatura_empresa_em)
                    : null
                }
              />
              <AssinaturaSomenteLeitura
                label="Quem retira / recebe"
                nome={vistoria.assinatura_retirante_nome ?? "—"}
                assinado={!!vistoria.assinatura_retirante_img}
                em={
                  vistoria.assinatura_retirante_em
                    ? formatarDataHora(vistoria.assinatura_retirante_em)
                    : null
                }
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssinaturaSomenteLeitura({
  label,
  nome,
  assinado,
  em,
}: {
  label: string;
  nome: string;
  assinado: boolean;
  em?: string | null;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{nome}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {assinado ? "Assinatura registrada" : "Sem assinatura"}
        {assinado && em ? ` · ${em}` : ""}
      </p>
    </div>
  );
}
