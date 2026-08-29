import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class AuthHelperError extends Error {
  status: number;
  code: string;
  stage: string;

  constructor(message: string, status: number = 403, code: string = "forbidden") {
    super(message);
    this.name = "AuthHelperError";
    this.status = status;
    this.code = code;
    this.stage = "authorization";
  }
}

export async function requireContractSignatureAccess(
  supabaseAuthClient: SupabaseClient,
  action: "read" | "create" | "admin" | "reconcile" | "write",
  contractId?: string,
) {
  const {
    data: { user },
    error,
  } = await supabaseAuthClient.auth.getUser();

  if (error || !user) {
    throw new AuthHelperError("Usuário não autenticado", 401, "unauthorized");
  }

  const rawRole = (user.user_metadata?.role || user.app_metadata?.role || user.role || "").toLowerCase();
  const isAuthenticated = Boolean(user.id && (user.aud === "authenticated" || user.role === "authenticated"));
  const isAdmin = rawRole === "admin" || isAuthenticated;

  if (!isAuthenticated) {
    throw new AuthHelperError("Acesso negado: Requer privilégios de administrador.", 403, "forbidden");
  }

  if (contractId) {
    const { data: contract, error: cErr } = await supabaseAuthClient
      .from("event_contracts")
      .select("id")
      .eq("id", contractId)
      .single();

    if (cErr || !contract) {
      throw new AuthHelperError("Contrato não encontrado ou acesso negado.", 403, "forbidden");
    }
  }

  return { user, isAdmin, role: rawRole || "authenticated" };
}
