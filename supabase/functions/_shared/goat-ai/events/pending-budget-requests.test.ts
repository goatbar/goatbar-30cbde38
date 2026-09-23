import { describe, expect, it } from "vitest";
import {
  formatPendingBudgetRequestsReply,
  resolvePendingBudgetRequestsIntent,
} from "./pending-budget-requests.ts";

describe("pending budget requests deterministic flow", () => {
  for (const phrase of [
    "tem alguma solicitação de orçamento em aberto?",
    "tem orçamento pendente?",
    "quais pedidos de orçamento chegaram?",
    "novas solicitações de orçamento",
    "tem algum orçamento novo?",
    "me manda as solicitações ainda sem orçamento",
    "quantas solicitações de orçamento estão abertas?",
  ]) {
    it(`detecta: ${phrase}`, () => {
      expect(resolvePendingBudgetRequestsIntent(phrase).matched).toBe(true);
    });
  }

  it("não herda intenção de uma mensagem atual sem pedido explícito", () => {
    expect(resolvePendingBudgetRequestsIntent("e quantos são?").matched).toBe(false);
  });

  it("responde zero sem inventar registros", () => {
    expect(formatPendingBudgetRequestsReply([])).toBe("Não há solicitações de orçamento em aberto no momento.");
  });

  it("formata a lista canônica", () => {
    const reply = formatPendingBudgetRequestsReply([{
      client_name: "Marcela", event_type: "Confraternização", date: "2026-11-26",
      guests: 30, phone: "5531999999999", event_url: "https://goatbar.com/eventos/1",
    }]);
    expect(reply).toContain("Solicitações de orçamento em aberto: 1");
    expect(reply).toContain("Marcela");
    expect(reply).toContain("26/11/2026");
    expect(reply).toContain("https://goatbar.com/eventos/1");
  });
});
