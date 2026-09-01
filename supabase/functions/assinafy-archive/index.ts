import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireContractSignatureAccess } from "../_shared/auth-helper.ts";
import { archiveAssinafyDocument } from "../_shared/archive-assinafy-document.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const auth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user) return json({ error: "Usuário não autenticado" }, 401);

    const { documentId } = await req.json();
    if (!documentId) return json({ error: "Campo documentId é obrigatório" }, 400);

    const { data: doc } = await admin
      .from("contract_documents")
      .select("contract_id, addendum_id, event_id")
      .eq("id", documentId)
      .single();

    if (!doc) return json({ error: "Documento não encontrado" }, 404);

    // Valida permissão de acesso do usuário autenticado ao contrato/evento
    if (doc.contract_id) {
      await requireContractSignatureAccess(auth, "read", doc.contract_id);
    }

    const result = await archiveAssinafyDocument(admin, documentId);
    return json({ success: true, ...result });
  } catch (e: any) {
    console.error("[assinafy-archive] error:", e);
    return json({ success: false, error: e.message || "Erro interno no arquivamento" }, 500);
  }
});
