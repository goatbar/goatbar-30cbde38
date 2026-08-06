import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function main() {
  console.log("\n=======================================================");
  console.log("TESTING STATUS UPDATES TO TRIGGER TRIGGER EXECUTION");
  console.log("=======================================================");

  // 1. Test updating status on event_contracts
  console.log("\n[Test 1] Testing UPDATE status = 'sent' on event_contracts:");
  const { error: err1 } = await supabase
    .from("event_contracts")
    .update({
      status: "sent",
      sent_for_signature_at: new Date().toISOString(),
    })
    .eq("id", "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f");

  console.log("UPDATE event_contracts error result:");
  console.log(JSON.stringify(err1, null, 2));

  // 2. Test updating status on contract_signature_requests
  console.log("\n[Test 2] Testing UPDATE dispatch_status = 'pending_signature' on contract_signature_requests:");
  const { error: err2 } = await supabase
    .from("contract_signature_requests")
    .update({
      dispatch_status: "pending_signature",
      sent_at: new Date().toISOString(),
    })
    .eq("id", "1329f747-52c2-4378-94b1-62ab8b30aad4");

  console.log("UPDATE contract_signature_requests error result:");
  console.log(JSON.stringify(err2, null, 2));
}

main().catch(console.error);
