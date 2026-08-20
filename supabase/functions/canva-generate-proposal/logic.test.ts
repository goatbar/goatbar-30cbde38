import { describe, expect, it, vi } from "vitest";
import { autofillAndExportPdf, collectDiagnosticFields, redactCanvaResponse } from "./logic";

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
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 429,
      headers: { "content-type": "application/json", "x-request-id": "request-429" },
    }));

    await expect(autofillAndExportPdf({
      token: "never-log-this",
      brandTemplateId: "template-1",
      data: {},
      fetcher: fetcher as typeof fetch,
    })).rejects.toMatchObject({
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
    expect(collectDiagnosticFields(payload)).toEqual(expect.arrayContaining([
      "error.entitlement", "error.entitlement.plan", "error.entitlement.autofill_quota",
    ]));
  });

  it("redacts credentials recursively without dropping diagnostic fields", () => {
    expect(redactCanvaResponse({ access_token: "a", nested: { refresh_token: "r", quota: 0 } }))
      .toEqual({ access_token: "[REDACTED]", nested: { refresh_token: "[REDACTED]", quota: 0 } });
  });
});
