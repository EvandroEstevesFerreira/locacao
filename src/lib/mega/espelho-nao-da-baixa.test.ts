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

  // A PROMESSA ESTREITOU NA v0.113.0, E CONTINUA SENDO A QUE IMPORTA.
  // Antes: nenhum arquivo do Mega mencionava `lancamento_financeiro`. Agora a
  // conciliação existe, e ela LÊ os lançamentos para propor o casamento. O que
  // segue proibido é o cron ESCREVER neles: quem escreve é a server action de
  // confirmação, com sessão de usuário e com um humano tendo clicado.
  //
  // Sem esta varredura, alguém "otimiza" a confirmação daqui a seis meses
  // movendo a escrita para dentro do cron, e a fila humana vira baixa
  // automática sem ninguém ter decidido isso.
  it("nenhum arquivo do Mega escreve em lancamento_financeiro", () => {
    const ESCRITAS = ["insert(", "update(", "upsert(", "delete("];
    for (const { caminho, conteudo } of arquivosDoMega()) {
      const linhas = conteudo.split("\n");
      linhas.forEach((linha, i) => {
        if (!linha.includes("lancamento_financeiro")) return;
        // A menção é o `.from("lancamento_financeiro")`; o verbo vem depois,
        // na mesma linha ou nas próximas — o PostgREST encadeia.
        const janela = linhas.slice(i, i + 4).join("\n");
        for (const verbo of ESCRITAS) {
          expect(
            janela.includes(verbo),
            `${caminho}:${i + 1} escreve em lancamento_financeiro com ${verbo} — ` +
              "o cron PROPÕE, quem dá baixa é a server action de confirmação, " +
              "com sessão de usuário. Ver a spec de 2026-09-16.",
          ).toBe(false);
        }
      });
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
