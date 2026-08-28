import { createClient } from "@supabase/supabase-js";
import { readdir } from "node:fs/promises";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUBLIC_APP_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PUBLIC_APP_URL) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e PUBLIC_APP_URL são obrigatórios.");
}
const apply = process.argv.includes("--apply");
const slug = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const files = await readdir(new URL("../public/drinks/", import.meta.url));
const assets = new Map(files.map((file) => [slug(file.replace(/\.[^.]+$/, "")), file]));
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: drinks, error } = await supabase.from("drinks").select("id,nome,imagem").order("nome");
if (error) throw error;
const result = { total: drinks.length, valid: 0, absent: 0, invalid: 0, legacy: 0, repairable: 0, repaired: 0 };
for (const drink of drinks) {
  const reference = String(drink.imagem || "").trim();
  const legacy = /^(?:blob:|data:|idb:)/i.test(reference);
  if (!reference) result.absent++;
  if (legacy) result.legacy++;
  let valid = false;
  if (reference && !legacy) {
    const target = /^https?:/i.test(reference) ? reference : new URL(`/${reference.replace(/^\/+/, "")}`, PUBLIC_APP_URL).href;
    try { valid = (await fetch(target, { method: "HEAD" })).ok; } catch { valid = false; }
  }
  if (valid) result.valid++;
  else if (reference && !legacy) result.invalid++;
  const asset = assets.get(slug(drink.id)) || assets.get(slug(drink.nome));
  if (!valid && asset) {
    result.repairable++;
    if (apply) {
      const { error: updateError } = await supabase.from("drinks").update({ imagem: `/drinks/${asset}` }).eq("id", drink.id);
      if (updateError) throw updateError;
      result.repaired++;
    }
  }
}
console.log(JSON.stringify({ mode: apply ? "apply" : "audit", ...result }, null, 2));
