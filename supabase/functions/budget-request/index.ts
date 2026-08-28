import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { WhatsAppChannelAdapter } from "../_shared/goat-ai/channel/whatsapp-adapter.ts";
import { buildNotificationMessage, getLinkState, validatePublicBudgetPayload } from "./logic.ts";
import { createBudgetRequestLink } from "../_shared/budget-request-link.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
const appUrl = () =>
  (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "create") {
      const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      const {
        data: { user },
      } = await supabase.auth.getUser(bearer);
      if (!user) return json({ error: "Não autorizado." }, 401);
      const baseUrl = appUrl();
      if (!baseUrl) return json({ error: "PUBLIC_APP_URL não configurada." }, 500);
      const metadata =
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? {
              customer_name_hint: String(body.metadata.customer_name_hint || "")
                .trim()
                .slice(0, 120),
            }
          : {};
      return json(
        await createBudgetRequestLink(supabase, {
          createdBy: user.id,
          metadata,
          baseUrl,
          expiresInDays: Number(body.expires_in_days) || undefined,
        }),
      );
    }

    const token =
      typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token) ? body.token : "";
    if (!token) return json({ state: "INVALID" }, 404);
    const { data: link } = await supabase
      .from("budget_request_links")
      .select("id,status,expires_at,used_at,cancelled_at,event_id,metadata")
      .eq("token", token)
      .maybeSingle();
    const state = getLinkState(link);
    if (action === "validate")
      return json({ state, metadata: state === "ACTIVE" ? link?.metadata : undefined });
    if (action !== "submit") return json({ error: "Ação inválida." }, 400);
    if (state !== "ACTIVE" && state !== "USED")
      return json({ state }, state === "INVALID" ? 404 : 409);

    const payload = validatePublicBudgetPayload(body.payload);
    const { data: result, error: rpcError } = await supabase.rpc("consume_budget_request_link", {
      p_token: token,
      p_client_name: payload.client_name,
      p_event_name: payload.event_name || "",
      p_phone: payload.phone,
      p_email: payload.email || "",
      p_date: payload.date,
      p_event_time: payload.event_time || "",
      p_event_location: payload.event_location || "",
      p_city: payload.city || "",
      p_event_type: payload.event_type,
      p_guests: payload.guests,
      p_lead_source: payload.lead_source || "",
      p_referral_name: payload.referral_name || "",
      p_notes: payload.notes || "",
    });
    if (rpcError) throw rpcError;
    if (result.state === "CREATED") {
      // Claim notification once. A WhatsApp failure never rolls back the event.
      const { data: claimed } = await supabase
        .from("budget_request_links")
        .update({ notification_status: "PROCESSING" })
        .eq("token", token)
        .eq("notification_status", "PENDING")
        .select("id")
        .maybeSingle();
      if (claimed) {
        const internalUrl = appUrl() ? `${appUrl()}/eventos/${result.event_id}` : undefined;
        const message = buildNotificationMessage(payload, internalUrl);
        const { data: recipients } = await supabase
          .from("user_messaging_accounts")
          .select("phone_number")
          .eq("provider", "whatsapp")
          .eq("verified", true);
        const adapter = new WhatsAppChannelAdapter(supabase);
        const outcomes = await Promise.all(
          (recipients || []).map((recipient: any) =>
            adapter.sendTextMessage(recipient.phone_number, message, `budget_${result.event_id}`),
          ),
        );
        const sent = outcomes.length > 0 && outcomes.every(Boolean);
        await supabase
          .from("budget_request_links")
          .update(
            sent
              ? {
                  notification_status: "SENT",
                  notification_sent_at: new Date().toISOString(),
                  notification_error: null,
                }
              : {
                  notification_status: "FAILED",
                  notification_error: outcomes.length
                    ? "Falha no envio pelo WhatsApp Adapter."
                    : "Nenhum destinatário interno verificado.",
                },
          )
          .eq("id", claimed.id);
      }
    }
    return json({
      state: result.state === "CREATED" ? "USED" : result.state,
      idempotent: Boolean(result.idempotent),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const validation = /inválid|obrigatório|permitidos/i.test(message);
    console.error("[budget-request]", message);
    return json(
      { error: validation ? message : "Não foi possível processar a solicitação." },
      validation ? 400 : 500,
    );
  }
});
