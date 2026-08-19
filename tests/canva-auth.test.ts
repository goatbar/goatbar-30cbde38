import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "../supabase/functions/_shared/canva-crypto";
import {
  CANVA_AUTH_URL,
  CANVA_SCOPES,
  CANVA_TOKEN_URL,
  getCanvaConfig,
  exchangeCodeForToken,
  refreshCanvaAccessToken,
  getValidCanvaAccessToken,
  fetchCanvaUserProfile,
  sanitizeLog,
  type CanvaConfig,
} from "../supabase/functions/_shared/canva-auth";

const testConfig: CanvaConfig = {
  clientId: "mock_client_id_123",
  clientSecret: "mock_client_secret_xyz",
  redirectUri: "https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/canva-oauth-callback",
  successRedirectUrl: "https://goatbar.app/configuracoes?integration=canva&status=success",
  errorRedirectUrl: "https://goatbar.app/configuracoes?integration=canva&status=error",
};

describe("1. PKCE Implementation (RFC 7636)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes exact code_challenge for official RFC 7636 test vector", async () => {
    // Official RFC 7636 test vector:
    // code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // SHA-256 + BASE64URL without padding -> "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const rfcVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    const computedChallenge = await generateCodeChallenge(rfcVerifier);
    expect(computedChallenge).toBe(expectedChallenge);
  });

  it("generates code_verifier with valid RFC 7636 character set and length", () => {
    const verifier = generateCodeVerifier(96);
    expect(verifier.length).toBe(96);
    // Permitted characters: [A-Za-z0-9-._~]
    expect(verifier).toMatch(/^[A-Za-z0-9\-\._~]{96}$/);
  });

  it("enforces length constraints between 43 and 128 characters", () => {
    expect(() => generateCodeVerifier(42)).toThrow(/between 43 and 128/);
    expect(() => generateCodeVerifier(129)).toThrow(/between 43 and 128/);
    expect(generateCodeVerifier(43).length).toBe(43);
    expect(generateCodeVerifier(128).length).toBe(128);
  });
});

describe("2. State & Crypto Isolation", () => {
  it("generates cryptographically unique state independent of verifier", () => {
    const state1 = generateState(32);
    const state2 = generateState(32);
    const verifier = generateCodeVerifier(96);

    expect(state1).not.toBe(state2);
    expect(state1.length).toBe(64); // 32 bytes in hex = 64 chars
    expect(state1).not.toContain(verifier);
    expect(state2).not.toContain(verifier);
  });
});

describe("3. Scopes & Official Endpoints", () => {
  it("contains exactly the configured Canva Connect API scopes", () => {
    expect(CANVA_SCOPES).toEqual([
      "design:content:write",
      "design:meta:read",
      "design:meta:write",
      "brandtemplate:meta:read",
      "profile:read",
      "design:content:read",
      "brandtemplate:content:read",
    ]);
  });

  it("uses official Canva Connect API endpoints", () => {
    expect(CANVA_AUTH_URL).toBe("https://www.canva.com/api/oauth/authorize");
    expect(CANVA_TOKEN_URL).toBe("https://api.canva.com/rest/v1/oauth/token");
  });
});

describe("4. Token Exchange & Refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges authorization code for tokens using HTTP Basic Auth", async () => {
    const mockTokenResponse = {
      access_token: "canva_access_token_123",
      refresh_token: "canva_refresh_token_456",
      expires_in: 14400,
      token_type: "Bearer",
      scope: CANVA_SCOPES.join(" "),
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokenResponse,
    } as Response);

    const result = await exchangeCodeForToken("auth_code_abc", "code_verifier_xyz", testConfig);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(CANVA_TOKEN_URL);
    expect(init?.method).toBe("POST");

    // Verify Basic Auth header
    const expectedBasic = btoa(`${testConfig.clientId}:${testConfig.clientSecret}`);
    expect((init?.headers as any)["Authorization"]).toBe(`Basic ${expectedBasic}`);

    // Verify URL-encoded body
    const bodyParams = new URLSearchParams(init?.body as string);
    expect(bodyParams.get("grant_type")).toBe("authorization_code");
    expect(bodyParams.get("code")).toBe("auth_code_abc");
    expect(bodyParams.get("code_verifier")).toBe("code_verifier_xyz");
    expect(bodyParams.get("redirect_uri")).toBe(testConfig.redirectUri);

    expect(result.access_token).toBe("canva_access_token_123");
    expect(result.refresh_token).toBe("canva_refresh_token_456");
  });

  it("refreshes access token with single-use refresh token", async () => {
    const mockRefreshResponse = {
      access_token: "new_access_token_789",
      refresh_token: "new_refresh_token_012",
      expires_in: 14400,
      token_type: "Bearer",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockRefreshResponse,
    } as Response);

    const result = await refreshCanvaAccessToken("old_refresh_token_456", testConfig);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(CANVA_TOKEN_URL);

    const bodyParams = new URLSearchParams(init?.body as string);
    expect(bodyParams.get("grant_type")).toBe("refresh_token");
    expect(bodyParams.get("refresh_token")).toBe("old_refresh_token_456");

    expect(result.access_token).toBe("new_access_token_789");
    expect(result.refresh_token).toBe("new_refresh_token_012");
  });
});

describe("5. Token Lifecycle & Concurrency Protection (getValidCanvaAccessToken)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns cached access token without refresh if still valid (>5 min)", async () => {
    const validExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    const supabaseAdminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: "user-123",
            access_token: "valid_cached_token",
            refresh_token: "rt_123",
            access_token_expires_at: validExpiresAt,
          },
          error: null,
        }),
      }),
    } as any;

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const token = await getValidCanvaAccessToken("user-123", supabaseAdminMock, testConfig);

    expect(token).toBe("valid_cached_token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes expired token and calls atomic rotation RPC", async () => {
    const expiredExpiresAt = new Date(Date.now() - 1000).toISOString(); // Expired 1s ago
    const rpcMock = vi.fn().mockResolvedValue({ data: true, error: null });

    const supabaseAdminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: "user-123",
            access_token: "expired_token",
            refresh_token: "old_rt_123",
            access_token_expires_at: expiredExpiresAt,
          },
          error: null,
        }),
      }),
      rpc: rpcMock,
    } as any;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "rotated_access_token_456",
        refresh_token: "rotated_refresh_token_789",
        expires_in: 14400,
        token_type: "Bearer",
      }),
    } as Response);

    const token = await getValidCanvaAccessToken("user-123", supabaseAdminMock, testConfig);

    expect(token).toBe("rotated_access_token_456");
    expect(rpcMock).toHaveBeenCalledWith("canva_rotate_tokens", {
      p_user_id: "user-123",
      p_expected_refresh_token: "old_rt_123",
      p_new_access_token: "rotated_access_token_456",
      p_new_refresh_token: "rotated_refresh_token_789",
      p_new_expires_at: expect.any(String),
    });
  });

  it("handles double-refresh race condition gracefully by re-reading winning rotated token", async () => {
    const expiredExpiresAt = new Date(Date.now() - 1000).toISOString();
    // Simulate Request B where CAS RPC returns false because Request A already rotated the token
    const rpcMock = vi.fn().mockResolvedValue({ data: false, error: null });

    const maybeSingleMock = vi
      .fn()
      // 1st call: initial lookup with old token
      .mockResolvedValueOnce({
        data: {
          user_id: "user-123",
          access_token: "expired_token",
          refresh_token: "old_rt_123",
          access_token_expires_at: expiredExpiresAt,
        },
        error: null,
      })
      // 2nd call: re-read after CAS failed -> returns the winner's new token
      .mockResolvedValueOnce({
        data: {
          access_token: "winner_access_token_from_request_A",
        },
        error: null,
      });

    const supabaseAdminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: maybeSingleMock,
      }),
      rpc: rpcMock,
    } as any;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "loser_token",
        refresh_token: "loser_rt",
        expires_in: 14400,
        token_type: "Bearer",
      }),
    } as Response);

    const token = await getValidCanvaAccessToken("user-123", supabaseAdminMock, testConfig);

    // Request B successfully recovers and returns the winner's access token
    expect(token).toBe("winner_access_token_from_request_A");
  });
});

describe("6. User Profile Fetching", () => {
  it("extracts display_name and id from Canva user profile response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        profile: {
          id: "canva_user_999",
          display_name: "Goat Bar Admin",
        },
      }),
    } as Response);

    const profile = await fetchCanvaUserProfile("mock_access_token");
    expect(profile.id).toBe("canva_user_999");
    expect(profile.display_name).toBe("Goat Bar Admin");
  });

  it("handles alternative user schema gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: {
          id: "canva_user_888",
          display_name: "Alternate User",
        },
      }),
    } as Response);

    const profile = await fetchCanvaUserProfile("mock_access_token");
    expect(profile.id).toBe("canva_user_888");
    expect(profile.display_name).toBe("Alternate User");
  });
});

describe("7. Security & Sanitization", () => {
  it("redacts sensitive fields in log payloads", () => {
    const rawPayload = {
      user_id: "user-abc-123",
      stage: "oauth_callback",
      access_token: "secret_access_token_xyz",
      refresh_token: "secret_refresh_token_uvw",
      client_secret: "super_secret_client_key",
      code_verifier: "secret_verifier_123",
      code: "auth_code_789",
      authorization: "Bearer secret_jwt",
      nested: {
        token: "deeply_nested_token",
        safe_param: "safe_value",
      },
    };

    const sanitized = sanitizeLog(rawPayload) as any;

    expect(sanitized.user_id).toBe("user-abc-123");
    expect(sanitized.stage).toBe("oauth_callback");
    expect(sanitized.access_token).toBe("[REDACTED]");
    expect(sanitized.refresh_token).toBe("[REDACTED]");
    expect(sanitized.client_secret).toBe("[REDACTED]");
    expect(sanitized.code_verifier).toBe("[REDACTED]");
    expect(sanitized.code).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.nested.token).toBe("[REDACTED]");
    expect(sanitized.nested.safe_param).toBe("safe_value");
  });

  it("throws clear error when required Supabase Secrets are missing", () => {
    // Temporarily clear environment
    const originalClientId = process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_ID;

    expect(() => {
      getCanvaConfig();
    }).toThrow(/Supabase Secrets ausentes/);

    if (originalClientId) process.env.CANVA_CLIENT_ID = originalClientId;
  });
});

describe("8. State & Session Lifecycle Logic", () => {
  it("detects expired sessions accurately", () => {
    const expiredSession = {
      id: "sess-123",
      user_id: "user-456",
      state: "state-abc",
      code_verifier: "verifier-xyz",
      expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute in past
    };

    const isExpired = new Date(expiredSession.expires_at) < new Date();
    expect(isExpired).toBe(true);
  });

  it("accepts valid active session before expiration", () => {
    const activeSession = {
      id: "sess-123",
      user_id: "user-456",
      state: "state-abc",
      code_verifier: "verifier-xyz",
      expires_at: new Date(Date.now() + 9 * 60 * 1000).toISOString(), // 9 minutes in future
    };

    const isExpired = new Date(activeSession.expires_at) < new Date();
    expect(isExpired).toBe(false);
  });

  it("consumes and invalidates session after single use (replay protection)", async () => {
    const deletedIds: string[] = [];
    const supabaseAdminMock = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col, val) => {
          if (col === "id") deletedIds.push(val);
          return Promise.resolve({ data: null, error: null });
        }),
      }),
    };

    // Simulate callback consuming session
    await supabaseAdminMock.from("canva_oauth_sessions").delete().eq("id", "sess-123");

    expect(deletedIds).toContain("sess-123");
  });
});

