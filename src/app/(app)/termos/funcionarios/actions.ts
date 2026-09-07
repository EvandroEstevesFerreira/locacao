"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, type ActionResult } from "@/lib/acoes";
import { peopleConfigurado, configPeople, buscarPessoas } from "@/lib/people/cliente";
import { conciliar, inequivocas } from "@/lib/people/conciliacao";
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

/**
 * Liga uma linha do Loca a uma pessoa do People.
 *
 * GRAVA SÓ O `people_id`, e nada mais. O resto — nome completo, CPF, cargo,
 * matrícula, obra — chega na primeira sincronização, pelo `upsert` em
 * `(org_id, people_id)`: a linha já vinculada é ENCONTRADA e atualizada, em vez
 * de virar uma segunda linha da mesma pessoa.
 *
 * É por isso que a conciliação vem ANTES de ligar a sincronização. Ligá-la com
 * as 118 linhas ainda sem `people_id` criaria 483 linhas novas ao lado delas, e
 * cerca de 118 pessoas apareceriam duas vezes na lista do termo.
 */
export async function vincularPessoa(
  funcionarioId: string,
  peopleId: string,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para vincular pessoas.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("funcionario")
    .update({ people_id: peopleId, updated_at: new Date().toISOString() })
    .eq("id", funcionarioId);

  if (error) {
    // O índice único `(org_id, people_id)` recusa duas linhas do Loca apontando
    // para a mesma pessoa. Dizer isso é melhor que repetir a mensagem do
    // Postgres, porque a saída é outra: uma das duas linhas é duplicata e
    // precisa ser resolvida, não vinculada.
    if (error.code === "23505") {
      return falha(
        "Esta pessoa do People já está vinculada a outro funcionário. Se as duas linhas são a mesma pessoa, desative a duplicada antes de vincular.",
      );
    }
    return falha("Não consegui gravar o vínculo.");
  }

  revalidatePath("/termos/funcionarios/conciliar");
  revalidatePath("/termos/funcionarios");
  return { ok: true };
}

/**
 * Desativa uma linha que não corresponde a pessoa nenhuma.
 *
 * `funcionario` não tem `deleted_at` de propósito — o vínculo com os termos
 * antigos tem de sobreviver ao desligamento. Desativar é o mecanismo, e é
 * reversível pela tela de edição.
 */
export async function desativarFuncionario(
  funcionarioId: string,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para desativar funcionários.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("funcionario")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("id", funcionarioId);

  if (error) return falha("Não consegui desativar o funcionário.");

  revalidatePath("/termos/funcionarios/conciliar");
  revalidatePath("/termos/funcionarios");
  return { ok: true };
}

/**
 * Vincula de uma vez as linhas que só têm um candidato possível.
 *
 * O LOTE É CALCULADO AQUI, e não recebido da tela. Aceitar uma lista de pares
 * vinda do cliente deixaria qualquer um mandar os vínculos que quisesse — e
 * vínculo errado gruda o histórico de equipamento de alguém no cadastro de
 * outro. A tela mostra o que vai acontecer; o servidor recalcula antes de
 * gravar.
 */
export async function vincularInequivocos(): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para vincular pessoas.");
  }
  const orgId = perfil.org_id;
  if (!orgId) return falha("Seu usuário não está vinculado a uma organização.");
  if (!peopleConfigurado()) {
    return falha("A integração com o Sistenge People não está configurada.");
  }

  const cfg = configPeople();
  if (!cfg) return falha("A integração com o Sistenge People não está configurada.");

  const supabase = await createClient();
  const { data: locais, error } = await supabase
    .from("funcionario")
    .select("id, nome")
    .eq("org_id", orgId)
    .eq("ativo", true)
    .is("people_id", null)
    .order("nome");

  if (error) return falha("Não consegui ler os funcionários a conciliar.");

  let pessoas;
  try {
    pessoas = (await buscarPessoas(cfg, null)).pessoas;
  } catch (e) {
    return falha(
      e instanceof Error ? e.message : "Não consegui ler as pessoas do People.",
    );
  }

  const auto = inequivocas(
    conciliar((locais ?? []) as { id: string; nome: string }[], pessoas),
  );
  if (auto.length === 0) return falha("Não há vínculo inequívoco a fazer.");

  // Um a um, e não em lote: se um deles esbarrar no índice único, os outros
  // ainda valem. Um `upsert` de todos morreria inteiro por causa de um par
  // duplicado que ninguém resolveu ainda.
  let gravados = 0;
  for (const s of auto) {
    const { error: e } = await supabase
      .from("funcionario")
      .update({
        people_id: s.candidatos[0].peopleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", s.funcionarioId);
    if (!e) gravados++;
  }

  revalidatePath("/termos/funcionarios/conciliar");
  revalidatePath("/termos/funcionarios");

  if (gravados === 0) return falha("Nenhum vínculo pôde ser gravado.");
  return gravados < auto.length
    ? { ok: true, aviso: `${gravados} de ${auto.length} vínculos gravados; os demais esbarraram em duplicidade.` }
    : { ok: true };
}
