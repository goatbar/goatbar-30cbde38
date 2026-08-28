import { describe, expect, it } from "vitest";
import { generateSecureToken, getLinkState, validatePublicBudgetPayload } from "./logic.ts";

const valid = {
  client_name: "Mariana",
  phone: "(11) 99999-9999",
  date: "2026-10-17",
  event_type: "Casamento",
  guests: 180,
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
});
