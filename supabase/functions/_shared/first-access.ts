type FirstAccessChannel = "web" | "whatsapp";

export interface FirstAccessRecoveryResult {
  ok: boolean;
  code?: "RATE_LIMIT" | "USER_INACTIVE" | "AUTH_USER_NOT_FOUND" | "LINK_GENERATION_FAILED";
  requestId?: string;
  actionLink?: string;
  displayName?: string;
  username?: string;
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

export function normalizeFirstAccessUsername(input: string) {
  const raw = String(input || "").trim().toLowerCase();
  return raw.startsWith("@") ? raw.slice(1) : raw;
}

export function isFirstAccessCommand(message: string) {
  const normalized = String(message || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  return (
    normalized === "primeiro acesso" ||
    normalized === "criar senha" ||
    normalized === "definir senha"
  );
}

export async function generateFirstAccessRecoveryLink(
  supabaseAdmin: any,
  userId: string,
  channel: FirstAccessChannel,
): Promise<FirstAccessRecoveryResult> {
  const now = Date.now();
  const oneMinuteAgo = new Date(now - ONE_MINUTE_MS).toISOString();
  const oneHourAgo = new Date(now - ONE_HOUR_MS).toISOString();

  const { count: recentMinuteCount } = await supabaseAdmin
    .from("first_access_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("delivery_status", ["generated", "sent"])
    .gte("requested_at", oneMinuteAgo);

  const { count: recentHourCount } = await supabaseAdmin
    .from("first_access_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("delivery_status", ["generated", "sent"])
    .gte("requested_at", oneHourAgo);

  if ((recentMinuteCount || 0) >= 1 || (recentHourCount || 0) >= 5) {
    return { ok: false, code: "RATE_LIMIT" };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("goatbar_user_profiles")
    .select("username, display_name, active")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile || profile.active === false) {
    return { ok: false, code: "USER_INACTIVE" };
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  const email = authData?.user?.email;
  if (authError || !email) {
    return { ok: false, code: "AUTH_USER_NOT_FOUND" };
  }

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

  const actionLink = linkData?.properties?.action_link;
  if (linkError || !actionLink) {
    return { ok: false, code: "LINK_GENERATION_FAILED" };
  }

  const { data: requestRow, error: requestError } = await supabaseAdmin
    .from("first_access_requests")
    .insert({
      user_id: userId,
      channel,
      delivery_status: "generated",
    })
    .select("id")
    .single();

  if (requestError || !requestRow?.id) {
    return { ok: false, code: "LINK_GENERATION_FAILED" };
  }

  return {
    ok: true,
    requestId: requestRow.id,
    actionLink,
    displayName: profile.display_name,
    username: profile.username,
  };
}

export async function markFirstAccessDelivery(
  supabaseAdmin: any,
  requestId: string | undefined,
  sent: boolean,
  failureReason?: string,
) {
  if (!requestId) return;

  await supabaseAdmin
    .from("first_access_requests")
    .update(
      sent
        ? {
            delivery_status: "sent",
            delivered_at: new Date().toISOString(),
            failure_reason: null,
          }
        : {
            delivery_status: "failed",
            failure_reason: failureReason || "delivery_failed",
          },
    )
    .eq("id", requestId);
}
