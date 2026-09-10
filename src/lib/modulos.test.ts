import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";
import {
  MODULOS,
  moduloDaRota,
  moduloLiberado,
  normalizarModulos,
  exigirModulo,
  moduloFechado,
  MODULOS_FECHADOS,
  GRUPOS_MODULO,
  modulosDoGrupo,
} from "./modulos";

describe("moduloDaRota", () => {
  it("mapeia a rota base e as subrotas para o módulo", () => {
    expect(moduloDaRota("/imoveis")).toBe("imoveis");
    expect(moduloDaRota("/imoveis/123")).toBe("imoveis");
    expect(moduloDaRota("/imoveis/123/editar")).toBe("imoveis");
    expect(moduloDaRota("/financeiro")).toBe("financeiro");
  });

  it("retorna null para rotas não moduláveis", () => {
    expect(moduloDaRota("/")).toBeNull();
    expect(moduloDaRota("/perfil")).toBeNull();
    expect(moduloDaRota("/usuarios")).toBeNull();
    expect(moduloDaRota("/configuracoes")).toBeNull();
  });

  it("não confunde prefixos parecidos", () => {
    // "/obras" não deve casar com uma hipotética "/obras-arquivadas"
    expect(moduloDaRota("/obras-arquivadas")).toBeNull();
  });
});

describe("moduloLiberado", () => {
  it("master sempre acessa, mesmo com whitelist restrita", () => {
    expect(moduloLiberado([], true, "imoveis")).toBe(true);
    expect(moduloLiberado(["obras"], true, "financeiro")).toBe(true);
  });

  it("null = acesso a todos (retrocompatível)", () => {
    expect(moduloLiberado(null, false, "imoveis")).toBe(true);
    expect(moduloLiberado(undefined, false, "financeiro")).toBe(true);
  });

  it("whitelist restringe aos módulos presentes", () => {
    expect(moduloLiberado(["imoveis", "financeiro"], false, "imoveis")).toBe(true);
    expect(moduloLiberado(["imoveis"], false, "financeiro")).toBe(false);
    expect(moduloLiberado([], false, "obras")).toBe(false);
  });
});

describe("normalizarModulos", () => {
  it("mantém apenas chaves de módulo válidas", () => {
    expect(normalizarModulos(["imoveis", "hack", "financeiro", ""])).toEqual([
      "imoveis",
      "financeiro",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VARREDURA DE ROTAS — a trava que faltava
// ═══════════════════════════════════════════════════════════════════════════
//
// `recebimentos` existia como rota desde a 0.39.0 e NÃO estava em `MODULOS`.
// Consequência: o middleware só checa permissão quando `moduloDaRota` devolve
// algo, então `/recebimentos` era acessível a QUALQUER usuário autenticado,
// independente dos módulos liberados para ele. Nenhum teste pegava, porque a
// tela funcionava perfeitamente — para todo mundo.
//
// Esta varredura lê o diretório de rotas em vez de uma lista escrita à mão.
// Rota nova entra na checagem por EXISTIR, e a única forma de escapar é
// declará-la explicitamente como não-modulável na lista abaixo — que é uma
// decisão consciente, não um esquecimento.
describe("varredura de rotas contra módulos", () => {
  /**
   * Rotas que de propósito não têm módulo.
   *
   * Toda entrada aqui precisa de justificativa: se a rota podia ser modulável e
   * não é, o resultado é acesso liberado para todo mundo em silêncio.
   */
  const SEM_MODULO: Record<string, string> = {
    _components: "não é rota — é a pasta de componentes co-localizados da home",
    novidades: "changelog do produto; esconder de alguém não protege nada",
    perfil: "o próprio usuário; negar acesso trancaria a pessoa fora da conta",
    "trocar-senha": "onboarding obrigatório, precede qualquer permissão",
    usuarios: "gestão de acesso, restrita por papel (master) e não por módulo",
    configuracoes: "idem — restrita a master pelo `apenasMaster` do nav",
    treinamento: "trilhas e comprovante do próprio usuário; trancar o treinamento e esconder a chave seria o contrário do que ele existe para fazer",
    ajuda: "manual do sistema; esconder de alguém não protege nada e atrapalha tudo",
  };

  const dirRotas = path.join(process.cwd(), "src/app/(app)");
  const rotas = fs
    .readdirSync(dirRotas, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  it("achou as rotas para verificar", () => {
    // Sem esta trava, mudar a estrutura de pastas transformaria a varredura num
    // teste vazio que passa sempre.
    expect(rotas.length).toBeGreaterThan(10);
  });

  it("toda rota de primeiro nível é modulável ou declarada como exceção", () => {
    const orfas = rotas.filter(
      (r) => !(r in SEM_MODULO) && moduloDaRota(`/${r}`) === null,
    );
    expect(
      orfas,
      "Rotas sem módulo e sem justificativa — QUALQUER usuário autenticado " +
        "acessa, porque o middleware só checa permissão quando `moduloDaRota` " +
        "devolve algo. Acrescente ao MODULOS de src/lib/modulos.ts ou, se for " +
        "deliberado, a SEM_MODULO deste teste com o motivo:\n  " +
        orfas.join("\n  "),
    ).toEqual([]);
  });

  it("toda exceção declarada realmente existe — lista morta engana", () => {
    const inexistentes = Object.keys(SEM_MODULO).filter((r) => !rotas.includes(r));
    expect(
      inexistentes,
      `Em SEM_MODULO mas não existe mais em src/app/(app): ${inexistentes.join(", ")}`,
    ).toEqual([]);
  });

  it("todo módulo declarado tem a rota correspondente no disco", () => {
    const semPasta = MODULOS.filter(
      (m) => !rotas.includes(m.href.replace(/^\//, "")),
    ).map((m) => `${m.chave} → ${m.href}`);
    expect(
      semPasta,
      `Módulo aponta para rota que não existe: ${semPasta.join(", ")}`,
    ).toEqual([]);
  });

  // A verificação da PASTA não bastava, e o furo durou da 0.39.0 à 0.56.0:
  // `src/app/(app)/recebimentos/` existia com `[id]/page.tsx` dentro, então a
  // pasta estava lá, o módulo estava declarado, o item aparecia no menu — e
  // clicar nele dava 404, porque não havia `page.tsx` na raiz da rota.
  //
  // Pasta é o que o desenvolvedor cria; `page.tsx` é o que o usuário abre. A
  // trava tem de ser sobre o segundo.
  it("todo módulo tem page.tsx na RAIZ da rota — pasta não é página", () => {
    const semPagina = MODULOS.filter((m) => {
      const pasta = m.href.replace(/^\//, "");
      return !fs.existsSync(path.join(dirRotas, pasta, "page.tsx"));
    }).map((m) => `${m.chave} → ${m.href}`);
    expect(
      semPagina,
      "Módulo no menu apontando para rota sem página: o usuário clica e " +
        `recebe 404.\n  ${semPagina.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("exigirModulo — a guarda das server actions", () => {
  const operador = (modulos: string[] | null) => ({ papel: "operador", modulos });

  it("libera quem tem o módulo na lista", () => {
    expect(exigirModulo(operador(["frota", "itens"]), "frota")).toBeNull();
  });

  it("RECUSA quem não tem, com o rótulo do módulo na mensagem", () => {
    // O middleware só barra GET. Sem esta guarda, um operador com a Frota
    // desmarcada continuava movimentando peça por uma aba que ficou aberta.
    const r = exigirModulo(operador(["itens"]), "frota");
    expect(r).toContain("Frota");
  });

  it("`modulos` nulo continua liberando tudo", () => {
    // Retrocompatível: é o estado de quem nunca teve módulos definidos, e
    // mudar isso trancaria a base inteira num deploy.
    expect(exigirModulo(operador(null), "frota")).toBeNull();
  });

  it("master passa mesmo com a lista vazia", () => {
    expect(exigirModulo({ papel: "master", modulos: [] }, "frota")).toBeNull();
  });

  it("sem perfil, recusa", () => {
    expect(exigirModulo(null, "frota")).toBeTruthy();
    expect(exigirModulo(undefined, "frota")).toBeTruthy();
  });
});

describe("MODULOS_FECHADOS", () => {
  it("a Frota nega quando não dá para conferir", () => {
    expect(moduloFechado("frota")).toBe(true);
  });

  it("o resto do sistema continua fail-open", () => {
    // A lista tem de continuar curta: cada nome nela é um lugar onde uma
    // instabilidade de banco vira gente impedida de trabalhar.
    expect(moduloFechado("obras")).toBe(false);
    expect(moduloFechado("financeiro")).toBe(false);
    expect(MODULOS_FECHADOS.length).toBeLessThanOrEqual(3);
  });
});

describe("grupos de módulo", () => {
  it("todo módulo pertence a um grupo conhecido", () => {
    // Vacuity: sem isto, um módulo novo sem grupo sumiria do cadastro de
    // usuário — e sumir do cadastro é ficar liberado para sempre.
    for (const m of MODULOS) {
      expect(GRUPOS_MODULO).toContain(m.grupo);
    }
  });

  it("todo grupo tem ao menos um módulo", () => {
    for (const g of GRUPOS_MODULO) {
      expect(modulosDoGrupo(g).length).toBeGreaterThan(0);
    }
  });

  it("os grupos cobrem os 14 módulos, sem sobra nem repetição", () => {
    const somados = GRUPOS_MODULO.flatMap(modulosDoGrupo);
    expect(somados.sort()).toEqual(MODULOS.map((m) => m.chave).sort());
  });

  it("Frota, Itens e Termos ficam no mesmo grupo", () => {
    // O atalho que resolve "não quero lembrar de desmarcar os três": eles
    // controlam o mesmo assunto — onde a peça está, o catálogo dela e quem
    // assinou por ela.
    const equipamento = modulosDoGrupo("Equipamento");
    expect(equipamento).toEqual(expect.arrayContaining(["frota", "itens", "termos"]));
  });
});
