import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function main() {
  console.log("=======================================================");
  console.log("QUERYING EXACT STATE OF CONTRACT SIGNATURE REQUEST");
  console.log("=======================================================");

  const targetId = "1329f747-52c2-4378-94b1-62ab8b30aad4";

  const { data, error } = await supabase
    .from("contract_signature_requests")
    .select("id, dispatch_status, original_file_hash, external_document_id, external_assignment_id, signature_url, last_error")
    .eq("id", targetId)
    .single();

  console.log("\n[QueryResult for ID:", targetId, "]:");
  if (error) {
    console.error("Error querying row:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
