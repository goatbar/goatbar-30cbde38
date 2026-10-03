import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWhatsAppMessagesUrl } from "../_shared/goat-ai/config.ts";
import {
  generateFirstAccessRecoveryLink,
  markFirstAccessDelivery,
  normalizeFirstAccessUsername,
} from "../_shared/first-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskPhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "WhatsApp cadastrado";
}

async function sendWhatsAppText(to: string, message: string) {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  if (!accessToken || !phoneNumberId) return false;

  const cleanTo = String(to || "").replace(/\D/g, "");
  const response = await fetch(getWhatsAppMessagesUrl(phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanTo,
      type: "text",
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.warn("[FIRST_ACCESS][WHATSAPP_SEND_FAILED]", response.status, body.slice(0, 300));
    return false;
  }

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Serviço indisponível." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json().catch(() => ({}));
  const username = normalizeFirstAccessUsername(body?.username || "");

  if (!/^[a-z0-9._-]{2,64}$/.test(username)) {
    return json({ error: "Usuário inválido." }, 400);
  }

  const { data: profile } = await admin
    .from("goatbar_user_profiles")
    .select("user_id, username, display_name, active")
    .eq("username", username)
    .maybeSingle();

  if (!profile || profile.active === false) {
    return json({ error: "Usuário não encontrado ou inativo." }, 404);
  }

  const { data: messaging } = await admin
    .from("user_messaging_accounts")
    .select("phone_number, verified")
    .eq("user_id", profile.user_id)
    .eq("provider", "whatsapp")
    .eq("verified", true)
    .maybeSingle();

  if (!messaging?.phone_number) {
    return json({ error: "Este usuário ainda não possui WhatsApp autorizado." }, 409);
  }

  const recovery = await generateFirstAccessRecoveryLink(admin, profile.user_id, "web");

  if (!recovery.ok) {
    if (recovery.code === "RATE_LIMIT") {
      return json(
        {
          error: "Aguarde um minuto antes de solicitar um novo link.",
          code: "RATE_LIMIT",
        },
        429,
      );
    }
    return json({ error: "Não foi possível gerar o link agora." }, 500);
  }

  const message =
    `Goat Bar — primeiro acesso\n\n` +
    `Olá, ${recovery.displayName || profile.display_name}. Toque no link abaixo para criar sua senha de acesso ao sistema:\n\n` +
    `${recovery.actionLink}\n\n` +
    `Este link é pessoal. Não encaminhe para ninguém. Se você não solicitou, ignore esta mensagem.`;

  const sent = await sendWhatsAppText(messaging.phone_number, message);

  await markFirstAccessDelivery(
    admin,
    recovery.requestId,
    sent,
    sent ? undefined : "whatsapp_text_not_delivered",
  );

  return json({
    success: sent,
    phone_hint: maskPhone(messaging.phone_number),
    fallback_to_whatsapp: !sent,
  });
});
