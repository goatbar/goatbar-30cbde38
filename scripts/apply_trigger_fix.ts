import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function main() {
  console.log("=======================================================");
  console.log("TESTING EVENT_CONTRACTS UPDATE AFTER TRIGGER FIX");
  console.log("=======================================================");

  // Let's test UPDATE status = 'sent' on event_contracts to see if trigger fix is already active or if 42703 occurs
  const { data, error } = await supabase
    .from("event_contracts")
    .update({
      status: "sent",
      sent_for_signature_at: new Date().toISOString(),
    })
    .eq("id", "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f")
    .select("id, status");

  console.log("\n[Update Result]:");
  console.log("Error:", error);
  console.log("Data:", data);

  // If update succeeded, revert status back to 'draft' immediately to keep test controlled & clean!
  if (!error && data && data.length > 0) {
    const { error: revertErr } = await supabase
      .from("event_contracts")
      .update({
        status: "draft",
        sent_for_signature_at: null,
      })
      .eq("id", "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f");
    console.log("\n[Reverted contract status back to 'draft'] Error:", revertErr);
  }
}

main().catch(console.error);
