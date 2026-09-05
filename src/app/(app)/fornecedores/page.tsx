import Link from "next/link";
import { Truck, Plus, Pencil, MailWarning} from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import {
  listarFornecedores,
  contarFornecedoresSemEmail,
} from "@/lib/data/fornecedores";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  colunaFixa,
  colunaFixaFim,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
import { FornecedoresToolbar } from "./fornecedores-toolbar";
import { excluirFornecedor } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";
import { listarObrasParaFiltro } from "@/lib/data/obras";

export const metadata = { title: "Fornecedores — Loca" };

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const obra = sp.obra ?? "";
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["nome", "cnpj", "ativo"],
    defaultSort: "nome",
  });
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);

  const [{ itens: fornecedores, total }, obrasData, semEmail] = await Promise.all([
    listarFornecedores({ q, sort, ascending, from, to, obraId: obra }),
    listarObrasParaFiltro(),
    // Conta a organização inteira, não a página: o número serve para dizer o
    // tamanho do buraco, e um "3 sem e-mail" que muda ao virar a página não
    // diria nada.
    contarFornecedoresSemEmail(),
  ]);
  const tem = fornecedores.length > 0;
  const filtrando = Boolean(q || obra);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Fornecedores"
        descricao={`Locadoras e fornecedores de quem a organização aluga. · ${contagem(total, "fornecedor", "fornecedores")} no filtro${
          semEmail > 0
            ? ` · ${semEmail} sem e-mail — não recebem romaneio nem termo`
            : ""
        }`}
        acoes={
          podeEditar ? (
            <Button render={<Link href="/fornecedores/novo" />}>
              <Plus className="size-4" />
              Novo fornecedor
            </Button>
          ) : null
        }
      />

      <FornecedoresToolbar obras={obrasData} q={q} obra={obra} />

      {tem ? (
        <>
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={colunaFixa}>
                    <SortHeader column="nome" label="Nome" />
                  </TableHead>
                  <TableHead><SortHeader column="cnpj" label="CNPJ" /></TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Obras</TableHead>
                  <TableHead><SortHeader column="ativo" label="Status" /></TableHead>
                  <TableHead className={cn("w-24 text-right", colunaFixaFim)}>
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.map((f) => {
                  const codigos = f.obras.map((o) => o.codigo);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className={cn("font-medium", colunaFixa)}>
                        {f.nome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.cnpj ?? "—"}
                      </TableCell>
                      {/* A coluna "Contato" mostrava o nome de quem atende,
                          e estava vazia em 36 das 37 linhas. O e-mail ocupa o
                          lugar dela porque é o campo que decide se o romaneio e
                          o termo de devolução chegam — e a ausência dele
                          precisa DOER na lista, não ficar como um travessão
                          igual a qualquer outro campo em branco. */}
                      <TableCell>
                        {f.contato_email ? (
                          <span className="text-muted-foreground">
                            {f.contato_email}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-warning-strong"
                            title="Sem e-mail, este fornecedor não recebe romaneio nem termo de devolução."
                          >
                            <MailWarning className="size-3.5" aria-hidden />
                            sem e-mail
                          </span>
                        )}
                        {f.contato_nome ? (
                          <span className="block text-xs text-muted-foreground">
                            {f.contato_nome}
                            {f.contato_telefone ? ` · ${f.contato_telefone}` : ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {codigos.length ? codigos.join(", ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.ativo ? "default" : "outline"}>
                          {f.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className={colunaFixaFim}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar"
                            render={<Link href={`/fornecedores/${f.id}`} />}
                          >
                            <Pencil />
                          </Button>
                          {podeEditar ? (
                            <ConfirmDelete action={excluirFornecedor} id={f.id} />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      ) : filtrando ? (
        <EmptyState
          titulo="Nenhum fornecedor encontrado"
          descricao="Ajuste a busca ou o filtro de obra."
        />
      ) : (
        <EmptyState
          icon={<Truck />}
          titulo="Nenhum fornecedor cadastrado ainda"
          descricao="Cadastre as locadoras e fornecedores de quem a organização aluga."
          acao={podeEditar ? { label: "Novo fornecedor", href: "/fornecedores/novo" } : undefined}
        />
      )}
    </div>
  );
}
