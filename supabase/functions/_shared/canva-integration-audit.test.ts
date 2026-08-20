import { describe, expect, it } from "vitest";
import { summarizeCanvaIntegrations } from "./canva-integration-audit";

describe("Canva integration audit", () => {
  it("uses the newest integration token and detects duplicates without returning tokens", () => {
    const audit = summarizeCanvaIntegrations([
      { user_id: "user", canva_user_id: "new", scopes: ["profile:read"], updated_at: "2026-08-20", access_token_expires_at: "2026-08-21", access_token: "new-token" },
      { user_id: "user", canva_user_id: "old", scopes: [], updated_at: "2026-08-19", access_token_expires_at: "2026-08-20", access_token: "old-token" },
    ], "new-token");
    expect(audit).toMatchObject({ canva_user_id: "new", integration_count: 2, duplicate_integration: true, token_matches_latest_integration: true });
    expect(audit).not.toHaveProperty("access_token");
  });
});
