import { describe, it, expect } from "vitest";
import { obraSchema } from "./obra";
import { vencimentosCentral, vencimentosObra } from "./emails/templates";
import type { LinhaAlerta, GrupoAlerta } from "./emails/templates";
import type { Contexto } from "./emails/base";

const ctx: Contexto = {
  remetente: { nome: "Sistenge", razaoSocial: null, cnpj: null },
  appUrl: "https://loca.exemplo",
};

const linha = (descricao: string, obra?: string): LinhaAlerta => ({
  categoria: "Pagamento",
  descricao,
  data: "10/09/2026",
  obra,
  custo: "R$ 1.200,00",
});

describe("obraSchema — destinatários extras", () => {
  const base = { codigo: "OB-042", nome: "Vista Verde", status: "ativa" as const };

  it("quebra a textarea em endereços, um por linha", () => {
    const r = obraSchema.parse({
      ...base,
      destinatarios_alerta: "mestre@obra.com.br\nalmox@obra.com.br",
    });
    expect(r.destinatarios_alerta).toEqual(["mestre@obra.com.br", "almox@obra.com.br"]);
  });

  it("aceita vírgula e ponto-e-vírgula, como a tela de Configurações", () => {
    const r = obraSchema.parse({
      ...base,
      destinatarios_alerta: "a@x.com, b@x.com; c@x.com",
    });
    expect(r.destinatarios_alerta).toHaveLength(3);
  });

  it("normaliza para minúsculas e remove repetidos", () => {
    // Sem isto, "Mestre@Obra.com" e "mestre@obra.com" seriam dois destinatários
    // e a mesma pessoa receberia dois e-mails idênticos.
    const r = obraSchema.parse({
      ...base,
      destinatarios_alerta: "Mestre@Obra.com\nmestre@obra.com",
    });
    expect(r.destinatarios_alerta).toEqual(["mestre@obra.com"]);
  });

  it("recusa endereço inválido", () => {
    const r = obraSchema.safeParse({ ...base, destinatarios_alerta: "não é e-mail" });
    expect(r.success).toBe(false);
  });

  it("vazio vira lista vazia, não [''] ", () => {
    expect(obraSchema.parse({ ...base, destinatarios_alerta: "" }).destinatarios_alerta).toEqual([]);
    expect(obraSchema.parse(base).destinatarios_alerta).toEqual([]);
  });
});

describe("obraSchema aceita o próprio output", () => {
  // A action re-valida o que o zodResolver já transformou no cliente. Este
  // teste existe porque `obraSchema` NÃO tinha a propriedade: salvar uma obra
  // sem endereço, sem responsável ou sem centro de custo falhava com "Dados
  // inválidos", e nada dizia qual campo. Mesmo defeito de `imoveis.ts`, que foi
  // corrigido na 0.31.x — aqui passou batido porque nenhum teste exercitava a
  // segunda passagem.
  const minimo = { codigo: "OB-01", nome: "Obra", status: "ativa" as const };

  it("re-valida com os opcionais vazios", () => {
    const primeira = obraSchema.parse(minimo);
    const r = obraSchema.safeParse(primeira);
    const detalhe = r.success
      ? ""
      : `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}`;
    expect(r.success, detalhe).toBe(true);
  });

  it("o output não muda na segunda passagem", () => {
    const primeira = obraSchema.parse({
      ...minimo,
      endereco: "Rua A, 100",
      destinatarios_alerta: "a@x.com",
    });
    expect(obraSchema.parse(primeira)).toEqual(primeira);
  });
});

describe("e-mail de vencimentos da obra", () => {
  it("mostra o subtítulo da obra quando informado", () => {
    const { html } = vencimentosObra({ obra: "OB-042 — Vista Verde", linhas: [linha("Aluguel")] }, ctx);
    expect(html).toContain("Sistenge — OB-042 — Vista Verde");
  });

  it("sem subtítulo, mostra só a organização", () => {
    const { html } = vencimentosObra({ linhas: [linha("Aluguel")] }, ctx);
    expect(html).toContain("Sistenge");
    expect(html).not.toContain("Sistenge — ");
  });
});

describe("e-mail de vencimentos central", () => {
  const grupos: GrupoAlerta[] = [
    { obra: "OB-042 — Vista Verde", linhas: [linha("Aluguel"), linha("IPTU")] },
    { obra: "OB-063 — Alto da Serra", linhas: [linha("Andaime")], semDestinatarios: true },
    { obra: "Sem obra", linhas: [linha("Imóvel avulso")] },
  ];

  it("soma o total de avisos de todos os grupos", () => {
    const html = vencimentosCentral({ grupos }, ctx).html;
    expect(html).toContain("4 avisos em 3 grupos");
  });

  it("lista cada obra no índice com a contagem dela", () => {
    const html = vencimentosCentral({ grupos }, ctx).html;
    expect(html).toContain("OB-042 — Vista Verde</strong> — 2 avisos");
    expect(html).toContain("OB-063 — Alto da Serra</strong> — 1 aviso");
  });

  it("marca a obra que ficou sem destinatários próprios", () => {
    // É o aviso que impede a divisão por obra de virar perda silenciosa de
    // alerta: a central absorve e diz que absorveu.
    const html = vencimentosCentral({ grupos }, ctx).html;
    expect(html).toContain("sem destinatários próprios");
  });

  it("não marca as obras que têm destinatários", () => {
    const html = vencimentosCentral({ grupos: [grupos[0]] }, ctx).html;
    expect(html).not.toContain("sem destinatários próprios");
  });

  it("um grupo com um aviso usa o singular", () => {
    const html = vencimentosCentral({ grupos: [grupos[1]] }, ctx).html;
    expect(html).toContain("1 aviso em 1 grupo");
  });

  it("cada seção traz a tabela completa do grupo", () => {
    const html = vencimentosCentral({ grupos }, ctx).html;
    expect(html).toContain("Aluguel");
    expect(html).toContain("IPTU");
    expect(html).toContain("Andaime");
    expect(html).toContain("Imóvel avulso");
  });
});
