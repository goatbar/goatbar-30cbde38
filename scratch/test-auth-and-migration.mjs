import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envText = fs.readFileSync(".env", "utf8");
const env = {};
envText.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("Attempting to sign in to Supabase with credentials...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "drinksgoatbar@gmail.com",
    password: "Goatbar@1234",
  });

  if (error) {
    console.error("Sign in failed:", error);
  } else {
    console.log("Sign in successful! User ID:", data.user?.id);

    // Now try to upsert to inventory
    const payload = {
      id: "d87a1cbe-50f2-4436-987a-1cbe50f29436",
      name: "Test Authenticated Item",
      quantity: 10,
      category: "geral",
      unit: "un",
      cost_per_unit: 1.5,
      updated_at: new Date().toISOString(),
    };

    console.log("Attempting to upsert to inventory as authenticated user...");
    const { error: upsertError } = await supabase
      .from("inventory")
      .upsert(payload, { onConflict: "id" });
    if (upsertError) {
      console.error("Upsert failed:", upsertError);
    } else {
      console.log("Upsert successful!");
    }
  }
}

run();
