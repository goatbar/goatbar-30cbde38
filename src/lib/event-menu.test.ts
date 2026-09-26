import { describe, expect, it } from "vitest";
import { buildEventMenuModel, resolveEventMenuDrinks } from "@/lib/event-menu";
import type { Drink } from "@/lib/mock-data";

const catalog = [
  { id:"d1", nome:"Moscow Mule", categoria:"Vodka", descricao:"Vodka, limão e espuma de gengibre.", custoUnitario:5, modalityConfig:{evento:{active:true,cost:5},steakhouse:{active:false,cost:0},goatbotequim:{active:false,cost:0}} },
  { id:"d2", nome:"Gin Tônica", categoria:"Gin", descricao:"Gin, tônica e botânicos.", custoUnitario:5, modalityConfig:{evento:{active:true,cost:5},steakhouse:{active:false,cost:0},goatbotequim:{active:false,cost:0}} },
] as Drink[];

describe("event menu", () => {
  it("resolves persisted snapshots against the current catalog description", () => {
    const drinks = resolveEventMenuDrinks({ ids:["d1"], items:[{drink_id:"d1",name:"Moscow Mule",unit_cost:5}] }, catalog);
    expect(drinks[0]).toMatchObject({ id:"d1", name:"Moscow Mule", description:"Vodka, limão e espuma de gengibre." });
  });

  it("preserves a historical selected drink even when it is no longer in catalog", () => {
    const drinks = resolveEventMenuDrinks({ ids:["old"], items:[{drink_id:"old",name:"Drink antigo",unit_cost:4}] }, catalog);
    expect(drinks[0]).toMatchObject({ id:"old", name:"Drink antigo", description:"" });
  });

  it("deduplicates selections and chooses an adaptive layout", () => {
    const menu = buildEventMenuModel({ selectedDrinks:["d1","d1","d2"], catalog, eventName:"Mariana & Gustavo" });
    expect(menu.drinks).toHaveLength(2);
    expect(menu.layout).toBe("expanded");
    expect(menu.columns).toBe(1);
    expect(menu.subtitle).toBe("Mariana & Gustavo");
  });
});
