import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "sb_publishable_io8_73vJ7DU593hgwtEkEg_j_9Jrsj5";

const supabase = createClient(url, key);

async function main() {
  console.log("=======================================================");
  console.log("INSPECTING PG CATALOG & TRIGGERS FOR event_contracts");
  console.log("=======================================================");

  // Try querying information_schema if accessible via REST API
  const { data: cols, error: errCols } = await supabase
    .from("contract_history")
    .select("*")
    .limit(0);

  console.log("contract_history query error/data:", errCols, cols);

  // Let's attempt to call rpc if any exists
  const { data: rpcList, error: errRpc } = await supabase.rpc("get_triggers" as any);
  console.log("rpc get_triggers:", errRpc);
}

main().catch(console.error);
