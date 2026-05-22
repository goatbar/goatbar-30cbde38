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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stringToUuid(str) {
  if (!str) return "00000000-0000-0000-0000-000000000000";
  const cleaned = str.trim();
  if (UUID_REGEX.test(cleaned)) return cleaned.toLowerCase();

  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const hex = [];
  let seed = Math.abs(hash);
  for (let i = 0; i < 32; i++) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    hex.push((seed % 16).toString(16));
  }
  hex[12] = "4";
  const yOptions = ["8", "9", "a", "b"];
  const yVal = parseInt(hex[16], 16) % 4;
  hex[16] = yOptions[yVal];

  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function parseMissingColumnFromError(message) {
  if (!message) return null;
  const m = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
  return m?.[1] ?? null;
}

async function upsertWithTolerance(table, payload) {
  let sanitized = { ...payload };
  let attempt = 0;

  while (attempt < 10) {
    console.log(`Upserting ${table} (attempt ${attempt + 1})... keys:`, Object.keys(sanitized));
    const { error } = await supabase.from(table).upsert(sanitized, { onConflict: "id" });
    if (!error) {
      console.log(`Upsert succeeded on attempt ${attempt + 1}`);
      return { error: null };
    }

    console.log(`Upsert failed on attempt ${attempt + 1}: ${error.code} - ${error.message}`);
    const missingColumn = parseMissingColumnFromError(error.message);
    if (!missingColumn) {
      console.log("No missing column parsed from message.");
      return { error };
    }

    if (!(missingColumn in sanitized)) {
      console.log(`Parsed missing column '${missingColumn}' not in payload.`);
      return { error };
    }

    console.log(`Removing column '${missingColumn}' and retrying...`);
    delete sanitized[missingColumn];
    attempt += 1;
  }

  return { error: new Error(`Failed to stabilize upsert on ${table} after multiple attempts`) };
}

async function run() {
  const rawBackup = fs.readFileSync("goatbar-localstorage-backup (1).json", "utf8");
  const data = JSON.parse(rawBackup);
  const storeRaw = data["goatbar-functional-store-v11"];
  const store = typeof storeRaw === "string" ? JSON.parse(storeRaw) : storeRaw;

  console.log("=== Testing session upsert with tolerance ===");
  const sessions = store.financialSessions || [];
  if (sessions.length > 0) {
    const s = sessions[0];
    const sessionPayload = {
      id: stringToUuid(s.id),
      date: s.date || s.data,
      modality: s.modality || s.modalidade || "Goat Botequim",
      labor_value: Number(s.labor_value ?? s.maoDeObraValor ?? 0),
      labor_quantity: Number(s.labor_quantity ?? s.maoDeObraQtd ?? 0),
      labor_names: s.labor_names ?? s.maoDeObraNomes,
      labor_details: s.labor_details ?? s.maoDeObraDetalhes ?? [],
      reposicao_restaurante: Number(s.reposicaoRestaurante || s.reposicao_restaurante || 0),
      custos_restaurante_detalhes:
        s.custosRestauranteDetalhes || s.custos_restaurante_detalhes || [],
    };

    const res = await upsertWithTolerance("financial_sessions", sessionPayload);
    console.log("Result:", res);
  } else {
    console.log("No sessions found in backup.");
  }
}

run();
