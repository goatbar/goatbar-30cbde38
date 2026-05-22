import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Manually parse .env file
const envText = fs.readFileSync(".env", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    // Remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

console.log("Supabase URL:", SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
  // Let's run a query. Since we can't run arbitrary SQL unless we have a RPC function,
  // we can check if we can query the tables directly, or if we can get a list of columns.
  // Actually, we can get list of columns from postgrest by doing a select with limited limit or checking the response headers,
  // or we can select one row from financial_sessions.

  console.log("Fetching one row from financial_sessions...");
  const { data: sessions, error: errorSessions } = await supabase
    .from("financial_sessions")
    .select("*")
    .limit(1);

  if (errorSessions) {
    console.error("Error fetching financial_sessions:", errorSessions);
  } else {
    console.log(
      "financial_sessions structure:",
      sessions.length > 0 ? Object.keys(sessions[0]) : "No rows in financial_sessions",
    );
  }

  console.log("Fetching one row from events...");
  const { data: events, error: errorEvents } = await supabase.from("events").select("*").limit(1);

  if (errorEvents) {
    console.error("Error fetching events:", errorEvents);
  } else {
    console.log(
      "events structure:",
      events.length > 0 ? Object.keys(events[0]) : "No rows in events",
    );
  }

  console.log("Fetching one row from inventory...");
  const { data: inventory, error: errorInventory } = await supabase
    .from("inventory")
    .select("*")
    .limit(1);

  if (errorInventory) {
    console.error("Error fetching inventory:", errorInventory);
  } else {
    console.log(
      "inventory structure:",
      inventory.length > 0 ? Object.keys(inventory[0]) : "No rows in inventory",
    );
  }
}

inspectSchema();
