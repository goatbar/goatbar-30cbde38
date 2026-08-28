import { describe, expect, it } from "vitest";
import {
  generateSecureToken,
  getLinkState,
  parseWeddingCoupleName,
  sanitizePublicDrinks,
  validatePublicBudgetPayload,
} from "./logic.ts";

const valid = {
  client_name: "Mariana",
  event_name: "João e Maria",
  phone: "(11) 99999-9999",
  date: "2026-10-17",
  event_type: "Casamento",
  guests: 180,
  duration_hours: 5,
};

describe("budget request backend", () => {
  it("gera tokens seguros e únicos", () => {
    const first = generateSecureToken();
    const second = generateSecureToken();
    expect(first).toHaveLength(64);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[a-f0-9]+$/);
  });

  it("deriva estados sem confiar no browser", () => {
    expect(getLinkState({ status: "ACTIVE" })).toBe("ACTIVE");
    expect(getLinkState({ status: "ACTIVE", expires_at: "2020-01-01" })).toBe("EXPIRED");
    expect(getLinkState({ status: "CANCELLED" })).toBe("CANCELLED");
    expect(getLinkState({ status: "USED", event_id: "x" })).toBe("USED");
  });

  it("aceita payload canônico", () => expect(validatePublicBudgetPayload(valid).guests).toBe(180));
  it("rejeita campo obrigatório ausente", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, client_name: "" })).toThrow());
  it("rejeita campo administrativo", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, status: "confirmado" })).toThrow(
      /não permitidos/,
    ));

  describe("parseWeddingCoupleName", () => {
    it("1. separa 'João e Maria' corretamente", () => {
      expect(parseWeddingCoupleName("João e Maria")).toEqual({
        groom_name: "João",
        bride_name: "Maria",
      });
    });

    it("2. separa 'João da Silva & Maria Oliveira' sem quebrar nomes compostos", () => {
      expect(parseWeddingCoupleName("João da Silva & Maria Oliveira")).toEqual({
        groom_name: "João da Silva",
        bride_name: "Maria Oliveira",
      });
    });

    it("3. '+' funciona", () => {
      expect(parseWeddingCoupleName("João + Maria")).toEqual({
        groom_name: "João",
        bride_name: "Maria",
      });
    });

    it("4. '/' funciona", () => {
      expect(parseWeddingCoupleName("João / Maria")).toEqual({
        groom_name: "João",
        bride_name: "Maria",
      });
    });

    it("5. rejeita quando há mais de 2 partes ou quando não há separador", () => {
      expect(parseWeddingCoupleName("João e Maria e Pedro")).toBeNull();
      expect(parseWeddingCoupleName("Casamento João")).toBeNull();
      expect(parseWeddingCoupleName("")).toBeNull();
      expect(parseWeddingCoupleName("   ")).toBeNull();
      expect(parseWeddingCoupleName("João & ")).toBeNull();
    });
  });

  it("preserva exatamente o event_name digitado e popula groom_name/bride_name canônicos", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_name: "João da Silva & Maria Oliveira",
    });
    expect(payload.event_name).toBe("João da Silva & Maria Oliveira");
    expect(payload.groom_name).toBe("João da Silva");
    expect(payload.bride_name).toBe("Maria Oliveira");
  });

  it("não bloqueia casamento quando o nome não possui separador reconhecível", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_name: "Bodas de Prata da Família",
    });
    expect(payload.event_name).toBe("Bodas de Prata da Família");
    expect(payload.groom_name).toBe("");
    expect(payload.bride_name).toBe("");
  });

  it("não exige nem tenta popular noivos em outro tipo de evento", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_type: "Corporativo",
      event_name: "Convenção Anual 2026",
    });
    expect(payload.event_name).toBe("Convenção Anual 2026");
    expect(payload.groom_name).toBe("");
    expect(payload.bride_name).toBe("");
  });

  it.each([0, 1, 3])("aceita seleção opcional com %i drinks", (count) => {
    const ids = Array.from({ length: count }, (_, index) => `drink-${index}`);
    expect(
      validatePublicBudgetPayload({ ...valid, requested_drink_ids: ids }).requested_drink_ids,
    ).toEqual(ids);
  });

  it("rejeita duração inválida", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, duration_hours: 0 })).toThrow(/Duração/));
  it("rejeita IDs de drinks inválidos", () =>
    expect(() => validatePublicBudgetPayload({ ...valid, requested_drink_ids: [123] })).toThrow(
      /IDs/,
    ));

  it("sanitiza e filtra o catálogo sem vazar campos financeiros", () => {
    const rows = [
      {
        id: "public",
        nome: "Mule",
        descricao: "Refrescante",
        imagem: "https://image",
        show_in_public_menu: true,
        modality_config: { evento: { active: true } },
        custo_unitario: 99,
        insumos: [{ nome: "Limão", custo: 12 }],
      },
      {
        id: "private",
        nome: "Interno",
        show_in_public_menu: false,
        modality_config: { evento: { active: true } },
      },
      {
        id: "inactive",
        nome: "Inativo",
        show_in_public_menu: true,
        modality_config: { evento: { active: false } },
      },
    ];
    const result = sanitizePublicDrinks(rows);
    expect(result).toEqual([
      {
        id: "public",
        name: "Mule",
        description: "Refrescante",
        image: "https://image",
        ingredients: ["Limão"],
      },
    ]);
    expect(result[0]).not.toHaveProperty("custo_unitario");
    expect(JSON.stringify(result)).not.toContain("12");
  });
});
