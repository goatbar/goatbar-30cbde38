import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function main() {
  console.log("=======================================================");
  console.log("TESTING TRIGGER FUNCTION CORRECTION ON EVENT_CONTRACTS");
  console.log("=======================================================");

  // Let's test if contract_history table allows insertion using event_contract_id
  const { data: insertData, error: insertErr } = await supabase
    .from("contract_history")
    .insert({
      event_contract_id: "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f",
      action: "audit_test",
      previous_data: { status: "draft" },
      new_data: { status: "sent" },
    })
    .select();

  console.log("\n[1] Manual insert into contract_history with event_contract_id:");
  console.log("Error:", insertErr);
  console.log("Inserted Data:", insertData);

  // Clean up test row if inserted
  if (insertData && insertData[0]?.id) {
    await supabase.from("contract_history").delete().eq("id", insertData[0].id);
    console.log("Cleaned up test row.");
  }

  // Let's test inserting into contract_history with contract_id (expected 42703)
  const { error: insertErrWrong } = await supabase
    .from("contract_history")
    .insert({
      contract_id: "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f",
      action: "audit_test",
    } as any);

  console.log("\n[2] Manual insert into contract_history with contract_id (wrong column):");
  console.log("Error:", insertErrWrong);
}

main().catch(console.error);
