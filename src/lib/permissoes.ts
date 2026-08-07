// Tipos, rótulos e helpers de permissão — SEM dependências de servidor.
// Pode ser importado tanto por Server Components quanto por Client Components.

import { z } from "zod";

export type Papel = "master" | "administrador" | "gestor" | "operador";

export type Perfil = {
  id: string;
  org_id: string | null;
  nome: string | null;
  email: string | null;
  papel: Papel;
  /**
   * Módulos liberados para o usuário. `null` = acesso total (retrocompatível
   * com quem nunca teve módulos definidos). Vem no mesmo select que o resto do
   * perfil para que o layout e as páginas compartilhem uma única consulta.
   */
  modulos: string[] | null;
};

/** Rótulo e descrição de cada perfil (usado nas telas de usuários). */
export const PAPEL_INFO: Record<Papel, { label: string; descricao: string }> = {
  master: {
    label: "Master",
    descricao: "Acesso total, incluindo usuários, configurações e exclusões.",
  },
  administrador: {
    label: "Administrador",
    descricao: "Acesso total, exceto configuração master (usuários e sistema).",
  },
  gestor: {
    label: "Gestor",
    descricao: "Analisa dados: lê tudo e gera relatórios, sem editar.",
  },
  operador: {
    label: "Operador",
    descricao: "Opera contratos, devoluções e vistorias.",
  },
};

export const PAPEIS: Papel[] = ["master", "administrador", "gestor", "operador"];

// ---------------------------------------------------------------------------
// Helpers de permissão — espelham a matriz de perfis (ver migration 0011).
// ---------------------------------------------------------------------------

/** Cadastros (obras, fornecedores, itens): master/administrador. */
export function podeEditarCadastros(papel: Papel | undefined): boolean {
  return papel === "master" || papel === "administrador";
}

/** Operacional (contratos, movimentação/devolução, vistorias): + operador. */
export function podeOperar(papel: Papel | undefined): boolean {
  return (
    papel === "master" || papel === "administrador" || papel === "operador"
  );
}

/** Financeiro (lançar/dar baixa): master/administrador. */
export function podeGerenciarFinanceiro(papel: Papel | undefined): boolean {
  return papel === "master" || papel === "administrador";
}

/** Gestão de usuários e perfis: somente master. */
export function podeGerenciarUsuarios(papel: Papel | undefined): boolean {
  return papel === "master";
}

/** Configurações do sistema (alertas, integrações): somente master. */
export function podeConfigurarSistema(papel: Papel | undefined): boolean {
  return papel === "master";
}

/** Exclusão de dados críticos (obras, contratos): somente master. */
export function podeExcluirCritico(papel: Papel | undefined): boolean {
  return papel === "master";
}

// ── Schemas ──────────────────────────────────────────────────────────────────
// Ficam aqui, e não dentro de um `actions.ts`, porque um arquivo "use server"
// não pode ser importado por componente cliente — e o formulário precisa do
// schema para validar por campo com o zodResolver. Este arquivo é puro e
// client-safe, então serve aos dois lados. (Ver AGENTS.md § Formulários.)


export const SENHA_MINIMA = 8;

export const trocarSenhaSchema = z
  .object({
    senha: z
      .string()
      .min(SENHA_MINIMA, `A senha deve ter ao menos ${SENHA_MINIMA} caracteres.`),
    confirmar: z.string().min(1, "Confirme a nova senha."),
  })
  // O `.refine` canônico: a comparação entre dois campos é exatamente o que o
  // zodResolver resolve bem e que a validação campo-a-campo do HTML não pega.
  .refine((d) => d.senha === d.confirmar, {
    message: "As senhas não conferem.",
    path: ["confirmar"],
  });

export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>;
