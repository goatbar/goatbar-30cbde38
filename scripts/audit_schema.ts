import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function main() {
  console.log("=== TESTING REAL COLUMNS ON contract_signature_signers ===");
  const { error } = await supabase
    .from("contract_signature_signers")
    .update({
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("signature_request_id", "00000000-0000-0000-0000-000000000000");

  console.log("Result with real columns (status, updated_at):", error);
}

main().catch(console.error);
