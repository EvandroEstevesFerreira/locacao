import { redirect } from "next/navigation";
import { Users, Building, FileText, History, ListChecks } from "lucide-react";
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
import { ConfigRow, SecaoTitulo } from "@/components/shared/config-row";

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
            <ConfigRow
              href="/configuracoes/empresa"
              icon={Building}
              titulo="Dados da empresa"
              descricao="CNPJ, endereço, contatos e representante — usados nos contratos."
            />
            <ConfigRow
              href="/configuracoes/templates"
              icon={FileText}
              titulo="Templates de documentos"
              descricao="Texto dos contratos e termos com variáveis preenchidas ao gerar o PDF."
            />
            <ConfigRow
              href="/configuracoes/limpeza"
              icon={ListChecks}
              titulo="Catálogo de limpeza"
              descricao="As 44 tarefas do FRM-RH-005, por ambiente e frequência — é o que a folha impressa lista."
            />
            <ConfigRow
              href="/usuarios"
              icon={Users}
              titulo="Usuários"
              descricao="Papéis e acesso por obra dos usuários da organização."
            />
            <ConfigRow
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


