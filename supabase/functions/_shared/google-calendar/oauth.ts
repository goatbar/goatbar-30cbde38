export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  projectNumber?: string;
  successRedirectUrl?: string;
  errorRedirectUrl?: string;
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId =
    Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") ||
    "321790958376-o8l22dnicdbc3lr6ahl7la16603aid9.apps.googleusercontent.com";

  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "";

  const redirectUri =
    Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI") ||
    "https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/google-calendar-oauth/callback";

  const projectNumber =
    Deno.env.get("GOOGLE_CALENDAR_PROJECT_NUMBER") || "321790958376";

  const successRedirectUrl = Deno.env.get("GOOGLE_CALENDAR_SUCCESS_REDIRECT_URL");
  const errorRedirectUrl = Deno.env.get("GOOGLE_CALENDAR_ERROR_REDIRECT_URL");

  return {
    clientId,
    clientSecret,
    redirectUri,
    projectNumber,
    successRedirectUrl,
    errorRedirectUrl,
  };
}

export function generateOAuthState(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildGoogleAuthUrl(config: GoogleOAuthConfig, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}

export async function exchangeCodeForTokens(
  config: GoogleOAuthConfig,
  code: string
): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const errJson = JSON.parse(errorText);
      errorDetail = errJson.error_description || errJson.error || errorText;
    } catch {
      // keep errorText
    }
    throw new Error(`Falha ao trocar código de autorização Google: ${errorDetail}`);
  }

  return response.json();
}

export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const errJson = JSON.parse(errorText);
      errorDetail = errJson.error_description || errJson.error || errorText;
    } catch {
      // keep errorText
    }
    throw new Error(`Falha ao renovar token de acesso Google: ${errorDetail}`);
  }

  return response.json();
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter perfil do usuário Google: ${response.statusText}`);
  }

  return response.json();
}
