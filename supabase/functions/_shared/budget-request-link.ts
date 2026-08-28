export const DEFAULT_BUDGET_REQUEST_TTL_DAYS = 14;

export async function createBudgetRequestLink(
  supabaseAdmin: any,
  options: {
    createdBy?: string | null;
    metadata?: Record<string, unknown>;
    baseUrl?: string;
    expiresInDays?: number;
  } = {},
) {
  const baseUrl = (
    options.baseUrl ||
    Deno.env.get("PUBLIC_APP_URL") ||
    Deno.env.get("SITE_URL") ||
    ""
  ).replace(/\/$/, "");
  if (!baseUrl) throw new Error("PUBLIC_APP_URL não configurada.");
  const ttl =
    Number.isInteger(options.expiresInDays) &&
    options.expiresInDays! >= 1 &&
    options.expiresInDays! <= 90
      ? options.expiresInDays!
      : DEFAULT_BUDGET_REQUEST_TTL_DAYS;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + ttl * 86400000).toISOString();
  const metadata =
    options.metadata && typeof options.metadata === "object" && !Array.isArray(options.metadata)
      ? options.metadata
      : {};
  const { error } = await supabaseAdmin
    .from("budget_request_links")
    .insert({ token, created_by: options.createdBy || null, expires_at: expiresAt, metadata });
  if (error) throw error;
  return { url: `${baseUrl}/orcamento/solicitar/${token}`, expires_at: expiresAt };
}
