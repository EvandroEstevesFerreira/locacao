/**
 * CNPJ alfanumérico (padrão vigente a partir de 2026).
 * - 14 posições: as 12 primeiras aceitam letras (A-Z) e dígitos (0-9);
 *   as 2 últimas (dígitos verificadores) são numéricas.
 * - Cálculo do DV: valor de cada caractere = código ASCII − 48
 *   ('0'→0 … '9'→9, 'A'→17 … 'Z'→42), com pesos mód. 11.
 */

/** Remove máscara, deixa maiúsculo e limita a 14 caracteres alfanuméricos. */
export function normalizarCnpj(valor: string): string {
  return (valor ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);
}

/** Aplica a máscara XX.XXX.XXX/XXXX-XX progressivamente (para digitação). */
export function formatarCnpj(valor: string): string {
  const c = normalizarCnpj(valor);
  let out = c.slice(0, 2);
  if (c.length > 2) out += "." + c.slice(2, 5);
  if (c.length > 5) out += "." + c.slice(5, 8);
  if (c.length > 8) out += "/" + c.slice(8, 12);
  if (c.length > 12) out += "-" + c.slice(12, 14);
  return out;
}

function digitoVerificador(base: string, pesos: number[]): number {
  const soma = base
    .split("")
    .reduce((acc, ch, i) => acc + (ch.charCodeAt(0) - 48) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida um CNPJ alfanumérico (formato + dígitos verificadores). */
export function cnpjValido(valor: string): boolean {
  const c = normalizarCnpj(valor);
  if (c.length !== 14) return false;
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(c)) return false;
  if (/^(.)\1{13}$/.test(c)) return false; // rejeita repetições (ex.: 000...)

  const dv1 = digitoVerificador(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digitoVerificador(
    c.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return dv1 === Number(c[12]) && dv2 === Number(c[13]);
}
