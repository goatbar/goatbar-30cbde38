import { describe, it, expect } from "vitest";
import { matchUnitName } from "../supabase/functions/_shared/goat-ai/matchers/unit-matcher";
import { matchEventCandidates, DatabaseEvent } from "../supabase/functions/_shared/goat-ai/matchers/event-matcher";
import { matchUserByName } from "../supabase/functions/_shared/goat-ai/matchers/user-matcher";
import { matchProductOrDrink } from "../supabase/functions/_shared/goat-ai/matchers/product-matcher";

describe("Goat AI - Entity Matchers", () => {
  it("matches unit names to correct business modalities", () => {
    expect(matchUnitName("7 Steak").modality).toBe("Steakhouse");
    expect(matchUnitName("sete steakhouse").modality).toBe("Steakhouse");
    expect(matchUnitName("7SteakHouse").unitName).toBe("7 Steak House");
    expect(matchUnitName("Goat Botequim").modality).toBe("Goatbotequim");
    expect(matchUnitName("boteco").modality).toBe("Goatbotequim");
    expect(matchUnitName("Casamento").modality).toBe("Evento");
  });

  it("matches event candidates by bride, groom, and client names", () => {
    const mockEvents: DatabaseEvent[] = [
      {
        id: "ev-1",
        client_name: "Fernanda Silva",
        groom_name: "Lucas",
        bride_name: "Fernanda",
        event_name: "Casamento Fernanda e Lucas",
        date: "2026-09-12",
      },
      {
        id: "ev-2",
        client_name: "Mariana Costa",
        groom_name: "Pedro",
        bride_name: "Mariana",
        event_name: "Casamento Mariana e Pedro",
        date: "2026-10-05",
      },
    ];

    const candidates = matchEventCandidates(mockEvents, "Casamento Fernanda");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].eventId).toBe("ev-1");
    expect(candidates[0].confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("matches user profiles by name", () => {
    const users = [
      { id: "u-1", display_name: "Jhansen Silveira", email: "jhansen@goatbar.com.br" },
      { id: "u-2", display_name: "Marcos Vinicius", email: "marcos@goatbar.com.br" },
    ];

    const match = matchUserByName(users, "Jhansen");
    expect(match).not.toBeNull();
    expect(match?.userId).toBe("u-1");
    expect(match?.name).toBe("Jhansen Silveira");
  });

  it("matches products and drinks fuzzy names", () => {
    const inventory = [
      { id: "p-1", name: "Gin Tanqueray London Dry 750ml" },
      { id: "p-2", name: "Vodka Absolut 1L" },
      { id: "p-3", name: "Spritz Veneziano" },
    ];

    const match1 = matchProductOrDrink(inventory, "SPRITZ VENEZIANO");
    expect(match1.productId).toBe("p-3");
    expect(match1.confidence).toBeGreaterThanOrEqual(0.85);

    const match2 = matchProductOrDrink(inventory, "Tanqueray");
    expect(match2.productId).toBe("p-1");
  });
});
