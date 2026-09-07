import type { PessoaPeople } from "./contrato";

/**
 * O cruzamento das 118 linhas escritas à mão com as 483 do People.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * A tabela `funcionario` de hoje tem ZERO CPF e ZERO matrícula. A única coisa
 * comparável é o nome — e os nomes do Loca estão abreviados ("Evandro
 * Ferreira") contra o nome completo do People ("Evandro Esteves Ferreira").
 *
 * ISTO SUGERE, NUNCA DECIDE. Vincular a pessoa errada gruda o histórico de
 * equipamento de alguém no cadastro de outro — e o erro só aparece quando
 * alguém for cobrar a devolução de quem nunca recebeu nada.
 */

/** Tira acentos, baixa a caixa e reduz a espaço simples. */
export function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * As partículas que não identificam ninguém.
 *
 * "João DA Silva" e "João Silva" são a mesma pessoa, e manter o "da" faria a
 * comparação por ordem falhar entre as duas grafias.
 */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function partes(nome: string): string[] {
  return normalizar(nome)
    .split(" ")
    .filter((p) => p.length > 0 && !PARTICULAS.has(p));
}

/**
 * O nome curto do Loca cabe dentro do nome completo do People?
 *
 * SUBSEQUÊNCIA NA ORDEM, e não "primeiro + último". O documento do People
 * mediu com primeiro+último e a heurística quebrava no nome do meio: "Andre
 * Piva" virava a chave "andre piva", que não bate com "Andre Piva Correa"
 * quando se compara primeiro+último ("andre correa").
 *
 * Aqui "andre piva" ⊂ "andre piva correa" casa, e "evandro ferreira" ⊂
 * "evandro esteves ferreira" também. A ordem importa: "silva joao" NÃO casa com
 * "joao silva", porque nome invertido é outro registro e não um apelido.
 */
export function cabeDentro(curto: string[], completo: string[]): boolean {
  if (curto.length === 0) return false;
  let i = 0;
  for (const parte of completo) {
    if (parte === curto[i]) i++;
    if (i === curto.length) return true;
  }
  return false;
}

export type Classificacao = "unico" | "ambiguo" | "sem_candidato";

export type Candidato = {
  peopleId: string;
  nome: string;
  situacao: PessoaPeople["situacao"];
  cargo: string | null;
  matricula: string | null;
};

export type Sugestao = {
  funcionarioId: string;
  nomeLoca: string;
  classificacao: Classificacao;
  candidatos: Candidato[];
  /**
   * Nome de uma palavra só ("Lourival").
   *
   * Pode casar com um único candidato e ainda assim ser palpite: um primeiro
   * nome sozinho não identifica ninguém numa base de 483. Sai da conciliação
   * automática mesmo quando `classificacao` é `unico`.
   */
  nomeFraco: boolean;
};

export type FuncionarioLocal = { id: string; nome: string };

/**
 * As sugestões, uma por funcionário ainda sem `people_id`.
 *
 * Não devolve "o melhor palpite": devolve TODOS os candidatos que cabem, e a
 * classificação diz se dá para confiar. Escolher entre dois "Tiago Silva" é
 * decisão de quem conhece as pessoas.
 */
export function conciliar(
  locais: FuncionarioLocal[],
  pessoas: PessoaPeople[],
): Sugestao[] {
  const doPeople = pessoas.map((p) => ({ pessoa: p, partes: partes(p.nome) }));

  return locais.map((local) => {
    const curto = partes(local.nome);
    const candidatos = doPeople
      .filter((p) => cabeDentro(curto, p.partes))
      .map<Candidato>((p) => ({
        peopleId: p.pessoa.id,
        nome: p.pessoa.nome,
        situacao: p.pessoa.situacao,
        cargo: p.pessoa.cargo,
        matricula: p.pessoa.matricula,
      }));

    const classificacao: Classificacao =
      candidatos.length === 0
        ? "sem_candidato"
        : candidatos.length === 1
          ? "unico"
          : "ambiguo";

    return {
      funcionarioId: local.id,
      nomeLoca: local.nome,
      classificacao,
      candidatos,
      nomeFraco: curto.length < 2,
    };
  });
}

/**
 * As que podem ser vinculadas em lote.
 *
 * Candidato único E nome com pelo menos duas partes. Duas linhas do Loca nunca
 * apontam para a MESMA pessoa do People aqui: se "Alex Felipe" e "Alex Vidal
 * Felipe" casarem com o mesmo cadastro — e o documento avisa que há três pares
 * assim —, as duas saem do lote e vão para decisão humana, porque uma delas é
 * duplicata que precisa ser resolvida antes, não vinculada junto.
 */
export function inequivocas(sugestoes: Sugestao[]): Sugestao[] {
  const fortes = sugestoes.filter(
    (s) => s.classificacao === "unico" && !s.nomeFraco,
  );

  const quantos = new Map<string, number>();
  for (const s of fortes) {
    const id = s.candidatos[0].peopleId;
    quantos.set(id, (quantos.get(id) ?? 0) + 1);
  }

  return fortes.filter((s) => quantos.get(s.candidatos[0].peopleId) === 1);
}

/** Contagem por classificação, para a tela dizer o tamanho do trabalho. */
export function resumo(sugestoes: Sugestao[]) {
  const automaticas = inequivocas(sugestoes).length;
  return {
    total: sugestoes.length,
    automaticas,
    manuais: sugestoes.length - automaticas,
    ambiguas: sugestoes.filter((s) => s.classificacao === "ambiguo").length,
    semCandidato: sugestoes.filter((s) => s.classificacao === "sem_candidato")
      .length,
  };
}
