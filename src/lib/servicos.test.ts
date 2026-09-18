import { describe, it, expect } from "vitest";
import {
  CATEGORIA_SERVICO,
  CATEGORIA_SERVICO_INFO,
  DIAS_CONFERENCIA_VALIDA,
  conferenciaVencida,
  totalDoPeriodoCentavos,
  servicoSchema,
} from "./servicos";

const UUID = "11111111-1111-4111-8111-111111111111";

function valido(extra: Record<string, unknown> = {}) {
  return {
    nome: "Microsoft 365 Business Premium",
    fornecedor_id: UUID,
    quantidade: 50,
    valor_unitario_centavos: 7000,
    data_inicio: "2026-01-01",
    ...extra,
  };
}

describe("CATEGORIA_SERVICO", () => {
  it("tem rótulo acentuado para cada categoria", () => {
    for (const c of CATEGORIA_SERVICO) {
      expect(CATEGORIA_SERVICO_INFO[c].label.length).toBeGreaterThan(0);
    }
    expect(CATEGORIA_SERVICO_INFO.licenca.label).toBe("Licença");
    expect(CATEGORIA_SERVICO_INFO.seguranca.label).toBe("Segurança");
  });
});

describe("conferenciaVencida", () => {
  it("é verdadeira quando passou dos 90 dias", () => {
    expect(conferenciaVencida("2026-06-01", "2026-09-17")).toBe(true);
  });

  it("é falsa dentro dos 90 dias", () => {
    expect(conferenciaVencida("2026-09-01", "2026-09-17")).toBe(false);
  });

  it("no 90º dia ainda vale; no 91º, não", () => {
    // A fronteira é onde este tipo de função erra, e um off-by-one aqui faz a
    // tela acusar conferência vencida um dia antes — ruído que ensina a pessoa
    // a ignorar o aviso.
    expect(conferenciaVencida("2026-01-01", "2026-04-01")).toBe(false); // 90 dias
    expect(conferenciaVencida("2026-01-01", "2026-04-02")).toBe(true); // 91
    expect(DIAS_CONFERENCIA_VALIDA).toBe(90);
  });

  it("nunca conferido conta como VENCIDO — é o pior caso, não o neutro", () => {
    // Um contrato que ninguém nunca conferiu é onde o número tem menos chance
    // de estar certo, não mais.
    expect(conferenciaVencida(null, "2026-09-17")).toBe(true);
  });

  it("atravessa a virada do ano sem se perder", () => {
    expect(conferenciaVencida("2025-12-15", "2026-01-10")).toBe(false);
    expect(conferenciaVencida("2025-09-15", "2026-01-10")).toBe(true);
  });
});

describe("totalDoPeriodoCentavos", () => {
  it("multiplica quantidade por unitário", () => {
    expect(totalDoPeriodoCentavos(50, 7000)).toBe(350000);
  });
});

describe("servicoSchema", () => {
  it("aceita o próprio output na segunda passagem (idempotência)", () => {
    // A action re-valida o que recebe, e o que ela recebe é o OUTPUT deste
    // schema — o zodResolver já transformou no cliente. É o defeito que chegou
    // à produção três vezes neste repositório; `schemas-varredura.test.ts`
    // cobre isto para todo schema, e aqui fica explícito.
    const um = servicoSchema.parse(valido());
    expect(() => servicoSchema.parse(um)).not.toThrow();
  });

  it("recusa quantidade zero — não existe contrato de zero licenças", () => {
    const r = servicoSchema.safeParse(valido({ quantidade: 0 }));
    expect(r.success).toBe(false);
  });

  it("recusa valor negativo", () => {
    expect(servicoSchema.safeParse(valido({ valor_unitario_centavos: -1 })).success).toBe(
      false,
    );
  });

  it("recusa valor com casa decimal — o campo é em CENTAVOS", () => {
    // R$ 70,00 são 7000, não 70.5. Aceitar fração aqui deixaria o rateio com
    // um total que não fecha, e a mensagem diz isso em vez de "inválido".
    const r = servicoSchema.safeParse(valido({ valor_unitario_centavos: 70.5 }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/centavos/i);
    }
  });

  it("recusa fim de vigência anterior ao início, apontando o campo", () => {
    const r = servicoSchema.safeParse(
      valido({ data_inicio: "2026-06-01", data_fim: "2026-01-01" }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["data_fim"]);
    }
  });

  it("aceita vigência indeterminada (sem data de fim)", () => {
    // Nulo é legítimo: assinatura sem prazo é o caso comum. Ela não gera
    // alerta de renovação — não há data —, gera o de conferência vencida.
    const r = servicoSchema.parse(valido({ data_fim: "" }));
    expect(r.data_fim).toBeNull();
  });

  it("assume licença mensal com renovação automática quando nada é dito", () => {
    const r = servicoSchema.parse(valido());
    expect(r.categoria).toBe("licenca");
    expect(r.cadencia).toBe("mensal");
    expect(r.renova_automaticamente).toBe(true);
    expect(r.status).toBe("ativo");
  });
});
