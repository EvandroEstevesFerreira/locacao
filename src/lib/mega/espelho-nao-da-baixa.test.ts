import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * As duas promessas da onda 1, cobradas por varredura em vez de por confiança.
 *
 * Comentário não impede ninguém de nada. Estas promessas são as que, quebradas,
 * causam dano de verdade: baixa indevida em conta a pagar, e um cron que
 * dispara no meio da madrugada.
 */

const RAIZ = join(process.cwd(), "src", "lib", "mega");
const ROTA_CRON = join(process.cwd(), "src", "app", "api", "cron", "mega", "route.ts");

function arquivosDoMega(): { caminho: string; conteudo: string }[] {
  const nomes = readdirSync(RAIZ).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
  const arquivos = nomes.map((n) => ({
    caminho: join(RAIZ, n),
    conteudo: readFileSync(join(RAIZ, n), "utf8"),
  }));
  arquivos.push({ caminho: ROTA_CRON, conteudo: readFileSync(ROTA_CRON, "utf8") });
  return arquivos;
}

describe("o espelho do Mega não dá baixa", () => {
  // SEM ISTO A VARREDURA PASSA POR VACUIDADE. Já aconteceu duas vezes neste
  // repositório: guarda que não acha arquivo nenhum passa sempre e não guarda
  // nada. O número é conferido antes de qualquer asserção sobre conteúdo.
  it("a varredura encontra os arquivos que deveria", () => {
    const arquivos = arquivosDoMega();
    expect(arquivos.length).toBeGreaterThanOrEqual(4);
    const nomes = arquivos.map((a) => a.caminho);
    expect(nomes.some((n) => n.includes("cliente.ts"))).toBe(true);
    expect(nomes.some((n) => n.includes("servidor.ts"))).toBe(true);
    expect(nomes.some((n) => n.includes("route.ts"))).toBe(true);
  });

  // A ONDA 1 É SEGURA PORQUE SÓ LÊ. Espelhar dá para fazer mesmo com o
  // casamento fornecedor↔título errado: o pior caso é uma tela mostrar coisa
  // errada, e alguém corrigir. Dar baixa com casamento errado marca como paga
  // uma conta que ninguém pagou — e isso ninguém percebe olhando a tela.
  it("nenhum arquivo do Mega escreve em lancamento_financeiro", () => {
    for (const { caminho, conteudo } of arquivosDoMega()) {
      expect(
        conteudo.includes("lancamento_financeiro"),
        `${caminho} menciona lancamento_financeiro — a baixa automática é outra onda, e precisa de decisão sobre a data de pagamento antes de existir.`,
      ).toBe(false);
    }
  });

  it("o cron não usa o cliente comum, que passaria por RLS sem sessão", () => {
    const rota = readFileSync(ROTA_CRON, "utf8");
    expect(rota).toContain("createAdminClient");
  });
});

describe("o horário do cron", () => {
  // A VERCEL RODA CRON EM UTC. Quem "corrigir" isto para `30 7` acreditando
  // estar escrevendo 07:30 vai mover a rodada para 04:30 da manhã em Brasília,
  // e não há nada na tela que denuncie — o dado só chega mais cedo, o que
  // ninguém estranha. O combinado com o Evandro é 07:30 de Brasília.
  it("dispara às 07:30 de Brasília, escrito em UTC", () => {
    const vercel = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    const mega = vercel.crons.find((c) => c.path === "/api/cron/mega");
    expect(mega, "o cron /api/cron/mega sumiu do vercel.json").toBeDefined();
    expect(mega!.schedule).toBe("30 10 * * *");
  });
});
