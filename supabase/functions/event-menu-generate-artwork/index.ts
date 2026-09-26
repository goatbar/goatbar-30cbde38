import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildPrompt(input: any) {
  const type = String(input.eventType || "").toLowerCase();
  const eventName = String(input.eventName || "").trim();
  const bride = String(input.brideName || "").trim();
  const groom = String(input.groomName || "").trim();
  const date = String(input.date || "").trim();

  let subject = "an elegant minimal cocktail-event emblem";
  if (type.includes("casamento")) {
    const initials = [groom, bride].filter(Boolean).map((name) => name[0]?.toUpperCase()).join("");
    subject = `a refined wedding monogram using only the initials "${initials || "GB"}", elegant intertwined serif calligraphy`;
  } else if (type.includes("anivers")) {
    subject = 'elegant hand-lettered words "Happy Birthday" with a subtle celebratory flourish';
  } else if (type.includes("corporat") || type.includes("confratern")) {
    subject = "two elegant cocktail or champagne glasses in a refined celebratory line-art composition";
  } else if (type.includes("despedida") || type.includes("solteir")) {
    subject = 'stylized hand-lettered words "GAME OVER" with a subtle playful celebration motif';
  }

  return [
    "Create a clean premium editorial illustration for GOAT Bar's printed drinks menu.",
    subject + ".",
    eventName ? `Event reference: ${eventName}.` : "",
    date ? `Event date reference: ${date}.` : "",
    "Strict visual rules: monochrome burgundy #7C2130 only; white or transparent background; centered composition; no mockup; no paper texture; no shadows; no gradients; no photographic objects; no border; no extra words; sophisticated wedding/event stationery aesthetic; high contrast; simple enough to print small.",
    "Square composition with generous empty space around the emblem.",
  ].filter(Boolean).join(" ");
}

function decodeBase64(base64: string) {
  const clean = base64.replace(/^data:image\/\w+;base64,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Autenticação obrigatória." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = await req.json();
    const eventId = String(input?.eventId || "");
    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: event, error: eventError } = await client
      .from("events")
      .select("id,event_type,event_name,bride_name,groom_name,date")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Evento não encontrado ou sem acesso." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    if (!accountId || !apiToken) {
      return new Response(JSON.stringify({ error: "IA de imagens não configurada no servidor." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt({
      eventType: input.eventType || event.event_type,
      eventName: input.eventName || event.event_name,
      brideName: input.brideName || event.bride_name,
      groomName: input.groomName || event.groom_name,
      date: input.date || event.date,
    });

    const aiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          num_steps: 4,
        }),
      },
    );

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      throw new Error(`Falha ao gerar arte com IA (${aiResponse.status}): ${detail.slice(0, 240)}`);
    }

    const contentType = aiResponse.headers.get("content-type") || "";
    let imageBytes: Uint8Array;
    let imageType = "image/png";

    if (contentType.includes("application/json")) {
      const payload = await aiResponse.json();
      const base64 =
        payload?.result?.image ||
        payload?.result?.base64 ||
        payload?.image ||
        payload?.result?.data?.[0]?.b64_json;
      if (!base64 || typeof base64 !== "string") {
        throw new Error("A IA respondeu sem uma imagem utilizável.");
      }
      imageBytes = decodeBase64(base64);
    } else {
      imageBytes = new Uint8Array(await aiResponse.arrayBuffer());
      if (contentType.startsWith("image/")) imageType = contentType.split(";")[0];
    }

    if (imageBytes.byteLength < 1000 || imageBytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("A imagem gerada pela IA possui tamanho inválido.");
    }

    const extension = imageType.includes("jpeg") ? "jpg" : imageType.includes("webp") ? "webp" : "png";
    const path = `${eventId}/ai-${Date.now()}.${extension}`;

    const { error: uploadError } = await client.storage
      .from("event-menu-assets")
      .upload(path, imageBytes, {
        contentType: imageType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = client.storage.from("event-menu-assets").getPublicUrl(path);
    const artworkUrl = publicData.publicUrl;
    const updatedAt = new Date().toISOString();

    const { error: settingsError } = await client
      .from("event_menu_settings")
      .upsert({
        event_id: eventId,
        artwork_mode: "ai",
        artwork_url: artworkUrl,
        custom_label: null,
        updated_by: userData.user.id,
        updated_at: updatedAt,
      }, { onConflict: "event_id" });

    if (settingsError) throw settingsError;

    return new Response(JSON.stringify({ artworkUrl, updatedAt }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Falha ao gerar arte personalizada.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
