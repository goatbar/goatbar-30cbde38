import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QR_URL =
  "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=https%3A%2F%2Fwww.instagram.com%2Fgoatbar_%2F";

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] || char);
}

function safeImageUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("data:image/")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function personalizationHtml(personalization: any, artworkUrl?: string | null) {
  const artwork = safeImageUrl(artworkUrl);
  if (artwork) {
    return `<img class="artwork" src="${esc(artwork)}" alt="" />`;
  }

  const kind = String(personalization?.kind || "generic");
  const label = esc(personalization?.label || "");

  if (kind === "wedding") {
    return `<div class="wedding">
      <div class="initials">${esc(personalization?.initials || "")}</div>
      <div class="wedding-label">${label}</div>
      ${personalization?.date ? `<div class="date">${esc(personalization.date)}</div>` : ""}
    </div>`;
  }
  if (kind === "birthday") {
    return `<div class="birthday">${label}</div>`;
  }
  if (kind === "corporate") {
    return `<div class="corporate"><div class="glasses">♢ ♢</div><div>${label}</div></div>`;
  }
  if (kind === "bachelor") {
    return `<div class="bachelor">GAME OVER</div>`;
  }
  return label ? `<div class="generic">${label}</div>` : "";
}

function pageHtml(menu: any, drinks: any[], pageIndex: number, totalPages: number) {
  const layout = ["expanded", "standard", "compact"].includes(menu?.layout) ? menu.layout : "standard";
  const drinkMarkup = drinks.map((drink) => {
    const name = esc(String(drink?.name || "").slice(0, 120));
    const description = esc(String(drink?.description || "").slice(0, 400));
    return `<section class="drink"><div class="drink-name">${name}</div>${description ? `<div class="drink-description">${description}</div>` : ""}</section>`;
  }).join("");

  const last = pageIndex === totalPages - 1;
  return `<main class="page ${layout}">
    <div class="arch"></div>
    <div class="pink-panel"></div>
    <div class="content">
      <h1>Menu</h1>
      <div class="drinks">${drinkMarkup}</div>
      <div class="personalization">
        ${last ? personalizationHtml(menu.personalization, menu.artworkUrl) : '<div class="continue">CONTINUA</div>'}
      </div>
      <footer>
        ${safeImageUrl(menu.logoDataUrl) ? `<img class="logo" src="${esc(menu.logoDataUrl)}" alt="GOAT Bar" />` : '<div class="logo-fallback">GOAT BAR</div>'}
        <div class="instagram">◎ @goatbar_</div>
        <img class="qr" src="${QR_URL}" alt="QR Instagram" />
      </footer>
    </div>
  </main>`;
}

function buildDocument(menu: any, logoDataUrl: string) {
  const pages = Array.isArray(menu?.pages) && menu.pages.length
    ? menu.pages.slice(0, 6)
    : [Array.isArray(menu?.drinks) ? menu.drinks : []];

  const safeMenu = {
    ...menu,
    logoDataUrl: safeImageUrl(logoDataUrl),
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light only">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#f2dfdf;color:#373132;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#f2dfdf;page-break-after:always}
.page:last-child{page-break-after:auto}
.arch{position:absolute;left:13.5mm;right:13.5mm;top:0;height:53mm;border-radius:0 0 50% 50%;background:#fffdf9}
.pink-panel{position:absolute;left:27mm;right:27mm;top:64mm;bottom:62mm;border-radius:15mm;background:#efcfd1}
.content{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;padding:27mm 25mm 15mm;text-align:center}
h1{margin:0;color:#7c2130;font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:13mm;line-height:1}
.drinks{margin-top:18mm;display:grid;grid-template-columns:1fr;align-content:start}
.expanded .drinks{gap:5.2mm}.standard .drinks{gap:3.5mm}.compact .drinks{gap:2.2mm}
.drink{padding:0 3mm;break-inside:avoid}
.drink-name{color:#7c2130;font-family:Georgia,"Times New Roman",serif;font-weight:600}
.expanded .drink-name{font-size:4.4mm}.standard .drink-name{font-size:4.0mm}.compact .drink-name{font-size:3.55mm}
.drink-description{margin:1mm auto 0;max-width:128mm;line-height:1.22;color:#373132}
.expanded .drink-description{font-size:2.85mm}.standard .drink-description{font-size:2.65mm}.compact .drink-description{font-size:2.35mm}
.personalization{margin-top:auto;min-height:36mm;display:flex;align-items:center;justify-content:center;color:#7c2130;padding:2mm 0 3mm}
.artwork{max-width:95mm;max-height:31mm;object-fit:contain}
.initials{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:14mm;line-height:.9}
.wedding-label{margin-top:2mm;font-family:Georgia,"Times New Roman",serif;font-size:4mm;text-transform:uppercase;letter-spacing:.6mm}
.date{margin-top:2mm;font-size:2.5mm;letter-spacing:1mm}
.birthday{transform:rotate(-3deg);font-family:Georgia,"Times New Roman",serif;font-size:10mm;font-style:italic}
.corporate{font-family:Georgia,"Times New Roman",serif;font-size:5.5mm;font-style:italic}.glasses{font-size:8mm;line-height:1}
.bachelor{font-family:Arial,Helvetica,sans-serif;font-size:8mm;font-weight:900;letter-spacing:-.3mm}
.generic{font-family:Georgia,"Times New Roman",serif;font-size:6mm;font-style:italic}
.continue{font-size:2.4mm;letter-spacing:1.2mm;opacity:.6}
footer{display:grid;grid-template-columns:1fr auto auto;align-items:end;gap:4mm;border-top:.2mm solid rgba(124,33,48,.22);padding-top:3mm;min-height:16mm;color:#7c2130}
.logo{max-width:34mm;max-height:10mm;object-fit:contain;object-position:left center}.logo-fallback{text-align:left;font-weight:800;letter-spacing:1mm}
.instagram{align-self:center;font-size:2.4mm;font-weight:700;letter-spacing:.2mm}
.qr{width:11mm;height:11mm;background:#fff}
</style>
</head>
<body>${pages.map((drinks: any[], index: number) => pageHtml(safeMenu, drinks, index, pages.length)).join("")}</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Autenticação obrigatória." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isInternalGiaCall = Boolean(serviceRoleKey && authHeader === "Bearer " + serviceRoleKey);
    if (!isInternalGiaCall) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData } = await authClient.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Sessão inválida ou expirada." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const menu = body?.menu;
    if (!menu || !Array.isArray(menu.drinks) || menu.drinks.length === 0) {
      return new Response(JSON.stringify({ error: "O cardápio não possui drinks para gerar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (menu.drinks.length > 40) {
      return new Response(JSON.stringify({ error: "Quantidade de drinks acima do limite suportado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const apiToken = Deno.env.get("CLOUDFLARE_BROWSER_RUN_API_TOKEN");
    if (!accountId || !apiToken) {
      throw new Error("Renderizador PDF não configurado no servidor.");
    }

    const html = buildDocument(menu, String(body?.logoDataUrl || ""));
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/pdf",
        },
        body: JSON.stringify({
          html,
          pdfOptions: {
            format: "a4",
            landscape: false,
            printBackground: true,
            preferCSSPageSize: true,
            scale: 1,
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha no renderizador PDF (${response.status}): ${detail.slice(0, 220)}`);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new Error("O renderizador não retornou um PDF válido.");
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cardapio-goat-bar.pdf"',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao gerar cardápio." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
