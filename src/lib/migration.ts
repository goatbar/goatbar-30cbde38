import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "goatbar-functional-store-v11";
const LEGACY_MIGRATED_KEY = "goatbar-legacy-migrated-v1";

type LegacyStore = Record<string, any>;

function logDbError(context: string, table: string, payload: unknown, error: unknown) {
  console.error(`[Supabase:${table}] ${context}`, { table, payload, error });
}

// Converte qualquer string de ID em um UUID válido de maneira determinística
export function toDeterministicUUID(str: string): string {
  if (!str) return "00000000-0000-0000-0000-000000000000";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str;
  }

  let hash = "";
  for (let i = 0; i < 32; i++) {
    let charSum = 0;
    for (let j = 0; j < str.length; j++) {
      charSum = (charSum * 31 + str.charCodeAt(j) + i) % 0xffffffff;
    }
    const hex = (charSum % 16).toString(16);
    hash += hex;
  }

  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = "4" + hash.substring(13, 16);
  const part4 = ((parseInt(hash.charAt(16), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20);
  const part5 = hash.substring(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export async function migrateLegacyStoreToSupabase(force = false) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { success: true, migrated: false, message: "Sem dados legados." };
  if (!force && localStorage.getItem(LEGACY_MIGRATED_KEY) === "1") {
    return { success: true, migrated: false, message: "Migração já executada." };
  }

  let store: LegacyStore;
  try {
    store = JSON.parse(raw);
  } catch (error) {
    logDbError("Falha no parse do localStorage legado", "localStorage", raw, error);
    return { success: false, migrated: false, message: "Dados legados inválidos." };
  }

  let hasErrors = false;

  try {
    const eventos = Array.isArray(store.eventos) ? store.eventos : [];
    for (const ev of eventos) {
      const payload = {
        id: toDeterministicUUID(ev.id),
        client_name: ev.client_name || ev.nome || "Sem Nome",
        phone: ev.phone || ev.telefone,
        email: ev.email,
        date: ev.date || ev.data || new Date().toISOString().split("T")[0],
        event_time: ev.event_time,
        event_location: ev.event_location || ev.local,
        city: ev.city || ev.cidade,
        event_type: ev.event_type || ev.tipo || "Evento",
        guests: Number(ev.guests || ev.convidados || 100),
        notes: ev.notes || ev.observacoes,
        status: (ev.status || "novo_orcamento").toLowerCase(),
      };
      const { error } = await supabase.from("events").upsert(payload, { onConflict: "id" });
      if (error) {
        logDbError("Erro ao migrar evento", "events", payload, error);
        hasErrors = true;
      }
    }

    const inventory = Array.isArray(store.inventoryItems) ? store.inventoryItems : [];
    for (const item of inventory) {
      const payload = {
        id: toDeterministicUUID(item.id),
        name: item.name || item.nome || "Item Sem Nome",
        quantity: Number(item.quantity ?? item.quantidadeTotal ?? 0),
        category: item.category || "geral",
        unit: item.unit || "un",
        cost_per_unit: Number(item.cost_per_unit || 0),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("inventory").upsert(payload, { onConflict: "id" });
      if (error) {
        logDbError("Erro ao migrar inventário", "inventory", payload, error);
        hasErrors = true;
      }
    }

    const sessions = Array.isArray(store.financialSessions) ? store.financialSessions : [];
    for (const s of sessions) {
      const sessionPayload = {
        id: toDeterministicUUID(s.id),
        date: s.date || s.data || new Date().toISOString().split("T")[0],
        modality: s.modality || s.modalidade || "Goat Botequim",
        labor_value: Number(s.labor_value ?? s.maoDeObraValor ?? 0),
        labor_quantity: Number(s.labor_quantity ?? s.maoDeObraQtd ?? 0),
        labor_names: s.labor_names ?? s.maoDeObraNomes,
        labor_details: s.labor_details ?? s.maoDeObraDetalhes ?? [],
        reposicao_restaurante: Number(s.reposicaoRestaurante || 0),
        custos_restaurante_detalhes: s.custosRestauranteDetalhes || [],
      };
      const { error: sessionError } = await supabase
        .from("financial_sessions")
        .upsert(sessionPayload, { onConflict: "id" });
      if (sessionError) {
        logDbError(
          "Erro ao migrar sessão financeira",
          "financial_sessions",
          sessionPayload,
          sessionError,
        );
        hasErrors = true;
        continue;
      }

      // Limpar itens anteriores para evitar duplicados ao reexecutar
      const { error: deleteItemsError } = await supabase
        .from("financial_session_items")
        .delete()
        .eq("session_id", sessionPayload.id);
      if (deleteItemsError) {
        logDbError(
          "Erro ao limpar itens de sessão antes de migrar",
          "financial_session_items",
          { session_id: sessionPayload.id },
          deleteItemsError,
        );
      }

      const items = Array.isArray(s.items) ? s.items : [];
      for (const i of items) {
        const itemPayload = {
          session_id: sessionPayload.id,
          drink_id: i.drink_id || i.drinkId ? toDeterministicUUID(i.drink_id || i.drinkId) : null,
          drink_name: i.drink_name || i.nome || "Item",
          quantity: Number(i.quantity ?? i.quantidade ?? 0),
          unit_price: Number(i.unit_price ?? i.precoUnitario ?? 0),
          unit_cost: Number(i.unit_cost ?? i.custoUnitario ?? 0),
          ingredient_cost: Number(i.ingredient_cost ?? i.custoInsumo ?? 0),
        };
        const { error: itemError } = await supabase
          .from("financial_session_items")
          .insert(itemPayload);
        if (itemError) {
          logDbError(
            "Erro ao migrar item de sessão",
            "financial_session_items",
            itemPayload,
            itemError,
          );
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      return {
        success: false,
        migrated: false,
        message:
          "Alguns dados falharam ao migrar. Verifique o console de desenvolvedor para detalhes.",
      };
    }

    localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
    localStorage.removeItem(STORAGE_KEY);
    return {
      success: true,
      migrated: true,
      message: "Dados legados sincronizados com Supabase com sucesso.",
    };
  } catch (error) {
    logDbError("Falha geral da migração", "migration", null, error);
    return { success: false, migrated: false, message: "Falha na migração para Supabase." };
  }
}

export async function migrateLocalStorageToSupabase(force = false) {
  return migrateLegacyStoreToSupabase(force);
}

export function hasLocalData() {
  return Boolean(localStorage.getItem(STORAGE_KEY));
}
