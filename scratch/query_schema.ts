import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Read and parse .env manually
const envPath = path.join(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};

envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY", { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const LOCAL_LOGIN_EMAIL = "drinksgoatbar@gmail.com";
const LOCAL_LOGIN_PASSWORD = "Goatbar@1234";

async function main() {
  console.log("Connecting to Supabase at:", supabaseUrl);
  
  // Login first
  console.log("Logging in as:", LOCAL_LOGIN_EMAIL);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: LOCAL_LOGIN_EMAIL,
    password: LOCAL_LOGIN_PASSWORD,
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  console.log("Logged in successfully. User id:", authData.user?.id);

  // Try inserting a test drink to inspect the columns
  const testId = "00000000-0000-0000-0000-000000000000";
  console.log("Inserting test drink...");
  const { data, error } = await supabase
    .from("drinks")
    .insert({
      id: testId,
      name: "Test Drink Schema",
      cost: 5.5,
      price: 12.0
    })
    .select("*");

  if (error) {
    console.error("Error inserting test drink:", error);
  } else {
    console.log("Test drink inserted successfully!");
    console.log("Returned row (schema columns):", data[0]);
    
    // Clean up
    console.log("Cleaning up test drink...");
    const { error: deleteError } = await supabase
      .from("drinks")
      .delete()
      .eq("id", testId);
    if (deleteError) {
      console.error("Error deleting test drink:", deleteError);
    } else {
      console.log("Clean up successful.");
    }
  }
}

main();
