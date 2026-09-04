"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentPerfil, PAPEL_INFO, type Papel } from "@/lib/auth";
import { criarUsuarioSchema, editarUsuarioSchema } from "@/lib/permissoes";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { normalizarModulos } from "@/lib/modulos";
import { enviarEmail, emailConfigurado } from "@/lib/email";
import { montarContexto, SELECT_ORGANIZACAO_EMAIL } from "@/lib/emails/contexto";
import { acessoCriado, senhaRedefinida } from "@/lib/emails/templates";

/**
 * Contexto de e-mail da organização — razão social e CNPJ para o rodapé.
 *
 * Client normal, não admin: `organizacao` é tabela da aplicação e o isolamento
 * por organização depende da RLS. O master lê a própria organização por policy.
 */
async function contextoEmail(orgId: string | null) {
  // `exigirMaster` já garante `org_id`, mas o tipo de `Perfil` continua anulável
  // e o TS não estreita entre funções. Tratar o nulo aqui é mais honesto que um
  // `!`: no pior caso o rodapé sai com o nome genérico, e nada quebra.
  if (!orgId) return montarContexto(null);
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizacao")
    .select(SELECT_ORGANIZACAO_EMAIL)
    .eq("id", orgId)
    .single();
  return montarContexto(org);
}

/** Só o master gere usuários. Retorna o perfil master ou null. */
async function exigirMaster() {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || perfil.papel !== "master") return null;
  return perfil;
}

/**
 * Lista VAZIA de módulos vira `null`, que significa acesso a todos. Evita
 * trancar o usuário fora de tudo por não ter marcado nenhuma caixa.
 */
function modulosOuNull(marcados: string[]): string[] | null {
  const validos = normalizarModulos(marcados);
  return validos.length > 0 ? validos : null;
}

/**
 * Reescreve os vínculos obra↔usuário do perfil.
 *
 * Recebe o client NORMAL, e não o admin: `obra_usuario` é tabela da aplicação,
 * e o isolamento por organização depende da RLS (ver AGENTS.md). O fluxo de
 * edição já usava o client normal — "master tem policy de gestão" —, então era
 * só a criação que furava a regra, escrevendo com service role.
 *
 * Devolve a mensagem quando algo falha. Antes as duas escritas descartavam o
 * erro, e o resultado era um usuário sem acesso a obra nenhuma sem ninguém
 * saber: nem quem criou, nem quem não conseguia ver a obra.
 *
 * `delete` de zero linhas é LEGÍTIMO aqui (perfil que não tinha vínculo), por
 * isso este caso não usa `erroDeEscrita` — o que importa é o erro, não a
 * contagem de linhas.
 */
async function sincronizarObras(
  client: Awaited<ReturnType<typeof createClient>>,
  perfilId: string,
  obras: string[],
): Promise<string | null> {
  const { error: erroApagar } = await client
    .from("obra_usuario")
    .delete()
    .eq("perfil_id", perfilId);
  if (erroApagar) {
    console.error("sincronizarObras/apagar", erroApagar);
    return "Não foi possível atualizar o acesso por obra. Tente de novo pela edição do usuário.";
  }

  if (obras.length === 0) return null;

  const { error: erroInserir } = await client
    .from("obra_usuario")
    .insert(obras.map((obra_id) => ({ obra_id, perfil_id: perfilId })));
  if (erroInserir) {
    console.error("sincronizarObras/inserir", erroInserir);
    return "O usuário foi salvo, mas o acesso por obra não foi vinculado. Abra a edição dele e salve as obras de novo.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Criar usuário (e-mail + senha temporária) — usa a API admin (service_role).
// ---------------------------------------------------------------------------
export async function criarUsuario(raw: unknown): Promise<ActionResult> {
  const master = await exigirMaster();
  if (!master) return falha("Apenas o Master pode criar usuários.");

  const parsed = criarUsuarioSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return falha(
      "Criação indisponível: falta a chave SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    );
  }

  const { data: criado, error: errAuth } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: { nome: parsed.data.nome },
  });
  if (errAuth || !criado?.user) {
    const jaExiste =
      errAuth?.message?.toLowerCase().includes("already") ||
      errAuth?.message?.toLowerCase().includes("registered");
    return falha(
      jaExiste
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível criar o usuário. Tente novamente.",
    );
  }

  const uid = criado.user.id;
  // O trigger handle_new_user já criou o perfil; ajustamos org/papel/nome/ativo.
  //
  // Client ADMIN aqui é justificado, e é a exceção: o perfil acabou de nascer
  // com `org_id` NULO, então nenhuma policy escopada por organização o
  // alcança. É bootstrap de linha que ainda não pertence a org nenhuma.
  const { data: perfilAjustado, error: erroPerfil } = await admin
    .from("perfil")
    .update({
      org_id: master.org_id,
      papel: parsed.data.papel,
      nome: parsed.data.nome,
      ativo: true,
      modulos: modulosOuNull(parsed.data.modulos),
      senha_temporaria: true, // força troca no primeiro acesso
    })
    .eq("id", uid)
    .select("id");

  // Falhar aqui deixava o pior estado possível, em silêncio: a conta existe no
  // acesso e o perfil dela não tem organização, papel nem módulos — a pessoa
  // entra e não vê nada, e recriar responde "já existe um usuário com este
  // e-mail". Desfazemos a criação para que o master possa tentar de novo.
  if (erroPerfil || !perfilAjustado?.length) {
    console.error("criarUsuario/perfil", erroPerfil ?? "update atingiu 0 linhas");
    try {
      await admin.auth.admin.deleteUser(uid);
    } catch (e) {
      console.error("criarUsuario/rollback", e);
      return falha(
        "O usuário foi criado no acesso, mas o perfil não pôde ser " +
          "configurado e a reversão também falhou. Avise o suporte antes de " +
          "tentar de novo.",
      );
    }
    return falha(
      "Não foi possível configurar o perfil do usuário. Tente novamente.",
    );
  }

  // `obra_usuario` é tabela da aplicação: client NORMAL, com a RLS valendo.
  const avisoObras = await sincronizarObras(
    await createClient(),
    uid,
    parsed.data.obras,
  );

  // E-mail de boas-vindas com os dados de acesso (best-effort).
  if (emailConfigurado()) {
    try {
      await enviarEmail(
        [parsed.data.email],
        acessoCriado(
          {
            nome: parsed.data.nome,
            email: parsed.data.email,
            senha: parsed.data.senha,
            perfil: PAPEL_INFO[parsed.data.papel as Papel]?.label ?? parsed.data.papel,
          },
          await contextoEmail(master.org_id),
        ),
      );
    } catch (e) {
      console.error("Falha ao enviar e-mail de novo usuário:", e);
    }
  }

  revalidatePath("/usuarios");
  // A conta existe e funciona; o que pode ter faltado é o vínculo de obra.
  return { ok: true, id: uid, aviso: avisoObras ?? undefined };
}

// ---------------------------------------------------------------------------
// Excluir usuário (auth + perfil em cascata). Só master; nunca a si mesmo.
// ---------------------------------------------------------------------------
export async function excluirUsuario(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const master = await exigirMaster();
  if (!master) return { error: "Apenas o Master pode excluir usuários." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Usuário inválido." };
  if (id === master.id) {
    return { error: "Você não pode excluir o seu próprio acesso." };
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(id); // cascata remove perfil e vínculos
  } catch (e) {
    console.error("Falha ao excluir usuário:", e);
    return {
      error:
        "Não foi possível excluir. Verifique a chave SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  revalidatePath("/usuarios");
}

// ---------------------------------------------------------------------------
// Editar usuário — papel, nome, ativo, obras e (opcional) redefinir senha.
// ---------------------------------------------------------------------------
export async function salvarUsuario(raw: unknown): Promise<ActionResult> {
  const master = await exigirMaster();
  if (!master) return falha("Apenas o Master pode editar usuários.");

  const parsed = editarUsuarioSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { ativo } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfil")
    .update({
      papel: parsed.data.papel,
      nome: parsed.data.nome,
      ativo,
      modulos: modulosOuNull(parsed.data.modulos),
    })
    .eq("id", parsed.data.id);
  if (error) return falha("Não foi possível salvar. Tente novamente.");

  // Redefinição opcional de senha (via API admin).
  const novaSenha = parsed.data.nova_senha;
  if (novaSenha) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(parsed.data.id, {
        password: novaSenha,
      });
      // Nova senha definida pelo master é temporária: força troca no próximo acesso.
      //
      // Se este carimbo não for gravado, a senha que o master escolheu — e
      // conhece — vira a senha definitiva da pessoa, sem que o sistema peça a
      // troca. É a falha silenciosa mais cara desta ação.
      const { error: erroTemp } = await admin
        .from("perfil")
        .update({ senha_temporaria: true })
        .eq("id", parsed.data.id);
      if (erroTemp) {
        console.error("salvarUsuario/senhaTemporaria", erroTemp);
        return falha(
          "A senha foi redefinida, mas o sistema não conseguiu marcar a troca " +
            "obrigatória no próximo acesso. Avise a pessoa para trocar a senha " +
            "no Perfil assim que entrar.",
        );
      }
    } catch {
      return falha(
        "Perfil salvo, mas a senha não pôde ser redefinida (falta SUPABASE_SERVICE_ROLE_KEY).",
      );
    }

    // E-mail avisando a nova senha (best-effort).
    if (emailConfigurado()) {
      try {
        const { data: u } = await supabase
          .from("perfil")
          .select("email")
          .eq("id", parsed.data.id)
          .single();
        if (u?.email) {
          await enviarEmail(
            [u.email],
            senhaRedefinida(
              { nome: parsed.data.nome, email: u.email, senha: novaSenha },
              await contextoEmail(master.org_id),
            ),
          );
        }
      } catch (e) {
        console.error("Falha ao enviar e-mail de redefinição:", e);
      }
    }
  }

  // Sincroniza acesso por obra (client normal; master tem policy de gestão).
  const avisoObras = await sincronizarObras(
    supabase,
    parsed.data.id,
    parsed.data.obras,
  );

  revalidatePath("/usuarios");
  // O usuário foi salvo: devolver `ok: false` por causa do vínculo faria a
  // pessoa achar que nada foi gravado e salvar de novo. `aviso` é exatamente
  // para "deu certo, com ressalva que precisa ser lida".
  return { ok: true, id: parsed.data.id, aviso: avisoObras ?? undefined };
}
