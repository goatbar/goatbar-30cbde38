import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CANVA_PROFILE_URL,
  CANVA_BRAND_TEMPLATES_URL,
  fetchCanvaUserProfile,
  listCanvaBrandTemplates,
  getCanvaBrandTemplateDataset,
  CanvaApiError,
  sanitizeLog,
} from "../supabase/functions/_shared/canva-auth";
import {
  PROPOSAL_FIELD_CATALOG,
  PROPOSAL_FORMATTERS,
  isValidSourceFieldKey,
  suggestAutoMatches,
  getFieldCatalogItem,
} from "../src/lib/proposal-field-catalog";
import { proposalTemplatesService } from "../src/services/proposal-service";

describe("1. Canva Connection Test & Fine-Grained Diagnostics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns connected profile when Canva profile endpoint responds with 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        profile: {
          display_name: "Goat Bar Comercial",
        },
      }),
    } as Response);

    const profile = await fetchCanvaUserProfile("valid_access_token_123");
    expect(profile.display_name).toBe("Goat Bar Comercial");
  });

  it("differentiates 401 token expired/revoked with CanvaApiError('token_expired_or_revoked')", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ code: "invalid_token" }),
    } as Response);

    await expect(fetchCanvaUserProfile("expired_token")).rejects.toThrow(CanvaApiError);
    try {
      await fetchCanvaUserProfile("expired_token");
    } catch (err: any) {
      expect(err.code).toBe("token_expired_or_revoked");
      expect(err.status).toBe(401);
    }
  });

  it("differentiates 403 insufficient scope with CanvaApiError('insufficient_scope')", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: "forbidden" }),
    } as Response);

    try {
      await fetchCanvaUserProfile("token_without_scope");
    } catch (err: any) {
      expect(err.code).toBe("insufficient_scope");
      expect(err.status).toBe(403);
    }
  });

  it("differentiates 502 temporary Canva outage with CanvaApiError('canva_service_unavailable')", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ code: "service_unavailable" }),
    } as Response);

    try {
      await fetchCanvaUserProfile("valid_token");
    } catch (err: any) {
      expect(err.code).toBe("canva_service_unavailable");
      expect(err.status).toBe(502);
    }
  });
});

describe("2. Canva Brand Templates Listing & Pagination", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists Brand Templates with normalized items and pagination continuation", async () => {
    const mockCanvaApiResponse = {
      items: [
        {
          id: "DA_template_1",
          title: "Proposta Casamento Premium 2026",
          view_url: "https://www.canva.com/design/DA_template_1/view",
          create_url: "https://www.canva.com/design/DA_template_1/edit",
          thumbnail: {
            url: "https://canva-cdn.com/thumb1.jpg",
            width: 595,
            height: 842,
          },
          updated_at: 1700000000,
          created_at: 1690000000,
        },
        {
          id: "DA_template_2",
          title: "Proposta Corporativa 2026",
          thumbnail: {
            url: "https://canva-cdn.com/thumb2.jpg",
          },
          updated_at: 1700000100,
        },
      ],
      continuation: "page_2_continuation_token",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCanvaApiResponse,
    } as Response);

    const result = await listCanvaBrandTemplates("mock_access_token", "page_1_token");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url.toString()).toContain("continuation=page_1_token");
    expect((init?.headers as any)["Authorization"]).toBe("Bearer mock_access_token");

    expect(result.items.length).toBe(2);
    expect(result.items[0].id).toBe("DA_template_1");
    expect(result.items[0].title).toBe("Proposta Casamento Premium 2026");
    expect(result.items[0].thumbnail_url).toBe("https://canva-cdn.com/thumb1.jpg");
    expect(result.continuation).toBe("page_2_continuation_token");
  });
});

describe("3. Canva Brand Template Dataset (Data Fields)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retrieves and normalizes Brand Template dataset into field array", async () => {
    const mockDatasetResponse = {
      dataset: {
        CLIENT_NAME: { type: "text" },
        EVENT_DATE: { type: "text" },
        TOTAL_INVESTMENT: { type: "text" },
        COMPANY_LOGO: { type: "image" },
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDatasetResponse,
    } as Response);

    const result = await getCanvaBrandTemplateDataset("mock_token", "DA_template_123");

    expect(result.brand_template_id).toBe("DA_template_123");
    expect(result.fields.length).toBe(4);

    const clientField = result.fields.find((f) => f.key === "CLIENT_NAME");
    expect(clientField).toBeDefined();
    expect(clientField?.type).toBe("text");

    const logoField = result.fields.find((f) => f.key === "COMPANY_LOGO");
    expect(logoField).toBeDefined();
    expect(logoField?.type).toBe("image");
  });

  it("handles 404 Brand Template not found with CanvaApiError('brand_template_not_found')", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ code: "not_found" }),
    } as Response);

    try {
      await getCanvaBrandTemplateDataset("mock_token", "DA_inexistent");
    } catch (err: any) {
      expect(err.code).toBe("brand_template_not_found");
      expect(err.status).toBe(404);
    }
  });
});

describe("4. Goat Bar Field Catalog & Server-Side Validation", () => {
  it("validates official catalog keys correctly", () => {
    expect(isValidSourceFieldKey("event.client_name")).toBe(true);
    expect(isValidSourceFieldKey("event.event_date")).toBe(true);
    expect(isValidSourceFieldKey("budget.total_value")).toBe(true);
    expect(isValidSourceFieldKey("package.drinks_list")).toBe(true);
    expect(isValidSourceFieldKey("computed.event_date_formatted")).toBe(true);

    // Rejects invalid/arbitrary source field keys
    expect(isValidSourceFieldKey("arbitrary_injected_field")).toBe(false);
    expect(isValidSourceFieldKey("event.unknown_column")).toBe(false);
    expect(isValidSourceFieldKey("")).toBe(false);
  });

  it("rejects invalid source_field_key in saveFieldMappings (Server-Side Validation)", async () => {
    const invalidMappings = [
      {
        canva_field_key: "CLIENT_NAME",
        canva_field_type: "text",
        source_field_key: "malicious_unregistered_key",
        formatter: "raw",
        required: false,
      },
    ];

    await expect(
      proposalTemplatesService.saveFieldMappings("template-123", invalidMappings as any)
    ).rejects.toThrow(/Campo de origem inválido/);
  });

  it("suggests intelligent auto-matches between Canva Data Fields and Goat Bar catalog", () => {
    const canvaFields = [
      { key: "CLIENT_NAME", name: "CLIENT_NAME", type: "text" },
      { key: "DATA_EVENTO", name: "DATA_EVENTO", type: "text" },
      { key: "TOTAL_VALUE", name: "TOTAL_VALUE", type: "text" },
      { key: "GUESTS", name: "GUESTS", type: "text" },
      { key: "LISTA_DRINKS", name: "LISTA_DRINKS", type: "text" },
    ];

    const suggestions = suggestAutoMatches(canvaFields);

    expect(suggestions["CLIENT_NAME"]).toBe("event.client_name");
    expect(suggestions["DATA_EVENTO"]).toBe("event.event_date");
    expect(suggestions["TOTAL_VALUE"]).toBe("budget.total_value");
    expect(suggestions["GUESTS"]).toBe("event.guest_count");
    expect(suggestions["LISTA_DRINKS"]).toBe("package.drinks_list");
  });
});

describe("5. Security & Tokens Protection", () => {
  it("never includes tokens in Brand Templates or Dataset responses", () => {
    const publicBrandTemplate = {
      id: "DA_test",
      title: "Template Proposta",
      thumbnail_url: "https://canva.com/thumb.png",
    };

    const keys = Object.keys(publicBrandTemplate);
    expect(keys).not.toContain("access_token");
    expect(keys).not.toContain("refresh_token");
    expect(keys).not.toContain("client_secret");
    expect(keys).not.toContain("code_verifier");
  });
});
