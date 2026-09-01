import { describe, it, expect } from "vitest";
import {
  matchEventDeterministically,
  DatabaseEvent,
  AUTO_MATCH_THRESHOLD,
} from "../supabase/functions/_shared/goat-ai/event-matcher";

describe("Goat AI Deterministic Event Matching Engine & Thresholds", () => {
  const sampleEvents: DatabaseEvent[] = [
    {
      id: "ev-1",
      client_name: "Fernanda Ribeiro",
      bride_name: "Fernanda",
      groom_name: "Lucas",
      event_name: "Casamento Fernanda & Lucas",
      date: "2026-09-15",
      event_location: "Espaço Villa Véneto",
      city: "Belo Horizonte",
    },
    {
      id: "ev-2",
      client_name: "Empresa ABC Tech",
      bride_name: null,
      groom_name: null,
      event_name: "Comemoração ABC Tech",
      date: "2026-10-20",
      event_location: "Hotel Fasano",
      city: "Belo Horizonte",
    },
    {
      id: "ev-3",
      client_name: "Mariana Souza",
      bride_name: "Mariana",
      groom_name: "Guilherme",
      event_name: "Casamento Mariana e Guilherme",
      date: "2026-11-05",
      event_location: "Sitio das Palmeiras",
      city: "Nova Lima",
    },
  ];

  it("exports strict production AUTO_MATCH_THRESHOLD = 0.85", () => {
    expect(AUTO_MATCH_THRESHOLD).toBe(0.85);
  });

  it("threshold >= 0.85 (e.g. 0.85 and 0.90) -> automatically matches event", () => {
    // Both bride and groom match -> score 0.85
    const result085 = matchEventDeterministically(
      sampleEvents,
      {
        bride_name: "Fernanda",
        groom_name: "Lucas",
      },
      "Casamento da Fernanda e Lucas"
    );

    expect(result085.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result085.event_id).toBe("ev-1");

    // Bride + Groom + Exact date match -> score 0.99
    const result090 = matchEventDeterministically(
      sampleEvents,
      {
        bride_name: "Fernanda",
        groom_name: "Lucas",
        event_name: "Casamento Fernanda & Lucas",
        event_date: "2026-09-15",
      },
      "Casamento Fernanda e Lucas no Villa Véneto dia 15/09"
    );

    expect(result090.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result090.event_id).toBe("ev-1");
  });

  it("scores below 0.85 (e.g. single bride match 0.55, client name 0.65, bride + date 0.80) -> require manual selection", () => {
    // 1. Single bride match without groom (score = 0.55 < 0.85)
    const result055 = matchEventDeterministically(
      sampleEvents,
      {
        bride_name: "Mariana",
      },
      "Bebidas para Mariana"
    );
    expect(result055.confidence).toBe(0.55);
    expect(result055.event_id).toBeNull();
    expect(result055.reason).toContain("Requer revisão e seleção manual");

    // 2. Full client name match 2 words without bride/groom match (score = 0.65 < 0.85)
    const result065 = matchEventDeterministically(
      sampleEvents,
      {
        client_name: "Empresa ABC",
      },
      "Evento da Empresa ABC"
    );
    expect(result065.confidence).toBe(0.65);
    expect(result065.event_id).toBeNull();
    expect(result065.reason).toContain("Requer revisão e seleção manual");

    // 3. Single bride match + Exact date match (0.55 + 0.25 = 0.80 < 0.85)
    const result080 = matchEventDeterministically(
      sampleEvents,
      {
        bride_name: "Mariana",
        event_date: "2026-11-05",
      },
      "Evento da Mariana dia 05/11"
    );
    expect(result080.confidence).toBe(0.80);
    expect(result080.event_id).toBeNull();
    expect(result080.reason).toContain("Requer revisão e seleção manual");
  });

  it("returns null with 0 confidence when no match exists", () => {
    const result = matchEventDeterministically(sampleEvents, { client_name: "Desconhecido Total" });
    expect(result.event_id).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reason).toContain("Nenhum evento correspondente");
  });
});
