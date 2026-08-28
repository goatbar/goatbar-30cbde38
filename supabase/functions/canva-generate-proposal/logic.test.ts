import { describe, expect, it, vi } from "vitest";
import {
  auditAutofillPayload,
  autofillAndExportPdf,
  buildAutofillData,
  collectDiagnosticFields,
  redactCanvaResponse,
} from "./logic";

describe("Canva proposal payload regression", () => {
  it("traces canonical drink varieties and omits the stray duration zero", () => {
    const mappings = [
      {
        canva_field_key: "QUANTIDADE_PESSOAS",
        source_type: "field",
        source_field_key: "event.guests",
      },
      {
        canva_field_key: "QUANTIDADE_DRINKS",
        source_type: "field",
        source_field_key: "computed.total_drink_varieties",
      },
      {
        canva_field_key: "QUANTIDADE_HORAS_EVENTO",
        source_type: "field",
        source_field_key: "event.duration_hours",
      },
    ];
    const payload = buildAutofillData(
      mappings,
      mappings.map((item) => item.canva_field_key),
      { guests: 7, duration_hours: 0 },
      { selected_drinks: ["Moscow Mule", "Fitzgerald", "Moscow Mule"] },
    );
    expect(payload).toEqual({
      QUANTIDADE_PESSOAS: { type: "text", text: "7" },
      QUANTIDADE_DRINKS: { type: "text", text: "2" },
      QUANTIDADE_HORAS_EVENTO: { type: "text", text: "" },
    });
    expect(auditAutofillPayload(mappings, payload)).toContainEqual({
      canva_field_key: "QUANTIDADE_DRINKS",
      source_type: "field",
      source_field_key: "computed.total_drink_varieties",
      value: "2",
      status: "filled",
    });
  });
});

describe("Canva Autofill 429 diagnostics", () => {
  it("preserves the complete structured response and upsell URL", async () => {
    const payload = {
      error: {
        code: "quota_exceeded",
        message: "Free autofill quota has been exceeded.",
        upsell_url: "https://www.canva.com/upgrade/autofill",
        entitlement: { plan: "free", autofill_quota: 0 },
      },
      trace_id: "trace-429",
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 429,
        headers: { "content-type": "application/json", "x-request-id": "request-429" },
      }),
    );

    await expect(
      autofillAndExportPdf({
        token: "never-log-this",
        brandTemplateId: "template-1",
        data: {},
        fetcher: fetcher as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: "canva_autofill_quota_exceeded",
      status: 429,
      details: {
        upsell_url: payload.error.upsell_url,
        canva_details: {
          error: payload.error,
          trace_id: "trace-429",
          request_id: "request-429",
        },
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(collectDiagnosticFields(payload)).toEqual(
      expect.arrayContaining([
        "error.entitlement",
        "error.entitlement.plan",
        "error.entitlement.autofill_quota",
      ]),
    );
  });

  it("redacts credentials recursively without dropping diagnostic fields", () => {
    expect(
      redactCanvaResponse({ access_token: "a", nested: { refresh_token: "r", quota: 0 } }),
    ).toEqual({ access_token: "[REDACTED]", nested: { refresh_token: "[REDACTED]", quota: 0 } });
  });
});
