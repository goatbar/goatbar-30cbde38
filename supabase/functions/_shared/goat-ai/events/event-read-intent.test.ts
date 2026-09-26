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

  it("trata equipe orçada como composição comercial do orçamento", () => {
    const result = resolveEventReadIntent(
      "quero saber a quantidade de bartender coopeira e keeper orçada",
    );
    expect(result.matched).toBe(true);
    expect(result.fields).toContain("team_budget");
  });

  it("responde equipe orçada com quantidades e total", () => {
    const reply = formatEventReadReply(
      { matched: true, fields: ["team_budget"] },
      {
        event: { event_name: "Júlia e Sofia", date: "2026-09-26" },
        current_budget: {
          bartender_quantity: 4,
          bartender_unit_value: 200,
          keeper_quantity: 1,
          keeper_unit_value: 200,
          copeira_quantity: 1,
          copeira_unit_value: 200,
          team_total_value: 1200,
        },
      },
    );
    expect(reply).toContain("4 Bartenders");
    expect(reply).toContain("1 Keeper");
    expect(reply).toContain("1 Copeira");
    expect(reply).toContain("1.200");
  });

  it("informações completas incluem composição comercial", () => {
    const intent = resolveEventReadIntent("me manda as informações completas do evento");
    expect(intent.fields).toContain("full_summary");

    const reply = formatEventReadReply(intent, {
      event: {
        event_name: "Júlia e Sofia",
        client_name: "Michele Reis",
        event_type: "Aniversário",
        status: "CONFIRMADO",
        date: "2026-09-26",
        city: "Baldim",
        guests: 120,
        drinks: [{ name: "Moscow Mule" }],
      },
      current_budget: {
        final_budget_value: 5126.87,
        average_value_per_person: 42.72,
        guest_count: 120,
        drinks_per_person: 4,
        bartender_quantity: 4,
        keeper_quantity: 1,
        copeira_quantity: 1,
        team_total_value: 1200,
        ice_packages_quantity: 42,
        ice_package_unit_value: 6,
        ice_total_value: 252,
        fuel_value: 150,
        beverages: ["Vodka Smirnoff"],
        miscellaneous_items: [{ descricao: "Lanche", valor: 120 }],
      },
    });
    expect(reply).toContain("Equipe orçada");
    expect(reply).toContain("Gelo e logística");
    expect(reply).toContain("Bebidas base");
    expect(reply).toContain("Adicionais");
    expect(reply).toContain("Moscow Mule");
  });
});
