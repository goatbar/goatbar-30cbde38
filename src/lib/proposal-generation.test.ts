import { describe, expect, it } from "vitest";
import { getCanvaQuotaPresentation } from "./proposal-generation";

describe("Canva quota error presentation", () => {
  it("shows the connected Canva account and upgrade information", () => {
    expect(getCanvaQuotaPresentation({
      code: "canva_autofill_quota_exceeded",
      status: 429,
      message: "quota",
      upsell_url: "https://www.canva.com/upgrade",
      canva_account: { canva_user_id: "canva-123", display_name: "Conta Goat" },
    })).toEqual({
      message: "A Canva ainda está identificando esta integração como sem cota de Autofill.",
      upsellUrl: "https://www.canva.com/upgrade",
      accountLabel: "Conta Goat",
      canvaUserId: "canva-123",
    });
  });
});
