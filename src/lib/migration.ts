import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "goatbar-functional-store-v11";
const LEGACY_MIGRATED_KEY = "goatbar-legacy-migrated-v1";

type LegacyStore = Record<string, any>;

function logDbError(context: string, table: string, payload: unknown, error: any) {
  const errMsg = error?.message || String(error);
  console.error(`[Supabase:${table}] ${context}: ${errMsg}`, { table, payload, error });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stringToUuid(str: string): string {
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

  hex[12] = '4'; // set version to 4
  const yOptions = ['8', '9', 'a', 'b'];
  const yVal = parseInt(hex[16], 16) % 4;
  hex[16] = yOptions[yVal];

  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function toSafeDrinkId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const cleaned = id.trim();
  return UUID_REGEX.test(cleaned) ? cleaned : null;
}

function parseMissingColumnFromError(message: string): string | null {
  if (!message) return null;
  const m = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
  return m?.[1] ?? null;
}

async function upsertWithTolerance(table: string, payload: Record<string, any>) {
  let sanitized = { ...payload };
  let attempt = 0;

  while (attempt < 10) {
    const { error } = await supabase.from(table).upsert(sanitized, { onConflict: "id" });
    if (!error) return { error: null };

    const missingColumn = parseMissingColumnFromError(error.message);
    if (!missingColumn) return { error };

    if (!(missingColumn in sanitized)) return { error };

    console.warn(`[Supabase:${table}] Ignoring non-existent column during upsert: ${missingColumn}`);
    delete sanitized[missingColumn];
    attempt += 1;
  }

  return { error: new Error(`Failed to stabilize upsert on ${table} after multiple attempts`) };
}

async function insertWithTolerance(table: string, payload: Record<string, any>) {
  let sanitized = { ...payload };
  let attempt = 0;

  while (attempt < 10) {
    const { error } = await supabase.from(table).insert(sanitized);
    if (!error) return { error: null };

    if (error.code === "23505") return { error: null }; // ignore duplicates

    const missingColumn = parseMissingColumnFromError(error.message);
    if (!missingColumn) return { error };

    if (!(missingColumn in sanitized)) return { error };

    console.warn(`[Supabase:${table}] Ignoring non-existent column during insert: ${missingColumn}`);
    delete sanitized[missingColumn];
    attempt += 1;
  }

  return { error: new Error(`Failed to stabilize insert on ${table} after multiple attempts`) };
}

export async function migrateLegacyStoreToSupabase() {
  const rawFunctional = localStorage.getItem(STORAGE_KEY);
  const rawMockDb = localStorage.getItem("goatbar_mock_db_v1");
  const migratedFlag = localStorage.getItem(LEGACY_MIGRATED_KEY) === "1";

  if (!rawFunctional && !rawMockDb) {
    return { success: true, migrated: false, message: "Sem dados legados." };
  }

  if (migratedFlag && !rawFunctional && !rawMockDb) {
    return { success: true, migrated: false, message: "Migração já executada." };
  }

  let functionalStore: LegacyStore = {};
  let mockDbStore: LegacyStore = {};

  try {
    functionalStore = rawFunctional ? (JSON.parse(rawFunctional) as LegacyStore) : {};
  } catch (error) {
    logDbError("Falha no parse do store funcional legado", "localStorage", rawFunctional, error);
    return { success: false, migrated: false, message: "Dados legados inválidos (store funcional)." };
  }

  try {
    mockDbStore = rawMockDb ? (JSON.parse(rawMockDb) as LegacyStore) : {};
  } catch (error) {
    logDbError("Falha no parse do mock db legado", "localStorage", rawMockDb, error);
    return { success: false, migrated: false, message: "Dados legados inválidos (mock db)." };
  }

  try {
    let errorCount = 0;
    let migratedEvents = 0;
    let migratedInventory = 0;
    let migratedSessions = 0;
    let migratedSessionItems = 0;

    const functionalEventos = Array.isArray(functionalStore.eventos) ? functionalStore.eventos : [];
    const mockEventos = Array.isArray(mockDbStore.events) ? mockDbStore.events : [];
    const eventos = [...functionalEventos, ...mockEventos];

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

      const { error } = await upsertWithTolerance("events", payload);

      if (error) {
        errorCount += 1;
        logDbError("Erro ao migrar evento", "events", payload, error);
      } else {
        migratedEvents += 1;
      }
    }

    const functionalInventory = Array.isArray(functionalStore.inventoryItems)
      ? functionalStore.inventoryItems
      : [];
    const mockInventory = Array.isArray(mockDbStore.inventory) ? mockDbStore.inventory : [];
    const inventory = [...functionalInventory, ...mockInventory];

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

      const { error } = await upsertWithTolerance("inventory", payload);

      if (error) {
        errorCount += 1;
        logDbError("Erro ao migrar inventário", "inventory", payload, error);
      } else {
        migratedInventory += 1;
      }
    }

    const sessions = Array.isArray(functionalStore.financialSessions)
      ? functionalStore.financialSessions
      : [];

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
        custos_restaurante_detalhes: s.custosRestauranteDetalhes || s.custos_restaurante_detalhes || [],
      };

      const { error: sessionError } = await upsertWithTolerance("financial_sessions", sessionPayload);

      if (sessionError) {
        errorCount += 1;
        logDbError("Erro ao migrar sessão financeira", "financial_sessions", sessionPayload, sessionError);
        continue;
      }

      migratedSessions += 1;

      await supabase.from("financial_session_items").delete().eq("session_id", stringToUuid(s.id));

      const items = Array.isArray(s.items) ? s.items : [];

      for (const i of items) {
        const itemPayload = {
          session_id: stringToUuid(s.id),
          drink_id: toSafeDrinkId(i.drink_id || i.drinkId),
          drink_name: i.drink_name || i.nome || "Item",
          quantity: Number(i.quantity ?? i.quantidade ?? 0),
          unit_price: Number(i.unit_price ?? i.precoUnitario ?? 0),
          unit_cost: Number(i.unit_cost ?? i.custoUnitario ?? 0),
          ingredient_cost: Number(i.ingredient_cost ?? i.custoInsumo ?? 0),
        };

        const { error: itemError } = await insertWithTolerance("financial_session_items", itemPayload);

        if (itemError) {
          errorCount += 1;
          logDbError("Erro ao migrar item de sessão", "financial_session_items", itemPayload, itemError);
        } else {
          migratedSessionItems += 1;
        }
      }
    }

    if (errorCount > 0) {
      return {
        success: false,
        migrated: false,
        message:
          `Migração incompleta: ${errorCount} erro(s). ` +
          `Eventos: ${migratedEvents}/${eventos.length}, ` +
          `Inventário: ${migratedInventory}/${inventory.length}, ` +
          `Sessões: ${migratedSessions}/${sessions.length}, ` +
          `Itens: ${migratedSessionItems}. Verifique o console para detalhes.`,
      };
    }

    localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("goatbar_mock_db_v1");

    return {
      success: true,
      migrated: true,
      message:
        `Dados legados sincronizados com Supabase. ` +
        `Eventos: ${migratedEvents}, Inventário: ${migratedInventory}, ` +
        `Sessões: ${migratedSessions}, Itens: ${migratedSessionItems}.`,
    };
  } catch (error) {
    logDbError("Falha geral da migração", "migration", null, error);
    return { success: false, migrated: false, message: "Falha na migração para Supabase." };
  }
}

export async function migrateLocalStorageToSupabase() {
  return migrateLegacyStoreToSupabase();
}

export function hasLocalData() {
  return Boolean(localStorage.getItem(STORAGE_KEY) || localStorage.getItem("goatbar_mock_db_v1"));
}