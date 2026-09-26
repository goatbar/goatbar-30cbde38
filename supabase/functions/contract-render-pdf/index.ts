// supabase/functions/contract-render-pdf/index.ts
// Secure PDF rendering via Cloudflare Browser Run (PDF Quick Action)
// Enforces JWT validation, user authorization, strict HTML sanitization and canonical typography.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CANONICAL_CONTRACT_DOCUMENT_CSS } from "./styles.ts";
import { sanitizeAndPrepareContractHtml } from "./sanitize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (value || "").replace(/[&<>"']/g, (char) => entities[char] || char);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validar Método HTTP
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Método não permitido. Utilize POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validar JWT do Usuário Autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Token de autorização obrigatório." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isInternalGiaCall = Boolean(serviceRoleKey && authHeader === "Bearer " + serviceRoleKey);

    const authClient = isInternalGiaCall
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
      : createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });

    if (!isInternalGiaCall) {
      const { data: userData, error: userError } = await authClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ ok: false, error: "Sessão inválida ou expirada. Efetue login novamente." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Obter Credenciais da Cloudflare (secret exclusivo do Browser Run)
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_BROWSER_RUN_API_TOKEN");

    if (!accountId || !apiToken) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_BROWSER_RUN_API_TOKEN não configurados no Supabase Secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "Payload JSON inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Se contractId foi informado, validar autorização do usuário sobre o contrato
    if (body.contractId) {
      const { data: contract, error: cErr } = await authClient
        .from("event_contracts")
        .select("id, event_id")
        .eq("id", body.contractId)
        .single();

      if (cErr || !contract) {
        return new Response(
          JSON.stringify({ ok: false, error: "Acesso negado: contrato não encontrado ou sem permissão de leitura." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Sanitizar o HTML recebido (remove scripts, links externos, estilos inline remotos e agrupa assinaturas)
    const rawHtml = body.html || "";
    if (!rawHtml.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Conteúdo HTML não pode ser vazio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedBodyHtml = sanitizeAndPrepareContractHtml(rawHtml);
    const documentTitle = escapeHtml(body.title || "Contrato GOAT Bar");

    // 6. Montar o documento canônico A4 com fonte e CSS embutidos
    const fullCanonicalHtml = `<!DOCTYPE html>
<html lang="pt-BR" style="background:#ffffff; color:#0f172a; color-scheme:light;">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="light only">
  <title>${documentTitle}</title>
  <style>
${CANONICAL_CONTRACT_DOCUMENT_CSS}
  </style>
</head>
<body style="margin:0; background:#ffffff !important; color:#0f172a !important;">
  <main id="contract-root">
${sanitizedBodyHtml}
  </main>
</body>
</html>`;

    // 7. Chamar Cloudflare Browser Run Quick Action (/pdf)
    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`;

    const cfPayload: any = {
      html: fullCanonicalHtml,
      pdfOptions: {
        format: "a4",
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        scale: 1.0,
      },
    };

    const MAX_RENDER_ATTEMPTS = 4;
    const retryableStatuses = new Set([429, 500, 502, 503, 504]);
    let cfResponse: Response | null = null;

    for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
      cfResponse = await fetch(cfEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          "Accept": "application/pdf",
        },
        body: JSON.stringify(cfPayload),
      });

      if (cfResponse.ok) break;

      const shouldRetry =
        retryableStatuses.has(cfResponse.status) && attempt < MAX_RENDER_ATTEMPTS;

      if (!shouldRetry) break;

      const retryAfterHeader = cfResponse.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const fallbackMs = 1000 * Math.pow(2, attempt - 1);
      const waitMs = Number.isFinite(retryAfterSeconds)
        ? Math.min(Math.max(retryAfterSeconds * 1000, 1000), 8000)
        : Math.min(fallbackMs, 8000);

      console.warn("[contract-render-pdf] renderer throttled; retrying", {
        attempt,
        status: cfResponse.status,
        waitMs,
      });

      // Consumir/descartar o corpo da tentativa falha antes do próximo fetch.
      try {
        await cfResponse.arrayBuffer();
      } catch {
        // Ignore: a próxima tentativa é independente.
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    if (!cfResponse?.ok) {
      const errorText = cfResponse ? await cfResponse.text() : "";
      let errorJson: any = null;
      try {
        errorJson = errorText ? JSON.parse(errorText) : null;
      } catch {
        errorJson = { raw: errorText };
      }

      const throttled = cfResponse?.status === 429;
      return new Response(
        JSON.stringify({
          ok: false,
          error: throttled
            ? "O serviço de geração do PDF atingiu o limite temporário. O sistema tentou novamente automaticamente, mas o serviço ainda está ocupado. Aguarde alguns segundos e tente de novo."
            : "Não foi possível gerar o PDF oficial para assinatura.",
          status: cfResponse?.status || 502,
          statusText: cfResponse?.statusText || "Renderer unavailable",
          cloudflareError: errorJson,
        }),
        {
          // Não propaga 429 para o navegador depois de esgotar os retries:
          // o cliente recebe uma falha transitória tratável e uma mensagem clara.
          status: throttled ? 503 : (cfResponse?.status || 502),
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            ...(throttled ? { "Retry-After": "5" } : {}),
          },
        }
      );
    }

    const pdfBuffer = await cfResponse.arrayBuffer();

    // 8. Validar Magic Bytes %PDF-
    const bytes = new Uint8Array(pdfBuffer);
    if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return new Response(
        JSON.stringify({ ok: false, error: "A Cloudflare não retornou um binário PDF válido." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${documentTitle}.pdf"`,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err?.message || "Erro interno no processamento do PDF.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
