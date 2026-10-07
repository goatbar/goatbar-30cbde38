import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function normalizeUsername(v: unknown) {
  const s = String(v || "").trim().toLowerCase();
  return s.startsWith("@") ? s.slice(1) : s;
}
function validPassword(p: string) {
  return p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return json({ error: "Serviço indisponível." }, 503);
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "activate");

  if (action === "issue") {
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Não autorizado." }, 401);
    const { data: callerData, error: callerError } = await admin.auth.getUser(bearer);
    if (callerError || !callerData.user) return json({ error: "Não autorizado." }, 401);
    const { data: callerProfile } = await admin.from("goatbar_user_profiles").select("active").eq("user_id", callerData.user.id).maybeSingle();
    if (!callerProfile?.active) return json({ error: "Não autorizado." }, 403);

    const username = normalizeUsername(body?.username);
    const { data: profile } = await admin.from("goatbar_user_profiles").select("user_id, active").eq("username", username).maybeSingle();
    if (!profile?.user_id || profile.active === false) return json({ error: "Usuário não encontrado ou inativo." }, 404);

    const code = makeCode();
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin.from("first_access_codes").update({ used_at: new Date().toISOString() }).eq("user_id", profile.user_id).is("used_at", null);
    const { error } = await admin.from("first_access_codes").insert({ user_id: profile.user_id, code_hash: codeHash, expires_at: expiresAt });
    if (error) return json({ error: "Não foi possível gerar o código." }, 500);
    return json({ success: true, code, expires_at: expiresAt });
  }

  const username = normalizeUsername(body?.username);
  const accessCode = String(body?.code || "").trim().toUpperCase().replace(/\s+/g, "");
  const password = String(body?.password || "");
  if (!/^[a-z0-9._-]{2,64}$/.test(username) || !/^[A-Z2-9]{8}$/.test(accessCode)) return json({ error: "Usuário ou código inválido." }, 400);
  if (!validPassword(password)) return json({ error: "A senha deve ter ao menos 8 caracteres, maiúscula, minúscula e número." }, 400);

  const { data: profile } = await admin.from("goatbar_user_profiles").select("user_id, active").eq("username", username).maybeSingle();
  if (!profile?.user_id || profile.active === false) return json({ error: "Usuário ou código inválido." }, 400);

  const { data: row } = await admin.from("first_access_codes").select("id, code_hash, expires_at, failed_attempts").eq("user_id", profile.user_id).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() <= Date.now() || row.failed_attempts >= 5) return json({ error: "Código inválido ou expirado. Solicite um novo código ao administrador." }, 400);

  const suppliedHash = await sha256(accessCode);
  if (suppliedHash !== row.code_hash) {
    await admin.from("first_access_codes").update({ failed_attempts: row.failed_attempts + 1 }).eq("id", row.id);
    return json({ error: "Usuário ou código inválido." }, 400);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.user_id, { password });
  if (updateError) return json({ error: "Não foi possível criar a senha." }, 500);
  await admin.from("first_access_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return json({ success: true });
});