import { describe, expect, it } from "vitest";
import {
  formatEventReadReply,
  resolveEventReadIntent,
} from "./event-read-intent.ts";

describe("event read intent", () => {
  it("trata drinks como consulta no chat", () => {
    const result = resolveEventReadIntent("Me manda os drinks do evento de hoje 26.09");
    expect(result.matched).toBe(true);
    expect(result.fields).toContain("drinks");
    expect(result.dateHint).toMatch(/-09-26$/);
  });

  it("trata orçamento como consulta no chat", () => {
    const result = resolveEventReadIntent("qual o orçamento da Mariana?");
    expect(result.matched).toBe(true);
    expect(result.fields).toContain("budget");
  });

  it("não intercepta pedido explícito de PDF", () => {
    expect(
      resolveEventReadIntent("me manda o cardápio em PDF do evento de hoje").matched,
    ).toBe(false);
  });

  it("formata drinks e orçamento sem link", () => {
    const reply = formatEventReadReply(
      { matched: true, fields: ["drinks", "budget"] },
      {
        event: {
          event_name: "Júlia e Sofia",
          date: "2026-09-26",
          current_budget_value: 5126.86,
          drinks: [
            { name: "Moscow Mule", description: "Vodka, gengibre e limão" },
            { name: "Cosmopolitan", description: "Vodka, cranberry e cítricos" },
          ],
        },
        current_budget: {
          final_budget_value: 5126.86,
          average_value_per_person: 42.72,
          guest_count: 120,
        },
      },
    );
    expect(reply).toContain("Moscow Mule");
    expect(reply).toContain("R$");
    expect(reply).not.toContain("http");
  });
});
