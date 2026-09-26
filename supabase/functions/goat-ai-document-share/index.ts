import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeFilename(value: string) {
  return String(value || "documento.pdf").replace(/[\r\n"\\]/g, "_");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) {
      return new Response(JSON.stringify({ error: "Link inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const tokenHash = await sha256(token);

    const { data: share, error: shareError } = await admin
      .from("document_share_links")
      .select("id,bucket_id,object_path,filename,mime_type,expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (shareError) throw shareError;
    if (!share) {
      return new Response(JSON.stringify({ error: "Link não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(share.expires_at).getTime() <= Date.now()) {
      return new Response(JSON.stringify({ error: "Este link expirou. Solicite um novo link à GIA." }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: file, error: fileError } = await admin.storage
      .from(share.bucket_id)
      .download(share.object_path);

    if (fileError || !file) {
      console.error("[goat-ai-document-share] storage_error", {
        shareId: share.id,
        bucket: share.bucket_id,
        path: share.object_path,
        error: fileError?.message || null,
      });
      return new Response(JSON.stringify({ error: "Arquivo não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    admin
      .from("document_share_links")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", share.id)
      .then(() => {})
      .catch(() => {});

    const filename = safeFilename(share.filename || share.object_path.split("/").pop() || "documento.pdf");
    return new Response(await file.arrayBuffer(), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": share.mime_type || "application/pdf",
        "Content-Disposition": "inline; filename=\"" + filename + "\"",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[goat-ai-document-share][error]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Falha ao abrir o documento." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
