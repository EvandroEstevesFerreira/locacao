// Tipos, rótulos e helpers de permissão — SEM dependências de servidor.
// Pode ser importado tanto por Server Components quanto por Client Components.

export type Papel = "master" | "administrador" | "gestor" | "operador";

export type Perfil = {
  id: string;
  org_id: string | null;
  nome: string | null;
  email: string | null;
  papel: Papel;
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
