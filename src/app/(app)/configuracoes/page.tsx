import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
      data?.dias_alerta && data.dias_alerta.length > 0
        ? data.dias_alerta
        : [3],
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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Preferências"
        titulo="Configurações"
        descricao="Usuários e avisos automáticos de vencimento."
      />
      {/* Usuários */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Usuários
            </CardTitle>
            <CardDescription>
              Papéis e acesso por obra dos usuários da organização.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/usuarios" />}>
            Gerenciar
            <ChevronRight className="size-4" />
          </Button>
        </CardHeader>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas de vencimento</CardTitle>
          <CardDescription>
            Um robô diário (Vercel Cron) verifica devoluções previstas, fins de
            contrato e pagamentos a vencer e envia um resumo por e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigAlertaForm config={config} />
        </CardContent>
      </Card>

      {/* Relatório por e-mail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relatório por e-mail</CardTitle>
          <CardDescription>
            Envio automático de um relatório (com PDF anexo) por e-mail, semanal
            ou mensalmente, para os destinatários escolhidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigRelatorioForm config={configRel} />
        </CardContent>
      </Card>
    </div>
  );
}
