// Biblioteca de documentos do alojamento — tipos/rótulos (client-safe).

export type CategoriaBiblioteca =
  | "normativo"
  | "formulario"
  | "placa"
  | "comunicacao"
  | "outro";

export const CATEGORIAS_BIBLIOTECA: CategoriaBiblioteca[] = [
  "normativo",
  "formulario",
  "placa",
  "comunicacao",
  "outro",
];

export const CATEGORIA_BIBLIOTECA_INFO: Record<
  CategoriaBiblioteca,
  { label: string; descricao: string }
> = {
  normativo: { label: "Normativos", descricao: "Políticas e regulamentos (ex.: POL-RH-001)." },
  formulario: { label: "Formulários", descricao: "Termos, checklists e formulários (FRM-RH)." },
  placa: { label: "Placas / Sinalização", descricao: "Placas padronizadas para imprimir e afixar." },
  comunicacao: { label: "Comunicação", descricao: "E-mails e comunicados de implantação." },
  outro: { label: "Outros", descricao: "Demais documentos." },
};

export function categoriaBibliotecaLabel(c: string): string {
  return CATEGORIA_BIBLIOTECA_INFO[c as CategoriaBiblioteca]?.label ?? "Outros";
}
