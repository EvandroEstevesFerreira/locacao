// Telefone: uma forma canônica para guardar, uma para exibir.
//
// O padrão é `+DDI (DD) XXXXX-XXXX`. Guarda-se só dígitos com o DDI
// ("5511947071104") e formata-se na exibição — uma forma canônica, não duas.
// Dois formatos guardados no mesmo campo é como um diverge do outro: o cadastro
// tinha "11 95914-0002" ao lado de "5511980765016", e nenhuma busca casava os
// dois.
//
// O QUE ESTA FUNÇÃO NÃO FAZ, e é deliberado: adivinhar. Só reconhece número
// brasileiro — 10 ou 11 dígitos sem DDI, ou 12 e 13 começando com 55. Qualquer
// outra coisa VOLTA COMO FOI DIGITADA, inclusive "ramal 22" e número
// estrangeiro. Máscara sobre dado que não se entendeu não é formatação, é
// invenção: "ramal 22" virando "+55 (2) 2" seria pior que exibir estranho,
// porque exibiria errado.
//
// Fica em arquivo próprio porque `imoveis`, `termo` e `config` também têm campo
// de telefone e vão querer a mesma regra.

const DDI_BR = "55";

function digitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * As partes de um telefone brasileiro, ou `null` quando não é um.
 *
 * 12 e 13 dígitos só contam como brasileiros quando começam com 55. Sem essa
 * condição, um número português de 12 dígitos ("351912345678") teria os dois
 * primeiros lidos como DDI e sairia formatado como se fosse de São Paulo.
 */
function partes(bruto: string): { ddd: string; numero: string } | null {
  const d = digitos(bruto);

  if (d.length === 10 || d.length === 11) {
    return { ddd: d.slice(0, 2), numero: d.slice(2) };
  }
  if ((d.length === 12 || d.length === 13) && d.startsWith(DDI_BR)) {
    return { ddd: d.slice(2, 4), numero: d.slice(4) };
  }
  return null;
}

/**
 * O telefone como se guarda: dígitos, com DDI.
 *
 * O que não é reconhecido volta com o texto original — preservar o que a pessoa
 * digitou vale mais que impor uma forma. Vazio devolve `null`, que é o que a
 * coluna aceita para "não informado".
 */
export function normalizarTelefone(
  bruto: string | null | undefined,
): string | null {
  const t = (bruto ?? "").trim();
  if (t === "") return null;

  const p = partes(t);
  if (!p) return t;
  return `${DDI_BR}${p.ddd}${p.numero}`;
}

/**
 * O telefone como se lê: `+55 (11) 94707-1104`.
 *
 * Celular de 9 dígitos quebra em 5+4; fixo de 8, em 4+4. Sem essa distinção o
 * fixo sairia "3456-789 0", que é o tipo de detalhe que faz alguém desconfiar
 * do sistema inteiro.
 */
export function formatarTelefone(
  bruto: string | null | undefined,
): string | null {
  const t = (bruto ?? "").trim();
  if (t === "") return null;

  const p = partes(t);
  if (!p) return t;

  const corte = p.numero.length === 9 ? 5 : 4;
  return `+${DDI_BR} (${p.ddd}) ${p.numero.slice(0, corte)}-${p.numero.slice(corte)}`;
}
