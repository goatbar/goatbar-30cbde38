import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore CommonJS package is supported by the Supabase Edge runtime.
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-goatbar-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return "";
  try {
    return JSON.parse(raw)?.default || "";
  } catch {
    return "";
  }
}

function safeEqual(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const key = adminKey();
  if (!supabaseUrl || !key) {
    return json({ error: "Supabase admin não configurado." }, 500);
  }

  const admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: config, error: configError } = await admin
    .rpc("get_web_push_runtime_config")
    .single();

  if (configError || !config?.vapid_public_key || !config?.vapid_private_key) {
    console.error("[web-push] config error", configError);
    return json({ error: "Configuração Web Push indisponível." }, 500);
  }

  const sendToSubscriptions = async (
    payload: Record<string, unknown>,
    userId?: string,
  ) => {
    let query = admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("enabled", true);

    if (userId) query = query.eq("user_id", userId);

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 300,
            urgency: "high",
            vapidDetails: {
              subject: "mailto:contato@goatbar.com.br",
              publicKey: config.vapid_public_key,
              privateKey: config.vapid_private_key,
            },
          },
        );

        sent += 1;
        await admin
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
      } catch (error: any) {
        failed += 1;
        const statusCode = Number(error?.statusCode || error?.status || 0);
        const gone = statusCode === 404 || statusCode === 410;

        await admin
          .from("push_subscriptions")
          .update({
            enabled: gone ? false : true,
            last_error: String(error?.message || error).slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        console.error(
          `[web-push] delivery failed subscription=${subscription.id} status=${statusCode}`,
          error,
        );
      }
    }

    return { sent, failed, total: (subscriptions || []).length };
  };

  try {
    const body = await req.json().catch(() => ({}));
    const webhookSecret = req.headers.get("x-goatbar-push-secret") || "";

    if (
      config.webhook_secret &&
      safeEqual(webhookSecret, config.webhook_secret)
    ) {
      const record = body?.record || {};
      const structured = record?.structured_data || {};

      if (structured?.type !== "new_budget_request") {
        return json({ success: true, skipped: true });
      }

      const eventId = structured.event_id || record.matched_event_id;
      const clientName =
        structured.client_name || record.source_sender_name || "Cliente";
      const eventName =
        structured.event_name || structured.event_type || "Evento";
      const date = structured.date ? ` · ${structured.date}` : "";

      const result = await sendToSubscriptions({
        title: "Novo orçamento recebido",
        body: `${clientName} · ${eventName}${date}`,
        url: eventId ? `/eventos/${eventId}` : "/gia",
        tag: eventId ? `novo-orcamento-${eventId}` : "novo-orcamento",
        icon: "/icons/goatbar-192.png",
      });

      return json({ success: true, ...result });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Não autenticado." }, 401);

    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const action = body?.action;

    if (action === "register") {
      const subscription = body?.subscription;
      const endpoint = subscription?.endpoint;
      const p256dh = subscription?.keys?.p256dh;
      const auth = subscription?.keys?.auth;

      if (
        typeof endpoint !== "string" ||
        !endpoint.startsWith("https://") ||
        typeof p256dh !== "string" ||
        typeof auth !== "string"
      ) {
        return json({ error: "Assinatura push inválida." }, 400);
      }

      const { error } = await admin.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent:
            typeof body?.user_agent === "string"
              ? body.user_agent.slice(0, 1000)
              : null,
          enabled: true,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

      if (error) throw error;
      return json({ success: true });
    }

    if (action === "unregister") {
      const endpoint = body?.endpoint;
      if (typeof endpoint !== "string") {
        return json({ error: "Endpoint ausente." }, 400);
      }

      const { error } = await admin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      if (error) throw error;
      return json({ success: true });
    }

    if (action === "test") {
      const result = await sendToSubscriptions(
        {
          title: "Notificações ativadas",
          body: "O Goat Bar já pode avisar você sobre novas solicitações de orçamento.",
          url: "/gia",
          tag: "push-ativado",
          icon: "/icons/goatbar-192.png",
        },
        user.id,
      );
      return json({ success: result.sent > 0, ...result });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("[web-push] unexpected error", error);
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
