import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GeminiProvider,
  DEFAULT_GEMINI_MODEL,
  GOOGLE_PROJECT_NUMBER,
} from "../supabase/functions/_shared/goat-ai/gemini-provider";

describe("Goat AI Gemini Provider & Robust Error Handling", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("exports correct defaults and Google Project number", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-3.6-flash");
    expect(GOOGLE_PROJECT_NUMBER).toBe("321790958376");
  });

  it("handles valid Gemini API response with structured JSON output", async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  classification: "event_purchase",
                  classification_confidence: 0.98,
                  extraction_confidence: 0.95,
                  event_reference: {
                    name: "Casamento da Fernanda",
                    bride_name: "Fernanda",
                    date: null,
                  },
                  data: {
                    supplier: "Assaí",
                    total: 780,
                    items: [
                      {
                        name: "Tanqueray",
                        quantity: 4,
                        unit: null,
                        unit_price: null,
                        total_price: null,
                      },
                      {
                        name: "Absolut",
                        quantity: 3,
                        unit: null,
                        unit_price: null,
                        total_price: null,
                      },
                    ],
                  },
                  warnings: [],
                  missing_fields: [],
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 145,
        candidatesTokenCount: 88,
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockGeminiResponse,
    });

    const provider = new GeminiProvider({
      apiKey: "fake_gemini_key_for_test",
      model: "gemini-3.6-flash",
      allowHeuristicFallback: false,
    });

    const output = await provider.process({
      text: "Comprei 4 Tanqueray e 3 Absolut para o casamento da Fernanda. Deu R$ 780 no Assaí.",
    });

    expect(output.classification).toBe("event_purchase");
    expect(output.classification_confidence).toBe(0.98);
    expect(output.extraction_confidence).toBe(0.95);
    expect(output.event_reference.name).toBe("Casamento da Fernanda");
    expect(output.data.supplier).toBe("Assaí");
    expect(output.data.total).toBe(780);
    expect(output.data.items).toHaveLength(2);
    expect(output.provider_metadata.provider).toBe("gemini");
    expect(output.provider_metadata.processing_mode).toBe("gemini");
    expect(output.provider_metadata.input_tokens).toBe(145);
    expect(output.provider_metadata.output_tokens).toBe(88);
  });

  it("handles sales session extraction from Gemini response", async () => {
    const mockSalesResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  classification: "sales_session",
                  classification_confidence: 0.96,
                  extraction_confidence: 0.92,
                  event_reference: {},
                  data: {
                    location: "7Steakhouse",
                    revenue: 4850,
                    sales: [
                      { product: "Old Fashioned", quantity: 18 },
                      { product: "Negroni", quantity: 12 },
                      { product: "Moscow Mule", quantity: 9 },
                    ],
                    peak_period: { start: "20:00", end: "22:00" },
                    issues: ["Demora no primeiro atendimento"],
                  },
                  warnings: [],
                  missing_fields: [],
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSalesResponse,
    });

    const provider = new GeminiProvider({
      apiKey: "fake_key",
      allowHeuristicFallback: false,
    });

    const output = await provider.process({
      text: "Hoje na 7 Steak vendemos 18 Old Fashioned, 12 Negroni e 9 Moscow Mule. Faturamento R$ 4.850.",
    });

    expect(output.classification).toBe("sales_session");
    expect(output.data.location).toBe("7Steakhouse");
    expect(output.data.revenue).toBe(4850);
    expect(output.data.sales).toHaveLength(3);
  });

  it("handles missing API key when fallback is disabled", async () => {
    const provider = new GeminiProvider({
      apiKey: undefined,
      allowHeuristicFallback: false,
    });

    const output = await provider.process({
      text: "Mensagem qualquer",
    });

    expect(output.classification).toBe("unknown");
    expect(output.provider_metadata.processing_mode).toBe("unavailable");
    expect(output.warnings[0]).toContain("Chave GEMINI_API_KEY não configurada");
  });

  it("handles missing API key when fallback is enabled", async () => {
    const provider = new GeminiProvider({
      apiKey: undefined,
      allowHeuristicFallback: true,
    });

    const output = await provider.process({
      text: "Comprei 4 Tanqueray para o casamento da Fernanda no Assaí por R$ 780",
    });

    expect(output.classification).toBe("event_purchase");
    expect(output.provider_metadata.processing_mode).toBe("heuristic");
    expect(output.data.total).toBe(780);
  });

  it("handles HTTP 429 quota exceeded error gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Quota exceeded",
    });

    const provider = new GeminiProvider({
      apiKey: "fake_key",
      allowHeuristicFallback: false,
    });

    const output = await provider.process({
      text: "Comprei insumos",
    });

    expect(output.classification).toBe("unknown");
    expect(output.provider_metadata.processing_mode).toBe("unavailable");
    expect(output.warnings[0]).toContain("429");
  });

  it("handles HTTP 500 server error gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const provider = new GeminiProvider({
      apiKey: "fake_key",
      allowHeuristicFallback: false,
    });

    const output = await provider.process({
      text: "Comprei insumos",
    });

    expect(output.classification).toBe("unknown");
    expect(output.warnings[0]).toContain("500");
  });

  it("handles invalid JSON response gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "Invalid non-JSON string" }],
            },
          },
        ],
      }),
    });

    const provider = new GeminiProvider({
      apiKey: "fake_key",
      allowHeuristicFallback: false,
    });

    const output = await provider.process({
      text: "Comprei insumos",
    });

    expect(output.classification).toBe("unknown");
    expect(output.warnings[0]).toContain("parse do JSON");
  });

  it("supports classify() and extract() interface methods", async () => {
    const provider = new GeminiProvider({
      apiKey: undefined,
      allowHeuristicFallback: true,
    });

    const classificationResult = await provider.classify({
      text: "Comprei 4 garrafas de Gin no Assaí por R$ 320",
    });

    expect(classificationResult.classification).toBe("event_purchase");
    expect(classificationResult.confidence).toBeGreaterThanOrEqual(0.9);

    const extractionResult = await provider.extract({
      text: "Comprei 4 garrafas de Gin no Assaí por R$ 320",
    });

    expect(extractionResult.data.supplier).toContain("Assaí");
    expect(extractionResult.data.total).toBe(320);
  });
});
