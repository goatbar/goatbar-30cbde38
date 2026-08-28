import { describe, expect, it } from "vitest";
import {
  generateSecureToken,
  getLinkState,
  sanitizePublicDrinks,
  validatePublicBudgetPayload,
} from "./logic.ts";

const valid = {
  client_name: "Mariana",
  phone: "(11) 99999-9999",
  date: "2026-10-17",
  event_type: "Casamento",
  guests: 180,
  groom_name: "Gustavo",
  bride_name: "Mariana",
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
  it("persiste os papéis canônicos e monta o nome do casamento", () => {
    const payload = validatePublicBudgetPayload(valid);
    expect(payload.groom_name).toBe("Gustavo");
    expect(payload.bride_name).toBe("Mariana");
    expect(payload.event_name).toBe("Mariana & Gustavo");
  });
  it("não exige nem persiste noivos em outro tipo de evento", () => {
    const payload = validatePublicBudgetPayload({
      ...valid,
      event_type: "Corporativo",
      groom_name: undefined,
      bride_name: undefined,
    });
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
