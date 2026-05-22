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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stringToUuid(str) {
  if (!str) {
    return "00000000-0000-0000-0000-000000000000";
  }
  const cleaned = str.trim();
  if (UUID_REGEX.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  // Deterministic UUID generation from any string
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

  hex[12] = "4"; // set version to 4
  const yOptions = ["8", "9", "a", "b"];
  const yVal = parseInt(hex[16], 16) % 4;
  hex[16] = yOptions[yVal];

  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function toSafeDrinkId(id) {
  if (typeof id !== "string") return null;
  const cleaned = id.trim();
  return UUID_REGEX.test(cleaned) ? cleaned : null;
}

async function runTest() {
  const rawBackup = fs.readFileSync("goatbar-localstorage-backup (1).json", "utf8");
  const data = JSON.parse(rawBackup);

  // Let's use the goatbar-functional-store-v11 key
  const storeRaw = data["goatbar-functional-store-v11"];
  const store = typeof storeRaw === "string" ? JSON.parse(storeRaw) : storeRaw;

  console.log("=== Events Migration Test ===");
  const eventos = store.eventos || [];
  for (const ev of eventos) {
    const payload = {
      id: stringToUuid(ev.id),
      client_name: ev.client_name || ev.nome,
      phone: ev.phone || ev.telefone,
      email: ev.email,
      date: ev.date || ev.data,
      event_time: ev.event_time,
      event_location: ev.event_location || ev.local,
      city: ev.city || ev.cidade,
      event_type: ev.event_type || ev.tipo || "Evento",
      guests: Number(ev.guests || ev.convidados || 0),
      notes: ev.notes || ev.observacoes,
      status: (ev.status || "novo_orcamento").toLowerCase(),
      current_budget_value: Number(ev.current_budget_value || ev.valorNegociado || 0),
      current_profit_value: Number(ev.current_profit_value || ev.lucroEstimado || 0),
      payment_due_date: ev.payment_due_date || ev.dataLimitePagamento || null,
      payment_percent_received: Number(ev.payment_percent_received || ev.porcentagemPaga || 0),
      is_paid_full: Boolean(ev.is_paid_full || ev.pagoIntegralmente || false),
    };

    const { error } = await supabase.from("events").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error(`Event migration failed for id ${ev.id} -> ${payload.id}:`, error);
      break; // just print first error to keep output clean
    } else {
      console.log(`Event migrated successfully: ${payload.id}`);
    }
  }

  console.log("=== Inventory Migration Test ===");
  const inventory = store.inventoryItems || [];
  for (const item of inventory) {
    const payload = {
      id: stringToUuid(item.id),
      name: item.name || item.nome,
      quantity: Number(item.quantity ?? item.quantidadeTotal ?? 0),
      category: item.category || "geral",
      unit: item.unit || "un",
      cost_per_unit: Number(item.cost_per_unit || 0),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("inventory").upsert(payload, { onConflict: "id" });
    if (error) {
      console.error(`Inventory migration failed for id ${item.id} -> ${payload.id}:`, error);
      break;
    } else {
      console.log(`Inventory migrated successfully: ${payload.id}`);
    }
  }

  console.log("=== Sessions Migration Test ===");
  const sessions = store.financialSessions || [];
  for (const s of sessions) {
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

    const { error } = await supabase
      .from("financial_sessions")
      .upsert(sessionPayload, { onConflict: "id" });
    if (error) {
      console.error(`Session migration failed for id ${s.id} -> ${sessionPayload.id}:`, error);
      break;
    } else {
      console.log(`Session migrated successfully: ${sessionPayload.id}`);
    }
  }
}

runTest();
