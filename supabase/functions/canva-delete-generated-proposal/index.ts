import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeLog } from "../_shared/canva-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return json({ error_code: "unauthenticated", error: "Usuário não autenticado." }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (!user) {
      return json({ error_code: "unauthenticated", error: "Usuário não autenticado." }, 401);
    }

    const { generated_proposal_id: proposalId } = await req.json();
    if (!proposalId) {
      return json(
        { error_code: "invalid_payload", error: "ID da proposta é obrigatório." },
        400,
      );
    }

    // 1. Carregar a proposta do banco
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from("generated_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();

    if (proposalError || !proposal) {
      return json(
        { error_code: "proposal_not_found", error: "Proposta não encontrada." },
        404,
      );
    }

    // 2. Validar que o evento associado existe
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", proposal.event_id)
      .single();

    if (eventError || !event) {
      return json(
        { error_code: "unauthorized", error: "Acesso não autorizado ao evento desta proposta." },
        403,
      );
    }

    // 3. Remover arquivo do Storage (se houver storage_path persistido)
    if (proposal.storage_path) {
      const { error: removeError } = await supabaseAdmin.storage
        .from("generated-proposals")
        .remove([proposal.storage_path]);
      if (removeError) {
        console.warn("[canva-delete-generated-proposal] storage remove error", removeError);
      }
    }

    // 4. Atualizar status para 'deleted'
    const { error: deleteError } = await supabaseAdmin
      .from("generated_proposals")
      .update({
        status: "deleted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId);

    if (deleteError) {
      return json(
        { error_code: "delete_failed", error: "Não foi possível atualizar o status da proposta." },
        500,
      );
    }

    return json({
      success: true,
      deleted_proposal_id: proposalId,
      event_id: proposal.event_id,
    });
  } catch (error) {
    console.error("[canva-delete-generated-proposal]", sanitizeLog(error));
    return json(
      { error_code: "delete_failed", error: "Erro ao excluir a proposta." },
      500,
    );
  }
});
