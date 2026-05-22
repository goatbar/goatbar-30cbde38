import fs from "fs";

// Manually parse .env file
const envText = fs.readFileSync(".env", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    value = value.trim();
    // Remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value.trim();
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

async function getSchema() {
  const url = `${SUPABASE_URL}/rest/v1/`;
  console.log("Fetching OpenAPI schema from", url);
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) {
      console.error("HTTP error:", res.status, res.statusText);
      return;
    }
    const schema = await res.json();

    // Let's print definitions for key tables
    const tables = ["events", "inventory", "financial_sessions", "financial_session_items"];
    for (const tableName of tables) {
      console.log(`\n=== Table: ${tableName} ===`);
      const def = schema.definitions[tableName];
      if (!def) {
        console.log("Not found in schema!");
        continue;
      }
      console.log("Properties (columns):");
      for (const [propName, propVal] of Object.entries(def.properties)) {
        console.log(` - ${propName}: ${propVal.type} (${propVal.format || "no format"})`);
      }
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

getSchema();
