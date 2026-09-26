import { describe, expect, it } from "vitest";
import {
  buildEventMenuModel,
  paginateEventMenuDrinks,
  resolveEventMenuDrinks,
  resolveEventMenuPersonalization,
} from "@/lib/event-menu";
import type { Drink } from "@/lib/mock-data";

const modalityConfig = {
  evento: { active: true, cost: 5 },
  steakhouse: { active: false, cost: 0 },
  goatbotequim: { active: false, cost: 0 },
};

const catalog = [
  {
    id: "d1",
    nome: "Moscow Mule",
    categoria: "Vodka",
    descricao: "Vodka, limão e espuma de gengibre.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d2",
    nome: "Gin Tônica",
    categoria: "Gin",
    descricao: "Gin, tônica e botânicos.",
    custoUnitario: 5,
    modalityConfig,
  },
] as Drink[];

describe("event menu", () => {
  it("resolves persisted snapshots against the current catalog description", () => {
    const drinks = resolveEventMenuDrinks(
      { ids: ["d1"], items: [{ drink_id: "d1", name: "Moscow Mule", unit_cost: 5 }] },
      catalog,
    );
    expect(drinks[0]).toMatchObject({
      id: "d1",
      name: "Moscow Mule",
      description: "Vodka, limão e espuma de gengibre.",
    });
  });

  it("preserves a historical selected drink even when it is no longer in catalog", () => {
    const drinks = resolveEventMenuDrinks(
      { ids: ["old"], items: [{ drink_id: "old", name: "Drink antigo", unit_cost: 4 }] },
      catalog,
    );
    expect(drinks[0]).toMatchObject({ id: "old", name: "Drink antigo", description: "" });
  });

  it("deduplicates selections and keeps the approved single-column composition", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d1", "d2"],
      catalog,
      eventName: "Mariana & Gustavo",
    });
    expect(menu.drinks).toHaveLength(2);
    expect(menu.layout).toBe("expanded");
    expect(menu.columns).toBe(1);
    expect(menu.pages).toHaveLength(1);
  });

  it("builds wedding monogram from the event names and formats the date", () => {
    const personalization = resolveEventMenuPersonalization({
      eventType: "Casamento",
      groomName: "Gustavo",
      brideName: "Ana",
      date: "2026-11-22",
    });
    expect(personalization).toEqual({
      kind: "wedding",
      initials: "GA",
      label: "Gustavo & Ana",
      date: "22.11.2026",
    });
  });

  it("maps recurring event types to the fixed visual library", () => {
    expect(resolveEventMenuPersonalization({ eventType: "Aniversário" })).toMatchObject({
      kind: "birthday",
      label: "Happy Birthday",
    });
    expect(resolveEventMenuPersonalization({ eventType: "Corporativo" })).toMatchObject({
      kind: "corporate",
    });
    expect(resolveEventMenuPersonalization({ eventType: "Confraternização" })).toMatchObject({
      kind: "corporate",
    });
    expect(resolveEventMenuPersonalization({ eventType: "Despedida de solteiro" })).toMatchObject({
      kind: "bachelor",
      label: "Game Over",
    });
  });

  it("splits oversized menus instead of allowing visual overlap", () => {
    const many = Array.from({ length: 18 }, (_, index) => ({
      id: String(index),
      name: `Drink especial número ${index + 1}`,
      description:
        "Descrição detalhada com ingredientes e acabamento para ocupar espaço real no cardápio.",
    }));
    const pages = paginateEventMenuDrinks(many);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toHaveLength(many.length);
  });

  it("warns when catalog descriptions are missing", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: [{ id: "old" }] as any,
      catalog: [],
      eventType: "Corporativo",
    });
    expect(menu.warnings.some((warning) => warning.includes("sem descrição"))).toBe(true);
  });
});
