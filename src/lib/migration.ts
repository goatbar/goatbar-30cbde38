import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "goatbar-functional-store-v11";
const LEGACY_MIGRATED_KEY = "goatbar-legacy-migrated-v1";

type LegacyStore = Record<string, any>;

function logDbError(context: string, table: string, payload: unknown, error: unknown) {
  console.error(`[Supabase:${table}] ${context}`, { table, payload, error });
}

export async function migrateLegacyStoreToSupabase() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { success: true, migrated: false, message: "Sem dados legados." };
  if (localStorage.getItem(LEGACY_MIGRATED_KEY) === "1") return { success: true, migrated: false, message: "Migração já executada." };

  let store: LegacyStore;
  try {
    store = JSON.parse(raw);
  } catch (error) {
    logDbError("Falha no parse do localStorage legado", "localStorage", raw, error);
    return { success: false, migrated: false, message: "Dados legados inválidos." };
  }

  try {
    const eventos = Array.isArray(store.eventos) ? store.eventos : [];
    for (const ev of eventos) {
      const payload = {
        id: ev.id,
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
      };
      const { error } = await supabase.from("events").upsert(payload, { onConflict: "id" });
      if (error) logDbError("Erro ao migrar evento", "events", payload, error);
    }

    const inventory = Array.isArray(store.inventoryItems) ? store.inventoryItems : [];
    for (const item of inventory) {
      const payload = {
        id: item.id,
        name: item.name || item.nome,
        quantity: Number(item.quantity ?? item.quantidadeTotal ?? 0),
        category: item.category || "geral",
        unit: item.unit || "un",
        cost_per_unit: Number(item.cost_per_unit || 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("inventory").upsert(payload, { onConflict: "id" });
      if (error) logDbError("Erro ao migrar inventário", "inventory", payload, error);
    }

    const sessions = Array.isArray(store.financialSessions) ? store.financialSessions : [];
    for (const s of sessions) {
      const sessionPayload = {
        id: s.id,
        date: s.date || s.data,
        modality: s.modality || s.modalidade || "Goat Botequim",
        labor_value: Number(s.labor_value ?? s.maoDeObraValor ?? 0),
        labor_quantity: Number(s.labor_quantity ?? s.maoDeObraQtd ?? 0),
        labor_names: s.labor_names ?? s.maoDeObraNomes,
        labor_details: s.labor_details ?? s.maoDeObraDetalhes ?? [],
      };
      const { error: sessionError } = await supabase.from("financial_sessions").upsert(sessionPayload, { onConflict: "id" });
      if (sessionError) {
        logDbError("Erro ao migrar sessão financeira", "financial_sessions", sessionPayload, sessionError);
        continue;
      }

      const items = Array.isArray(s.items) ? s.items : [];
      for (const i of items) {
        const itemPayload = {
          session_id: s.id,
          drink_id: i.drink_id || i.drinkId,
          drink_name: i.drink_name || i.nome || "Item",
          quantity: Number(i.quantity ?? i.quantidade ?? 0),
          unit_price: Number(i.unit_price ?? i.precoUnitario ?? 0),
          unit_cost: Number(i.unit_cost ?? i.custoUnitario ?? 0),
          ingredient_cost: Number(i.ingredient_cost ?? i.custoInsumo ?? 0),
        };
        const { error: itemError } = await supabase.from("financial_session_items").insert(itemPayload);
        if (itemError && itemError.code !== "23505") {
          logDbError("Erro ao migrar item de sessão", "financial_session_items", itemPayload, itemError);
        }
      }
    }

    localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
    localStorage.removeItem(STORAGE_KEY);
    return { success: true, migrated: true, message: "Dados legados sincronizados com Supabase." };
  } catch (error) {
    logDbError("Falha geral da migração", "migration", null, error);
    return { success: false, migrated: false, message: "Falha na migração para Supabase." };
  }
}

export async function migrateLocalStorageToSupabase() {
  return migrateLegacyStoreToSupabase();
}

export function hasLocalData() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}
