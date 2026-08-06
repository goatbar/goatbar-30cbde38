import { createClient } from "@supabase/supabase-js";

const url = "https://xdqgglrxidmegujhkygj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkcWdnbHJ4aWRtZWd1amhreWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA1ODYsImV4cCI6MjA5MzQ5NjU4Nn0.RXTdfcAvprj39bgoLUYuKxHao4q1ArdXxbKwG9k7ors";

const supabase = createClient(url, key);

async function main() {
  const contractIdCaptured = "9fe09339-4a4e-4abc-b7c6-d482a2e0fb2f";

  console.log("\n=== CONSULTA DIRETAMENTE NO BANCO DE DADOS ===");
  const { data: contractRow, error } = await supabase
    .from("event_contracts")
    .select("id, event_id, status, created_at, updated_at")
    .eq("id", contractIdCaptured)
    .maybeSingle();

  if (error) {
    console.error("Erro na consulta:", error);
  } else {
    console.log("Registro encontrado em event_contracts:");
    console.log({
      event_contract_id: contractRow?.id,
      event_id: contractRow?.event_id,
      status: contractRow?.status,
      created_at: contractRow?.created_at,
      updated_at: contractRow?.updated_at,
    });
  }
}

main().catch(console.error);
