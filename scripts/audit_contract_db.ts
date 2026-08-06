import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function testEventContractsUpdate() {
  const contractId = "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f";

  console.log("\n=======================================================");
  console.log("TESTING UPDATE ON event_contracts");
  console.log("=======================================================");

  const { error } = await supabase
    .from("event_contracts")
    .update({
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contractId);

  console.log("Update event_contracts result error:", error);
}

testEventContractsUpdate().catch(console.error);
