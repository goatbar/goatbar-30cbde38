import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  generateOAuthState,
  getGoogleOAuthConfig,
  GOOGLE_CALENDAR_SCOPES,
  refreshGoogleAccessToken,
} from "../supabase/functions/_shared/google-calendar/oauth";

describe("Google Calendar - OAuth Flow Helpers", () => {
  const dummyConfig = {
    clientId: "321790958376-test.apps.googleusercontent.com",
    clientSecret: "test_secret",
    redirectUri: "https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/google-calendar-oauth/callback",
    projectNumber: "321790958376",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a random hex state of expected length", () => {
    const state = generateOAuthState(32);
    expect(state).toHaveLength(64); // 32 bytes = 64 hex characters
    expect(/^[0-9a-f]+$/.test(state)).toBe(true);
  });

  it("builds the Google OAuth URL with minimal required scopes and offline access", () => {
    const state = "sample_secure_state_123";
    const authUrl = buildGoogleAuthUrl(dummyConfig, state);

    const parsed = new URL(authUrl);
    expect(parsed.origin).toBe("https://accounts.google.com");
    expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("client_id")).toBe(dummyConfig.clientId);
    expect(parsed.searchParams.get("redirect_uri")).toBe(dummyConfig.redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
    expect(parsed.searchParams.get("state")).toBe(state);

    const scopes = (parsed.searchParams.get("scope") || "").split(" ");
    expect(scopes).toEqual(expect.arrayContaining(GOOGLE_CALENDAR_SCOPES));
  });

  it("exchanges authorization code for access and refresh tokens", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "mock_access_token_123",
        refresh_token: "mock_refresh_token_456",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/calendar.events",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await exchangeCodeForTokens(dummyConfig, "auth_code_789");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(options.method).toBe("POST");
    expect(options.body).toContain("code=auth_code_789");
    expect(options.body).toContain("grant_type=authorization_code");

    expect(result.access_token).toBe("mock_access_token_123");
    expect(result.refresh_token).toBe("mock_refresh_token_456");
  });

  it("refreshes access token successfully using refresh token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new_refreshed_access_token",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await refreshGoogleAccessToken(dummyConfig, "valid_refresh_token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(options.body).toContain("grant_type=refresh_token");
    expect(options.body).toContain("refresh_token=valid_refresh_token");

    expect(result.access_token).toBe("new_refreshed_access_token");
  });

  it("fetches user profile info from Google", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "google-user-123",
        email: "socio@goatbar.com.br",
        name: "Sócio Goat Bar",
        picture: "https://lh3.googleusercontent.com/avatar.jpg",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const profile = await fetchGoogleUserInfo("valid_token");

    expect(profile.email).toBe("socio@goatbar.com.br");
    expect(profile.name).toBe("Sócio Goat Bar");
  });
});
