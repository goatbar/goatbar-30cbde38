import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcWdnbHJ4aWRtZWd1amhreWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA1ODYsImV4cCI6MjA5MzQ5NjU4Nn0.RXTdfcAvprj39bgoLUYuKxHao4q1ArdXxbKwG9k7ors";

const supabase = createClient(url, key);

async function main() {
  console.log("\n=== ITEM 6.1: SCHEMA SAMPLE KEYS ===");

  const { data: eventContractsCols, error: ecErr } = await supabase
    .from("event_contracts")
    .select("*")
    .limit(1);

  console.log("event_contracts keys:", eventContractsCols && eventContractsCols.length > 0 ? Object.keys(eventContractsCols[0]) : [], "Error:", ecErr);

  const { data: sigReqCols, error: sigErr } = await supabase
    .from("contract_signature_requests")
    .select("*")
    .limit(1);

  console.log("contract_signature_requests keys:", sigReqCols && sigReqCols.length > 0 ? Object.keys(sigReqCols[0]) : [], "Error:", sigErr);

  const { data: sigEventCols, error: sigEvErr } = await supabase
    .from("contract_signature_events")
    .select("*")
    .limit(1);

  console.log("contract_signature_events keys:", sigEventCols && sigEventCols.length > 0 ? Object.keys(sigEventCols[0]) : [], "Error:", sigEvErr);

  console.log("\n=== ITEM 6.2: REAL QUERY - public.event_contracts ===");
  const { data: ecRow, error: ecRowErr } = await supabase
    .from("event_contracts")
    .select("*")
    .eq("id", "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f");

  console.log("event_contracts row:", JSON.stringify(ecRow, null, 2), "Error:", ecRowErr);

  console.log("\n=== ITEM 6.3: REAL QUERY - public.contract_signature_requests ===");
  const { data: reqRows, error: reqErr } = await supabase
    .from("contract_signature_requests")
    .select("*")
    .eq("contract_id", "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f")
    .order("created_at", { ascending: false });

  console.log("contract_signature_requests rows:", JSON.stringify(reqRows, null, 2), "Error:", reqErr);

  console.log("\n=== ITEM 6.4: REAL QUERY - public.contract_signature_events ===");
  const { data: evRows, error: evErr } = await supabase
    .from("contract_signature_events")
    .select("*")
    .eq("contract_id", "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f")
    .order("created_at", { ascending: false });

  console.log("contract_signature_events rows:", JSON.stringify(evRows, null, 2), "Error:", evErr);
}

main().catch(console.error);
