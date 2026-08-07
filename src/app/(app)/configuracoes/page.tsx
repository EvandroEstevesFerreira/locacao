import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  Building,
  FileText,
  History,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfigAlertaForm } from "./config-form";
import { ConfigRelatorioForm } from "./config-relatorio-form";

export const metadata = { title: "Configurações — Loca" };

export default async function ConfiguracoesPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeConfigurarSistema(perfil.papel)) redirect("/");

  const supabase = await createClient();
  const [{ data }, { data: dataRel }] = await Promise.all([
    supabase
      .from("config_alerta")
      .select("ativo, dias_alerta, destinatarios")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
    supabase
      .from("config_relatorio_email")
      .select("ativo, tipo, frequencia, dia, destinatarios")
      .eq("org_id", perfil.org_id)
      .maybeSingle(),
  ]);

  const config = {
    ativo: data?.ativo ?? true,
    dias_alerta:
      data?.dias_alerta && data.dias_alerta.length > 0 ? data.dias_alerta : [3],
    destinatarios: (data?.destinatarios ?? []) as string[],
  };

  const configRel = {
    ativo: dataRel?.ativo ?? false,
    tipo: dataRel?.tipo ?? "custo_por_obra",
    frequencia: dataRel?.frequencia ?? "mensal",
    dia: dataRel?.dia ?? 1,
    destinatarios: (dataRel?.destinatarios ?? []) as string[],
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        titulo="Configurações"
        descricao="Cadastros da organização, documentos e automações de e-mail."
      />

      {/* Organização */}
      <section className="space-y-3">
        <SecaoTitulo>Organização</SecaoTitulo>
        <Card>
          <CardContent className="divide-y p-0">
            <LinkRow
              href="/configuracoes/empresa"
              icon={Building}
              titulo="Dados da empresa"
              descricao="CNPJ, endereço, contatos e representante — usados nos contratos."
            />
            <LinkRow
              href="/configuracoes/templates"
              icon={FileText}
              titulo="Templates de documentos"
              descricao="Texto dos contratos e termos com variáveis preenchidas ao gerar o PDF."
            />
            <LinkRow
              href="/usuarios"
              icon={Users}
              titulo="Usuários"
              descricao="Papéis e acesso por obra dos usuários da organização."
            />
            <LinkRow
              href="/configuracoes/auditoria"
              icon={History}
              titulo="Auditoria"
              descricao="Histórico de quem criou, alterou ou excluiu registros."
            />
          </CardContent>
        </Card>
      </section>

      {/* Automações de e-mail */}
      <section className="space-y-3">
        <SecaoTitulo>Automações de e-mail</SecaoTitulo>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas de vencimento</CardTitle>
            <CardDescription>
              Um robô diário verifica devoluções previstas, fins de contrato e
              pagamentos a vencer e envia um resumo por e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigAlertaForm config={config} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relatório por e-mail</CardTitle>
            <CardDescription>
              Envio automático de um relatório (com PDF anexo), semanal ou
              mensalmente, para os destinatários escolhidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigRelatorioForm config={configRel} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

function LinkRow({
  href,
  icon: Icon,
  titulo,
  descricao,
}: {
  href: string;
  icon: LucideIcon;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
