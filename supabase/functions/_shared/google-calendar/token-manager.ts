import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleCalendarIntegration } from "./types.ts";
import { getGoogleOAuthConfig, refreshGoogleAccessToken } from "./oauth.ts";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer

export async function getValidGoogleAccessToken(
  supabaseAdmin: SupabaseClient,
  integrationId?: string
): Promise<{ accessToken: string; integration: GoogleCalendarIntegration }> {
  // Query active integration
  let query = supabaseAdmin
    .from("google_calendar_integrations")
    .select("*")
    .neq("status", "disconnected");

  if (integrationId) {
    query = query.eq("id", integrationId);
  } else {
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data: integrations, error } = await query;
  if (error || !integrations || integrations.length === 0) {
    throw new Error("Nenhuma integração ativa com Google Calendar encontrada.");
  }

  const integration = integrations[0] as GoogleCalendarIntegration;

  if (integration.status === "reauthorization_required") {
    throw new Error("A autorização do Google Calendar expirou ou foi revogada. Reconecte sua conta.");
  }

  const expiresAtMs = new Date(integration.token_expires_at).getTime();
  const nowMs = Date.now();

  // If token is still fresh, return it
  if (expiresAtMs - nowMs > EXPIRY_BUFFER_MS) {
    return {
      accessToken: integration.access_token,
      integration,
    };
  }

  // Token is expired or expiring soon -> Refresh
  if (!integration.refresh_token) {
    await supabaseAdmin
      .from("google_calendar_integrations")
      .update({
        status: "reauthorization_required",
        last_sync_error: "Token de acesso expirado e refresh_token ausente.",
      })
      .eq("id", integration.id);

    throw new Error("Sessão Google expirada e sem token de renovação. Por favor, reconecte a conta.");
  }

  try {
    const config = getGoogleOAuthConfig();
    const refreshResult = await refreshGoogleAccessToken(config, integration.refresh_token);

    const newExpiresAt = new Date(Date.now() + (refreshResult.expires_in || 3600) * 1000).toISOString();

    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from("google_calendar_integrations")
      .update({
        access_token: refreshResult.access_token,
        token_expires_at: newExpiresAt,
        status: "connected",
        last_sync_error: null,
      })
      .eq("id", integration.id)
      .select()
      .single();

    if (updateError) {
      console.warn("[token-manager] Failed to persist refreshed token:", updateError.message);
    }

    return {
      accessToken: refreshResult.access_token,
      integration: (updatedData as GoogleCalendarIntegration) || {
        ...integration,
        access_token: refreshResult.access_token,
        token_expires_at: newExpiresAt,
      },
    };
  } catch (refreshErr: any) {
    console.error("[token-manager] Failed to refresh Google token:", refreshErr.message);

    // If refresh token was revoked or invalid
    if (
      refreshErr.message.includes("invalid_grant") ||
      refreshErr.message.includes("revoked") ||
      refreshErr.message.includes("unauthorized")
    ) {
      await supabaseAdmin
        .from("google_calendar_integrations")
        .update({
          status: "reauthorization_required",
          last_sync_error: `Renovação de token rejeitada pelo Google: ${refreshErr.message}`,
        })
        .eq("id", integration.id);
    }

    throw new Error(`Erro ao renovar token Google Calendar: ${refreshErr.message}`);
  }
}
