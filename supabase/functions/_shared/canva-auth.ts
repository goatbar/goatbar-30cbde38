// supabase/functions/_shared/canva-auth.ts
// Official Canva Connect API authentication, token lifecycle, and brand templates helper

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { summarizeCanvaIntegrations } from "./canva-integration-audit.ts";

export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
export const CANVA_PROFILE_URL = "https://api.canva.com/rest/v1/users/me/profile";
export const CANVA_BRAND_TEMPLATES_URL = "https://api.canva.com/rest/v1/brand-templates";

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

export interface CanvaBrandTemplateItem {
  id: string;
  title: string;
  view_url?: string;
  create_url?: string;
  thumbnail_url?: string;
  updated_at?: number;
  created_at?: number;
}

export interface CanvaBrandTemplatesListResponse {
  items: CanvaBrandTemplateItem[];
  continuation?: string;
}

export interface CanvaDataFieldItem {
  key: string;
  name: string;
  type: string;
}

export interface CanvaBrandTemplateDatasetResponse {
  brand_template_id: string;
  fields: CanvaDataFieldItem[];
}

export class CanvaApiError extends Error {
  constructor(
    public status: number,
    public code:
      | "unauthenticated"
      | "integration_not_found"
      | "token_expired_or_revoked"
      | "insufficient_scope"
      | "brand_template_not_found"
      | "canva_api_error"
      | "canva_service_unavailable",
    message: string
  ) {
    super(message);
    this.name = "CanvaApiError";
  }
}

/**
 * Reads and validates required Canva Connect API secrets from environment.
 */
export function getCanvaConfig(): CanvaConfig {
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
    throw new CanvaApiError(
      401,
      "token_expired_or_revoked",
      `Falha ao renovar token do Canva (Status: ${response.status})`
    );
  }

  const data = (await response.json()) as CanvaTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new CanvaApiError(502, "canva_api_error", "Resposta inválida da renovação Canva: tokens ausentes");
  }

  return data;
}

/**
 * Retrieves a valid Canva access token for the given user.
 */
export async function getValidCanvaAccessToken(
  userId: string,
  supabaseAdmin: SupabaseClient,
  config?: CanvaConfig
): Promise<string> {
  // 1. Fetch current integration record
  // user_id is UNIQUE in the schema, so this is the single current row (there is no
  // process cache). The separate audit query detects legacy duplicate rows.
  const { data: integration, error } = await supabaseAdmin
    .from("canva_integrations")
    .select("user_id, access_token, refresh_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !integration) {
    throw new CanvaApiError(404, "integration_not_found", "Conexão com Canva não encontrada para este usuário.");
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

export interface CanvaIntegrationAudit {
  user_id: string;
  canva_user_id: string | null;
  scopes: string[];
  updated_at: string;
  access_token_expires_at: string;
  integration_count: number;
  duplicate_integration: boolean;
  token_matches_latest_integration: boolean;
}

/** Returns only non-secret integration metadata, always selecting the newest row. */
export async function auditCanvaIntegration(
  userId: string,
  supabaseAdmin: SupabaseClient,
  accessTokenUsed: string,
): Promise<CanvaIntegrationAudit> {
  const { data, error } = await supabaseAdmin
    .from("canva_integrations")
    .select("user_id, canva_user_id, scopes, updated_at, access_token_expires_at, access_token")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data?.length) {
    throw new CanvaApiError(404, "integration_not_found", "Conexão com Canva não encontrada para este usuário.");
  }
  return summarizeCanvaIntegrations(data, accessTokenUsed)!;
}

/**
 * Fetches user profile from official Canva Connect API using the access token.
 * Official endpoint: GET https://api.canva.com/rest/v1/users/me/profile
 * Requires scope: profile:read
 */
export async function fetchCanvaUserProfile(accessToken: string): Promise<CanvaUserProfile> {
  const response = await fetch(CANVA_PROFILE_URL, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new CanvaApiError(401, "token_expired_or_revoked", "Token de acesso do Canva expirado ou revogado.");
  }
  if (response.status === 403) {
    throw new CanvaApiError(403, "insufficient_scope", "Escopo profile:read insuficiente na conexão Canva.");
  }
  if (response.status >= 500) {
    throw new CanvaApiError(502, "canva_service_unavailable", "Serviço Canva temporariamente indisponível.");
  }
  if (!response.ok) {
    throw new CanvaApiError(502, "canva_api_error", `Erro na API do Canva: HTTP ${response.status}`);
  }

  const data = await response.json();
  const profile = data?.profile ?? data?.user ?? data;
  return {
    id: profile?.id ?? profile?.user_id ?? profile?.team_user_id ?? null,
    display_name: profile?.display_name ?? profile?.name ?? "Usuário Canva",
  };
}

/**
 * Lists available Brand Templates from Canva Connect API.
 * Official endpoint: GET https://api.canva.com/rest/v1/brand-templates
 * Requires scope: brandtemplate:meta:read
 */
export async function listCanvaBrandTemplates(
  accessToken: string,
  continuation?: string
): Promise<CanvaBrandTemplatesListResponse> {
  const url = new URL(CANVA_BRAND_TEMPLATES_URL);
  if (continuation) {
    url.searchParams.set("continuation", continuation);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new CanvaApiError(401, "token_expired_or_revoked", "Token de acesso do Canva expirado ou revogado.");
  }
  if (response.status === 403) {
    throw new CanvaApiError(403, "insufficient_scope", "Escopo brandtemplate:meta:read insuficiente.");
  }
  if (response.status >= 500) {
    throw new CanvaApiError(502, "canva_service_unavailable", "Serviço Canva temporariamente indisponível.");
  }
  if (!response.ok) {
    throw new CanvaApiError(502, "canva_api_error", `Erro ao listar templates Canva: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawItems = Array.isArray(data?.items) ? data.items : [];

  const items: CanvaBrandTemplateItem[] = rawItems.map((item: any) => ({
    id: item.id,
    title: item.title || "Template sem título",
    view_url: item.view_url,
    create_url: item.create_url,
    thumbnail_url: item.thumbnail?.url || item.thumbnail_url,
    updated_at: item.updated_at,
    created_at: item.created_at,
  }));

  return {
    items,
    continuation: data?.continuation || undefined,
  };
}

/**
 * Retrieves the Dataset (Data Fields) of a Brand Template from Canva Connect API.
 * Official endpoint: GET https://api.canva.com/rest/v1/brand-templates/{brandTemplateId}/dataset
 * Requires scope: brandtemplate:content:read
 */
export async function getCanvaBrandTemplateDataset(
  accessToken: string,
  brandTemplateId: string
): Promise<CanvaBrandTemplateDatasetResponse> {
  const url = `${CANVA_BRAND_TEMPLATES_URL}/${encodeURIComponent(brandTemplateId)}/dataset`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new CanvaApiError(401, "token_expired_or_revoked", "Token de acesso do Canva expirado ou revogado.");
  }
  if (response.status === 403) {
    throw new CanvaApiError(403, "insufficient_scope", "Escopo brandtemplate:content:read insuficiente.");
  }
  if (response.status === 404) {
    throw new CanvaApiError(404, "brand_template_not_found", "Brand Template não encontrado no Canva.");
  }
  if (response.status >= 500) {
    throw new CanvaApiError(502, "canva_service_unavailable", "Serviço Canva temporariamente indisponível.");
  }
  if (!response.ok) {
    throw new CanvaApiError(502, "canva_api_error", `Erro ao consultar dataset do template: HTTP ${response.status}`);
  }

  const data = await response.json();
  const dataset = data?.dataset || {};

  // Canva Connect API dataset is a map of field_key -> { type: "string" | "image" | "chart" }
  const fields: CanvaDataFieldItem[] = Object.entries(dataset).map(([key, value]: [string, any]) => ({
    key,
    name: key,
    type: typeof value === "object" && value?.type ? String(value.type).toLowerCase() : "text",
  }));

  return {
    brand_template_id: brandTemplateId,
    fields,
  };
}
