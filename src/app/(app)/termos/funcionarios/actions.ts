"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, type ActionResult } from "@/lib/acoes";
import { peopleConfigurado } from "@/lib/people/cliente";
import { sincronizarPessoas, registrarRodada } from "@/lib/people/servidor";

/**
 * "Sincronizar agora" — a rodada sob demanda.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * Existe porque contratar de manhã e entregar o notebook à tarde é caso real, e
 * esperar até as 7h30 do dia seguinte por causa disso seria limitação nossa, e
 * não do contrato.
 *
 * `createClient()` e NÃO o admin: aqui há sessão de usuário, e é o RLS de
 * `funcionario` que garante que ninguém escreva na organização alheia. O client
 * admin é exceção do cron, que roda sem sessão nenhuma.
 */
export async function sincronizarComPeople(): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para sincronizar a base de pessoas.");
  }
  // `org_id` é anulável no perfil, e sincronizar sem organização gravaria
  // pessoas sem dono.
  const orgId = perfil.org_id;
  if (!orgId) return falha("Seu usuário não está vinculado a uma organização.");
  if (!peopleConfigurado()) {
    return falha(
      "A integração com o Sistenge People ainda não está configurada neste ambiente.",
    );
  }

  const supabase = await createClient();

  const { data: cfg, error } = await supabase
    .from("people_sync")
    .select("org_id, ativo, ultimo_atualizado_em")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return falha("Não consegui ler a configuração da sincronização.");
  if (!cfg) {
    // Fail-closed, igual ao cron: sem linha declarada, esta organização não
    // sincroniza. Dizer isso é melhor que uma rodada que "funciona" e não traz
    // ninguém.
    return falha(
      "Esta organização ainda não está habilitada para sincronizar com o People.",
    );
  }
  if (!(cfg as { ativo: boolean }).ativo) {
    return falha("A sincronização com o People está desligada nesta organização.");
  }

  const agoraISO = new Date().toISOString();
  const r = await sincronizarPessoas(
    supabase,
    orgId,
    (cfg as { ultimo_atualizado_em: string | null }).ultimo_atualizado_em,
    agoraISO,
  );
  await registrarRodada(supabase, orgId, r, agoraISO);

  if (!r.ok) return falha(r.erro ?? "A sincronização falhou.");

  revalidatePath("/termos/funcionarios");
  revalidatePath("/termos/novo");

  // O NÚMERO SAI DA TELA, e não daqui. `ActionResult` não carrega dado, e
  // `people_sync.pessoas_recebidas` já guarda a contagem da rodada — a página
  // revalidada a mostra junto do horário. Um `aviso` com o número seria usar
  // para relatório o campo que existe para ressalva.
  return { ok: true };
}
