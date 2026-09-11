import { normalizarCnpj, formatarCnpj, cnpjValido } from "./cnpj";

/**
 * CPF ou CNPJ no mesmo campo.
 *
 * POR QUE UM CAMPO SÓ: locador de imóvel é quase sempre pessoa física, com
 * algumas imobiliárias no meio. Dois campos obrigariam quem cadastra a escolher
 * o tipo antes de digitar — e o próprio número já diz o que ele é, pelo
 * tamanho.
 *
 * O CNPJ delega para `src/lib/cnpj.ts`, que já trata o formato alfanumérico
 * vigente a partir de 2026. Aqui mora só o CPF e a escolha entre os dois.
 */

export type TipoDocumento = "cpf" | "cnpj";

export function normalizarDocumento(valor: string | null | undefined): string {
  return (valor ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 14);
}

/** Pelo tamanho: 11 é CPF, 14 é CNPJ. Qualquer outro é indefinido. */
export function tipoDeDocumento(valor: string | null | undefined): TipoDocumento | null {
  const d = normalizarDocumento(valor);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

function cpfValido(bruto: string): boolean {
  const c = bruto.replace(/\D/g, "");
  if (c.length !== 11) return false;
  // Repetição (111.111.111-11) passa no cálculo do DV e não é CPF de ninguém.
  if (/^(\d)\1{10}$/.test(c)) return false;

  for (const [ate, pesoInicial] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) soma += Number(c[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    const dv = resto === 10 ? 0 : resto;
    if (dv !== Number(c[ate])) return false;
  }
  return true;
}

/**
 * Formato E dígito verificador.
 *
 * O DV É O QUE SEPARA "digitado" de "conferido". Sem ele, um CPF trocado num
 * dígito entra no cadastro e vai buscar no Mega o agente de OUTRA pessoa — e a
 * tela passa a mostrar o pagamento de um terceiro como se fosse deste imóvel.
 */
export function documentoValido(valor: string | null | undefined): boolean {
  const tipo = tipoDeDocumento(valor);
  if (tipo === "cpf") return cpfValido(normalizarDocumento(valor));
  if (tipo === "cnpj") return cnpjValido(normalizarCnpj(valor ?? ""));
  return false;
}

/** Máscara progressiva, para o campo poder ser usado enquanto se digita. */
export function formatarDocumento(valor: string | null | undefined): string {
  const d = normalizarDocumento(valor);
  if (d.length === 0) return "";
  // Acima de 11 caracteres só pode ser CNPJ; abaixo, trata como CPF em
  // digitação. Travar a máscara até completar faria o cursor pular.
  if (d.length > 11) return formatarCnpj(d);
  if (/[A-Z]/.test(d)) return formatarCnpj(d); // CNPJ alfanumérico em digitação

  let out = d.slice(0, 3);
  if (d.length > 3) out += "." + d.slice(3, 6);
  if (d.length > 6) out += "." + d.slice(6, 9);
  if (d.length > 9) out += "-" + d.slice(9, 11);
  return out;
}
