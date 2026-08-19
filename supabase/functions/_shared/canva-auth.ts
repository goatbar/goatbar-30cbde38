// supabase/functions/_shared/canva-auth.ts
// Official Canva Connect API authentication and token lifecycle helper

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_PROFILE_URL = "https://api.canva.com/rest/v1/users/me/profile";
export const CANVA_USER_ME_URL = "https://api.canva.com/rest/v1/users/me";

export const CANVA_SCOPES = [
  "design:content:write",
  "design:meta:read",
  "design:meta:write",
  "brandtemplate:meta:read",
  "profile:read",
  "design:content:read",
  "brandtemplate:content:read",
] as const;

export interface CanvaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  successRedirectUrl?: string;
  errorRedirectUrl?: string;
}

export interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface CanvaUserProfile {
  id: string | null;
  display_name: string | null;
}

/**
 * Reads and validates required Canva Connect API secrets from environment.
 * Fails fast with clear error message if any required secret is missing.
 */
export function getCanvaConfig(): CanvaConfig {
  // In Deno / Supabase Edge Runtime, Deno.env is used. In tests / Node, process.env is fallback.
  const getEnv = (key: string): string | undefined => {
    if (typeof Deno !== "undefined" && Deno.env) {
      return Deno.env.get(key);
    }
    if (typeof process !== "undefined" && process.env) {
      return process.env[key];
    }
    return undefined;
  };

  const clientId = getEnv("CANVA_CLIENT_ID")?.trim();
  const clientSecret = getEnv("CANVA_CLIENT_SECRET")?.trim();
  const redirectUri = getEnv("CANVA_REDIRECT_URI")?.trim();
  const successRedirectUrl = getEnv("CANVA_OAUTH_SUCCESS_REDIRECT")?.trim();
  const errorRedirectUrl = getEnv("CANVA_OAUTH_ERROR_REDIRECT")?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push("CANVA_CLIENT_ID");
  if (!clientSecret) missing.push("CANVA_CLIENT_SECRET");
  if (!redirectUri) missing.push("CANVA_REDIRECT_URI");

  if (missing.length > 0) {
    throw new Error(`Supabase Secrets ausentes para Canva Connect API: ${missing.join(", ")}`);
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    successRedirectUrl: successRedirectUrl || undefined,
    errorRedirectUrl: errorRedirectUrl || undefined,
  };
}

/**
 * Sanitizes errors and objects to ensure no sensitive credentials or tokens are ever logged.
 */
export function sanitizeLog(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeLog);
  }

  const sensitiveKeys = [
    "access_token",
    "refresh_token",
    "token",
    "client_secret",
    "code_verifier",
    "code",
    "authorization",
    "password",
    "secret",
  ];

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Exchanges authorization code for Canva access and refresh tokens.
 * Uses HTTP Basic Authentication as required by Canva Connect API.
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  config?: CanvaConfig
): Promise<CanvaTokenResponse> {
  const cfg = config ?? getCanvaConfig();
  const basicAuth = btoa(`${cfg.clientId}:${cfg.clientSecret}`);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: cfg.redirectUri,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    let errorDetails = "unknown_error";
    try {
      const errJson = await response.json();
      errorDetails = JSON.stringify(sanitizeLog(errJson));
    } catch {
      errorDetails = `HTTP status ${response.status}`;
    }
    console.error("[Canva OAuth] Token exchange error:", {
      status: response.status,
      stage: "token_exchange",
      details: errorDetails,
    });
    throw new Error(`Falha na troca do código de autorização Canva (Status: ${response.status})`);
  }

  const data = (await response.json()) as CanvaTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Resposta inválida do Canva Connect API: tokens ausentes");
  }

  return data;
}

/**
 * Refreshes an expired Canva access token using the stored refresh token.
 * Remember: Canva refresh tokens are SINGLE-USE and rotate upon every refresh.
 */
export async function refreshCanvaAccessToken(
  refreshToken: string,
  config?: CanvaConfig
): Promise<CanvaTokenResponse> {
  const cfg = config ?? getCanvaConfig();
  const basicAuth = btoa(`${cfg.clientId}:${cfg.clientSecret}`);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    let errorDetails = "unknown_error";
    try {
      const errJson = await response.json();
      errorDetails = JSON.stringify(sanitizeLog(errJson));
    } catch {
      errorDetails = `HTTP status ${response.status}`;
    }
    console.error("[Canva OAuth] Token refresh error:", {
      status: response.status,
      stage: "token_refresh",
      details: errorDetails,
    });
    throw new Error(`Falha ao renovar token do Canva (Status: ${response.status})`);
  }

  const data = (await response.json()) as CanvaTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Resposta inválida da renovação Canva: tokens ausentes");
  }

  return data;
}

/**
 * Retrieves a valid Canva access token for the given user.
 * If expired or within safety margin (5 min), refreshes the token atomically using CAS to prevent race conditions.
 */
export async function getValidCanvaAccessToken(
  userId: string,
  supabaseAdmin: SupabaseClient,
  config?: CanvaConfig
): Promise<string> {
  // 1. Fetch current integration record
  const { data: integration, error } = await supabaseAdmin
    .from("canva_integrations")
    .select("user_id, access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !integration) {
    throw new Error("Conexão com Canva não encontrada para este usuário.");
  }

  const now = Date.now();
  const expiresAt = new Date(integration.access_token_expires_at).getTime();
  const SAFETY_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

  // 2. Return cached access token if still well within validity period
  if (expiresAt - now > SAFETY_MARGIN_MS) {
    return integration.access_token;
  }

  // 3. Token is expired or expiring soon -> Refresh
  const oldRefreshToken = integration.refresh_token;
  const newTokens = await refreshCanvaAccessToken(oldRefreshToken, config);
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  // 4. Atomic token rotation via RPC (CAS) to prevent race conditions
  const { data: rotated, error: rpcError } = await supabaseAdmin.rpc("canva_rotate_tokens", {
    p_user_id: userId,
    p_expected_refresh_token: oldRefreshToken,
    p_new_access_token: newTokens.access_token,
    p_new_refresh_token: newTokens.refresh_token,
    p_new_expires_at: newExpiresAt,
  });

  if (rpcError) {
    console.warn("[Canva OAuth] RPC rotation error, fallback to direct update:", rpcError.message);
    // Fallback direct update if RPC is unavailable
    await supabaseAdmin
      .from("canva_integrations")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return newTokens.access_token;
  }

  // If another concurrent request already rotated the token, re-read the winning token
  if (!rotated) {
    const { data: updated } = await supabaseAdmin
      .from("canva_integrations")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (updated?.access_token) {
      return updated.access_token;
    }
  }

  return newTokens.access_token;
}

/**
 * Fetches user profile from Canva Connect API using the access token.
 */
export async function fetchCanvaUserProfile(accessToken: string): Promise<CanvaUserProfile> {
  try {
    const response = await fetch(CANVA_PROFILE_URL, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Handle official schema { profile: { id, display_name } } or { id, display_name }
      const profile = data?.profile ?? data?.user ?? data;
      return {
        id: profile?.id ?? profile?.user_id ?? profile?.team_user_id ?? null,
        display_name: profile?.display_name ?? profile?.name ?? null,
      };
    }

    // Fallback to /users/me if profile endpoint returns 404 or alternate format
    const fallbackRes = await fetch(CANVA_USER_ME_URL, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      const user = data?.user ?? data;
      return {
        id: user?.id ?? user?.user_id ?? null,
        display_name: user?.display_name ?? user?.name ?? null,
      };
    }
  } catch (err) {
    console.error("[Canva API] Error fetching user profile:", sanitizeLog(err));
  }

  return { id: null, display_name: null };
}
