// Dados, contatos e dados bancários. Não faz fetch: tudo vem da linha de
// `imovel` que a página já carregou para o cabeçalho.

import {
  STATUS_IMOVEL_INFO,
  type StatusImovel,
} from "@/lib/imoveis";
import { Campo } from "@/components/shared/campo";
import { PiiText } from "@/components/pii-text";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * A página consulta `imovel` com `select("*")` e o client não é tipado por
 * `Database`, então este tipo é o contrato explícito do que a seção realmente
 * consome — não a tabela inteira.
 */
export type ImovelDetalhe = {
  apelido: string;
  tipo: string;
  status: string;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  capacidade_pessoas: number | null;
  area_m2: number | null;
  observacoes: string | null;
  obra: { codigo: string; nome: string } | null;
  proprietario_nome: string | null;
  proprietario_telefone: string | null;
  proprietario_email: string | null;
  imobiliaria_nome: string | null;
  imobiliaria_telefone: string | null;
  imobiliaria_email: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  titular_conta: string | null;
  pix_chave: string | null;
};

export function ImovelIdentificacao({ imovel }: { imovel: ImovelDetalhe }) {
  const st = STATUS_IMOVEL_INFO[imovel.status as StatusImovel];
  const temBanco =
    imovel.banco || imovel.conta || imovel.pix_chave || imovel.titular_conta;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Dados
            <Badge variant={st?.variant ?? "secondary"}>
              {st?.label ?? imovel.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Campo label="Endereço" valor={imovel.endereco} span />
          <Campo
            label="Cidade/UF"
            valor={[imovel.cidade, imovel.uf].filter(Boolean).join("/")}
          />
          <Campo
            label="Capacidade"
            valor={
              imovel.capacidade_pessoas
                ? `${imovel.capacidade_pessoas} pessoas`
                : null
            }
          />
          <Campo
            label="Área"
            valor={imovel.area_m2 ? `${imovel.area_m2} m²` : null}
          />
          <Campo
            label="Obra / centro de custo"
            valor={
              imovel.obra ? `${imovel.obra.codigo} — ${imovel.obra.nome}` : null
            }
          />
          {imovel.observacoes ? (
            <Campo label="Observações" valor={imovel.observacoes} span />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contatos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Contato
            titulo="Proprietário"
            nome={imovel.proprietario_nome}
            telefone={imovel.proprietario_telefone}
            email={imovel.proprietario_email}
          />
          <Contato
            titulo="Imobiliária"
            nome={imovel.imobiliaria_nome}
            telefone={imovel.imobiliaria_telefone}
            email={imovel.imobiliaria_email}
          />
        </CardContent>
      </Card>

      {temBanco ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dados bancários</CardTitle>
            <CardDescription>Pagamento ao proprietário.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Campo label="Banco" valor={imovel.banco} />
            <Campo label="Agência" valor={imovel.agencia} />
            <Campo
              label="Conta"
              node={
                imovel.conta ? (
                  <span className="inline-flex items-center gap-1">
                    <PiiText value={imovel.conta} />
                    {imovel.tipo_conta === "corrente"
                      ? " · corrente"
                      : imovel.tipo_conta === "poupanca"
                        ? " · poupança"
                        : ""}
                  </span>
                ) : undefined
              }
            />
            <Campo label="Titular" valor={imovel.titular_conta} />
            <Campo
              label="Chave PIX"
              span
              node={
                imovel.pix_chave ? (
                  <PiiText value={imovel.pix_chave} keepEnd={4} />
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Contato({
  titulo,
  nome,
  telefone,
  email,
}: {
  titulo: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {titulo}
      </p>
      <p className="font-medium">{nome ?? "—"}</p>
      <p className="text-sm text-muted-foreground">{telefone ?? "—"}</p>
      <p className="text-sm text-muted-foreground">{email ?? "—"}</p>
    </div>
  );
}
