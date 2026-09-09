// Mutirão de custódia: descobrir com QUEM está cada peça do inventário
// importado.
//
// O PROBLEMA. A importação criou 128 peças já em uso e nunca criou o vínculo com
// a pessoa — `custodia_peca` tem 2 linhas ativas para 95 peças em uso, e o
// próprio `pecasComResponsavel` registra isso: "a tela afirma que a máquina está
// com alguém e não sabe dizer com quem". O nome existe, mas em TEXTO LIVRE nas
// observações, no formato "Com: <nome> (conforme planilha)".
//
// POR QUE ISTO É CONSERVADOR AO PONTO DE PARECER TEIMOSO. O resultado deste
// casamento vira custódia, e custódia sustenta cobrança de equipamento. Errar
// aqui atribui um notebook a quem não o tem — e ninguém descobre até a pessoa
// ser cobrada por algo que nunca recebeu. Por isso: nada de prefixo, nada de
// distância de edição, nada de primeiro nome sozinho. O que não casa com
// certeza vai para conferência humana, que é a saída honesta.

/** Conectivos de nome próprio. Não identificam ninguém. */
const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e", "del", "di"]);

/** Minúsculas, sem acento, sem pontuação, sem conectivo. */
function tokens(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !CONECTIVOS.has(t));
}

/**
 * O nome do detentor escrito nas observações da peça.
 *
 * Lê SÓ o que vem depois de "Com:" e para no primeiro separador. É o que
 * distingue o detentor atual do anterior: metade das observações traz também
 * "usuário anterior <nome>", e uma busca por nome no texto inteiro casaria com
 * quem já devolveu o equipamento.
 */
export function detentorNoTexto(observacoes: string | null | undefined): string | null {
  if (!observacoes) return null;
  const m = /(?:^|·)\s*Com:\s*([^·(]*)/i.exec(observacoes);
  if (!m) return null;
  const nome = (m[1] ?? "").trim();
  return nome.length > 0 ? nome : null;
}

export type FuncionarioCasavel = { id: string; nome: string };

export type Casamento =
  | { tipo: "exato"; funcionario: FuncionarioCasavel }
  | { tipo: "unico"; funcionario: FuncionarioCasavel }
  | { tipo: "ambiguo"; candidatos: FuncionarioCasavel[] }
  | { tipo: "nenhum" };

/**
 * Casa o nome do texto com o cadastro de funcionários.
 *
 * Três resultados aproveitáveis e um não:
 *
 * - `exato`: os tokens são os mesmos, na mesma quantidade.
 * - `unico`: todos os tokens do texto aparecem, como token INTEIRO, no nome de
 *   exatamente um funcionário. É o caso da maioria do inventário, onde a
 *   planilha guardou primeiro + último ("Marco Monteiro" → "Marco Antonio
 *   Monteiro").
 * - `ambiguo`: mais de um candidato. Devolve todos, para a pessoa escolher.
 * - `nenhum`: nada casou, ou casou de um jeito em que não se pode confiar.
 *
 * DUAS RECUSAS DELIBERADAS, e as duas custam taxa de acerto de propósito:
 *
 * 1. TOKEN INTEIRO, nunca prefixo. "Lui" não casa com "Luis". Com prefixo,
 *    "Ana" casaria com meia empresa e o mutirão gravaria custódia errada calado.
 * 2. UM TOKEN SÓ nunca casa, mesmo com candidato único. Num cadastro de 509
 *    pessoas, primeiro nome sozinho é identificação fraca; hoje pode haver um
 *    "Juliana", e amanhã a contratação da segunda torna retroativamente errado
 *    um vínculo que ninguém vai revisar.
 */
export function casarFuncionario(
  nomeDoTexto: string,
  funcionarios: FuncionarioCasavel[],
): Casamento {
  const alvo = tokens(nomeDoTexto);
  if (alvo.length === 0) return { tipo: "nenhum" };

  const exato = funcionarios.find((f) => {
    const t = tokens(f.nome);
    return t.length === alvo.length && t.every((x, i) => x === alvo[i]);
  });
  if (exato) return { tipo: "exato", funcionario: exato };

  if (alvo.length < 2) return { tipo: "nenhum" };

  const candidatos = funcionarios.filter((f) => {
    const t = new Set(tokens(f.nome));
    return alvo.every((x) => t.has(x));
  });

  if (candidatos.length === 1) return { tipo: "unico", funcionario: candidatos[0]! };
  if (candidatos.length > 1) return { tipo: "ambiguo", candidatos };
  return { tipo: "nenhum" };
}
