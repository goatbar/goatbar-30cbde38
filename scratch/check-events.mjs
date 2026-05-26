import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually parse .env file
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

async function check() {
  const { data: events, error: eError } = await supabase
    .from("events")
    .select("*");
  if (eError) {
    console.error(eError);
    return;
  }

  const { data: budgets, error: bError } = await supabase
    .from("event_budget_versions")
    .select("*")
    .eq("is_current", true);
  if (bError) {
    console.error(bError);
    return;
  }

  console.log("=== EVENTS ===");
  for (const ev of events) {
    const budget = budgets.find(b => b.event_id === ev.id);
    console.log(`Event ID: ${ev.id}`);
    console.log(`Client: ${ev.client_name}`);
    console.log(`Status: ${ev.status}`);
    console.log(`Current Budget Value: ${ev.current_budget_value}`);
    console.log(`Current Profit Value: ${ev.current_profit_value}`);
    if (budget) {
      console.log(`- Budget Version: ${budget.version_number}`);
      console.log(`- Profit Value (lucroDesejado): ${budget.profit_value}`);
      console.log(`- Discount Value: ${budget.discount_value}`);
      console.log(`- Discount Desc: ${budget.discount_description}`);
      console.log(`- Final Budget Value: ${budget.final_budget_value}`);
      console.log(`- Drinks Base Cost: ${budget.drinks_base_cost}`);
      console.log(`- Drinks Final Value: ${budget.drinks_final_value}`);
      console.log(`- Team Total Value: ${budget.team_total_value}`);
      console.log(`- Ice Total Value: ${budget.ice_total_value}`);
      console.log(`- Fuel Value: ${budget.fuel_value}`);
      console.log(`- Misc Total Value: ${budget.miscellaneous_total_value}`);
    } else {
      console.log("- No current budget version");
    }
    console.log("-------------------");
  }
}

check();
