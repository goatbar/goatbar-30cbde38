import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireContractSignatureAccess(
    supabaseAuthClient: SupabaseClient, 
    action: "read" | "create" | "admin" | "reconcile",
    contractId?: string
) {
    const { data: { user }, error } = await supabaseAuthClient.auth.getUser();
    if (error || !user) throw new Error("Usuário não autenticado");

    const role = (user.user_metadata?.role || user.app_metadata?.role || "").toLowerCase();
    const isAdmin = role === "admin";

    // Ações administrativas requerem a role explícita 'admin'
    if ((action === "admin" || action === "reconcile") && !isAdmin) {
        throw new Error("Acesso negado: Requer privilégios de administrador.");
    }

    // Se a ação exige validação de um contrato (read, create) e o GoatBar 
    // usa USING(true), garantimos que o contrato existe para evitar acessos cegos.
    // Futuramente, essa query deve filtrar pelo user_id/owner_id se a tabela passar a ter dono.
    if (contractId) {
        const { data: contract, error: cErr } = await supabaseAuthClient
            .from("event_contracts")
            .select("id")
            .eq("id", contractId)
            .single();

        if (cErr || !contract) {
            throw new Error("Contrato não encontrado ou acesso negado.");
        }
    }

    return { user, isAdmin, role };
}
