import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!token) return json({ error: "Token da degustação é obrigatório." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "";
    const apiToken = Deno.env.get("CLOUDFLARE_BROWSER_RUN_API_TOKEN") || "";
    const appUrl = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://goatbar.com.br").replace(/\/+$/, "");

    if (!supabaseUrl || !serviceRole) {
      return json({ error: "Configuração do Supabase indisponível." }, 500);
    }
    if (!accountId || !apiToken) {
      return json({ error: "Renderizador de PDF não configurado." }, 500);
    }

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: tasting, error } = await db
      .from("event_tastings")
      .select("id,status,public_enabled,events(event_name,client_name)")
      .eq("public_token", token)
      .single();

    if (error || !tasting || !tasting.public_enabled) {
      return json({ error: "Degustação não encontrada ou indisponível." }, 404);
    }
    if (!["completed", "finalized"].includes(String(tasting.status))) {
      return json({ error: "Finalize a degustação antes de gerar o PDF." }, 409);
    }

    const pageUrl = `${appUrl}/degustacao/${encodeURIComponent(token)}?pdf=1`;
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf?cacheTTL=0`;

    const payload = {
      url: pageUrl,
      emulateMediaType: "screen",
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 60000,
      },
      pdfOptions: {
        format: "a4",
        landscape: false,
        printBackground: true,
        preferCSSPageSize: false,
        scale: 0.78,
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
      },
    };

    const MAX_ATTEMPTS = 4;
    const retryable = new Set([429, 500, 502, 503, 504]);
    let response: Response | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/pdf",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) break;
      if (!retryable.has(response.status) || attempt === MAX_ATTEMPTS) break;

      try {
        await response.arrayBuffer();
      } catch {
        // A próxima tentativa usa uma nova resposta.
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 8000)),
      );
    }

    if (!response?.ok) {
      const detail = response ? await response.text().catch(() => "") : "";
      return json(
        {
          error: "Não foi possível renderizar o retrato da página final.",
          status: response?.status || 502,
          detail: detail.slice(0, 500),
        },
        response?.status === 429 ? 503 : response?.status || 502,
      );
    }

    const pdf = await response.arrayBuffer();
    const bytes = new Uint8Array(pdf);
    if (
      bytes.byteLength < 5 ||
      new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
    ) {
      return json({ error: "O renderizador não retornou um PDF válido." }, 502);
    }

    const ev = Array.isArray((tasting as any).events)
      ? (tasting as any).events[0]
      : (tasting as any).events;
    const rawName = String(ev?.event_name || ev?.client_name || "Degustacao");
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "Degustacao";

    return new Response(pdf, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Degustacao_${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[tasting-render-pdf]", error);
    return json({ error: "Erro interno ao gerar o PDF da degustação." }, 500);
  }
});
