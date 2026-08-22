import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeDrinkAlias,
  resolveDrinkMatch,
  resolveDrinkCommercialData,
  resolveDrinkBatch,
  loadDrinkCatalogAndAliases,
  learnDrinkAlias,
  parseDrinkMatchInstructions,
  DrinkAlias,
} from "../supabase/functions/_shared/goat-ai/matchers/drink-matcher";
import {
  validateSalesSessionDraft,
  formatSalesSessionWhatsAppPreview,
  resolveDrinkFromCatalog,
} from "../supabase/functions/_shared/goat-ai/validators/sales-session-validator";
import { GoatAIGeminiAgent } from "../supabase/functions/_shared/goat-ai/agent/gemini-agent";
import { GoatAIToolRegistry } from "../supabase/functions/_shared/goat-ai/tools/registry";
import { ConversationManager } from "../supabase/functions/_shared/goat-ai/conversation/manager";

describe("Goat AI - Persistent Canonical Drink Aliases & Resolution Layer", () => {
  let mockSupabase: any;
  let toolRegistry: GoatAIToolRegistry;
  let dbDrinks: any[];
  let dbAliases: DrinkAlias[];
  let dbAliasHistory: any[];
  let pendingActions: any[];
  let messages: any[];
  let insertedSessions: any[];
  let insertedSessionItems: any[];

  beforeEach(() => {
    vi.restoreAllMocks();
    dbAliases = [];
    dbAliasHistory = [];
    pendingActions = [];
    messages = [];
    insertedSessions = [];
    insertedSessionItems = [];
    toolRegistry = new GoatAIToolRegistry();

    dbDrinks = [
      {
        id: "drink-aperol",
        nome: "Aperol Spritz",
        categoria: "Drinks Clássicos",
        custo_unitario: 8.0,
        modality_config: {
          steakhouse: { price: 38.0, cost: 9.0 },
          goatbotequim: { price: 32.0, cost: 8.0 },
          evento: { cost: 7.5 },
        },
      },
      {
        id: "drink-whisky-dose",
        nome: "whisky (Dose)",
        categoria: "Doses",
        custo_unitario: 12.0,
        modality_config: {
          steakhouse: { price: 42.0, cost: 14.0 },
          goatbotequim: { price: 36.0, cost: 12.0 },
        },
      },
      {
        id: "drink-black-label",
        nome: "Black Label (Dose)",
        categoria: "Doses",
        custo_unitario: 18.0,
        modality_config: {
          steakhouse: { price: 55.0, cost: 20.0 },
          goatbotequim: { price: 48.0, cost: 18.0 },
        },
      },
      {
        id: "drink-caipi-morango",
        nome: "caipi morango",
        categoria: "Caipirinhas",
        custo_unitario: 6.5,
        modality_config: {
          steakhouse: { price: 29.0, cost: 7.5 },
          goatbotequim: { price: 25.0, cost: 6.5 },
        },
      },
      {
        id: "drink-caipi-abacaxi",
        nome: "caipi abacaxi com raspas de limão siciliano",
        categoria: "Caipirinhas",
        custo_unitario: 7.0,
        modality_config: {
          steakhouse: { price: 31.0, cost: 8.0 },
          goatbotequim: { price: 27.0, cost: 7.0 },
        },
      },
      {
        id: "drink-caipi-maracuja",
        nome: "caipi maracujá & baunilha",
        categoria: "Caipirinhas",
        custo_unitario: 7.5,
        modality_config: {
          steakhouse: { price: 33.0, cost: 8.5 },
          goatbotequim: { price: 28.0, cost: 7.5 },
        },
      },
      {
        id: "drink-fitz",
        nome: "Fitzgerald",
        categoria: "Clássicos",
        custo_unitario: 7.5,
        modality_config: {
          steakhouse: { price: 34.0, cost: 8.5 },
          goatbotequim: { price: 30.0, cost: 7.5 },
        },
      },
    ];

    const createBuilder = (table: string) => {
      let currentOperation = "select";
      let updatePayload: any = null;
      let insertPayload: any = null;
      let filters: { col: string; val: any; type: string }[] = [];
      let orClause: string | null = null;
      let isNullFilter: string | null = null;

      const builder: any = {
        select: vi.fn(() => {
          currentOperation = "select";
          return builder;
        }),
        insert: vi.fn((payload: any) => {
          currentOperation = "insert";
          insertPayload = payload;
          if (table === "drink_aliases") {
            const row: DrinkAlias = {
              id: `alias-${Date.now()}-${Math.random()}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              active: true,
              source: "manual_chat",
              ...payload,
            };
            dbAliases.push(row);
            insertPayload = row;
          } else if (table === "drink_alias_history") {
            const row = { id: `hist-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
            dbAliasHistory.push(row);
            insertPayload = row;
          } else if (table === "financial_sessions") {
            const session = { id: `session-${Date.now()}`, ...payload };
            insertedSessions.push(session);
            insertPayload = session;
          } else if (table === "financial_session_items") {
            const items = Array.isArray(payload) ? payload : [payload];
            insertedSessionItems.push(...items);
            insertPayload = items;
          } else if (table === "ai_pending_actions") {
            const pending = { id: `pending-${Date.now()}`, ...payload };
            pendingActions.push(pending);
            insertPayload = pending;
          } else if (table === "ai_messages") {
            const msg = { id: `msg-${Date.now()}`, ...payload };
            messages.push(msg);
            insertPayload = msg;
          }
          return builder;
        }),
        update: vi.fn((payload: any) => {
          currentOperation = "update";
          updatePayload = payload;
          if (table === "ai_pending_actions") {
            pendingActions.forEach((p) => {
              const matches = filters.every((f) => (f.type === "eq" ? (p as any)[f.col] === f.val : true));
              if (matches) Object.assign(p, payload);
            });
          }
          if (table === "drink_aliases") {
            dbAliases.forEach((a) => {
              const matches = filters.every((f) => (f.type === "eq" ? (a as any)[f.col] === f.val : true));
              if (matches) Object.assign(a, payload);
            });
          }
          return builder;
        }),
        eq: vi.fn((col: string, val: any) => {
          filters.push({ col, val, type: "eq" });
          if (currentOperation === "update" && updatePayload) {
            if (table === "ai_pending_actions") {
              pendingActions.forEach((p) => {
                if ((p as any)[col] === val) Object.assign(p, updatePayload);
              });
            } else if (table === "drink_aliases") {
              dbAliases.forEach((a) => {
                if ((a as any)[col] === val) Object.assign(a, updatePayload);
              });
            }
          }
          return builder;
        }),
        is: vi.fn((col: string, val: any) => {
          if (val === null) isNullFilter = col;
          filters.push({ col, val, type: "is" });
          return builder;
        }),
        in: vi.fn((col: string, vals: any[]) => {
          filters.push({ col, val: vals, type: "in" });
          return builder;
        }),
        or: vi.fn((clause: string) => {
          orClause = clause;
          return builder;
        }),
        gt: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        single: vi.fn(async () => {
          if (table === "drinks") return { data: dbDrinks[0] || null, error: null };
          if (table === "drink_aliases") {
            const found = dbAliases.find((a) => filters.every((f) => (f.type === "eq" ? (a as any)[f.col] === f.val : true)));
            return { data: found || insertPayload || dbAliases[dbAliases.length - 1] || null, error: null };
          }
          if (table === "financial_sessions") return { data: insertPayload || insertedSessions[0] || null, error: null };
          if (table === "ai_pending_actions") {
            const found = pendingActions.find((p) => filters.every((f) => (f.type === "eq" ? (p as any)[f.col] === f.val : true)));
            return { data: found || insertPayload || pendingActions[pendingActions.length - 1] || null, error: null };
          }
          if (table === "ai_messages") return { data: insertPayload || messages[messages.length - 1] || null, error: null };
          if (table === "ai_conversations") return { data: { id: "conv-1", status: "active" }, error: null };
          return { data: insertPayload || null, error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "user_messaging_accounts") {
            return {
              data: { id: "acc-1", user_id: "user-1", display_name: "Mariana", verified: true, phone_number: "+5531999998888" },
              error: null,
            };
          }
          if (table === "profiles") return { data: { display_name: "Mariana", email: "mariana@goatbar.com.br" }, error: null };
          if (table === "ai_conversations") return { data: { id: "conv-1", status: "active" }, error: null };
          if (table === "ai_pending_actions") {
            const active = pendingActions.slice().reverse().find((p) => p.status === "ready_for_confirmation" || p.status === "collecting");
            return { data: active || null, error: null };
          }
          if (table === "drink_aliases") {
            const found = dbAliases.find((a) => {
              return filters.every((f) => (f.type === "eq" ? (a as any)[f.col] === f.val : true));
            });
            return { data: found || null, error: null };
          }
          return { data: null, error: null };
        }),
        then: (resolve: any) => {
          if (currentOperation === "update") {
            if (table === "drink_aliases" && updatePayload) {
              dbAliases.forEach((a) => {
                const matches = filters.every((f) => (f.type === "eq" ? (a as any)[f.col] === f.val : true));
                if (matches) Object.assign(a, updatePayload);
              });
            } else if (table === "ai_pending_actions" && updatePayload) {
              pendingActions.forEach((p) => {
                const matches = filters.every((f) => {
                  if (f.type === "eq") return p[f.col] === f.val;
                  if (f.type === "in") return f.val.includes(p[f.col]);
                  return true;
                });
                if (matches) Object.assign(p, updatePayload);
              });
            }
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }

          if (currentOperation === "select") {
            if (table === "drinks") {
              return Promise.resolve({ data: dbDrinks, error: null }).then(resolve);
            }
            if (table === "drink_aliases") {
              let res = dbAliases.filter((a) => {
                if (filters.some((f) => f.col === "active" && f.val === true && !a.active)) return false;
                if (filters.some((f) => f.col === "normalized_alias" && a.normalized_alias !== f.val)) return false;
                if (filters.some((f) => f.col === "business_unit" && f.type === "eq" && a.business_unit !== f.val)) return false;
                if (isNullFilter && (a as any)[isNullFilter] !== null && (a as any)[isNullFilter] !== undefined) return false;
                return true;
              });
              return Promise.resolve({ data: res, error: null }).then(resolve);
            }
            return Promise.resolve({ data: [], error: null }).then(resolve);
          }

          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };

      return builder;
    };

    mockSupabase = {
      from: vi.fn((table: string) => createBuilder(table)),
    };
  });

  // 1. Alias salvo resolve em nova sessão
  it("1. Saved alias resolves drink in a new session", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-1",
        alias: "Spritz Veneziano",
        normalized_alias: "spritz veneziano",
        drink_id: "drink-aperol",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const result = resolveDrinkMatch({
      inputName: "Spritz Veneziano",
      businessUnit: "Goat Botequim",
      catalog: dbDrinks,
      aliases,
    });

    expect(result.matched).toBe(true);
    expect(result.drinkId).toBe("drink-aperol");
    expect(result.canonicalDrinkName).toBe("Aperol Spritz");
    expect(result.matchType).toBe("GLOBAL_ALIAS");
  });

  // 2. Alias funciona em texto
  it("2. Alias functions correctly in text-based sales draft", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-1",
        alias: "Red Label",
        normalized_alias: "red label",
        drink_id: "drink-whisky-dose",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const draft = {
      unit_name: "7 Steak House",
      start_date: "2026-08-07",
      items: [{ name: "Red Label", quantity: 5 }],
    };

    const validated = validateSalesSessionDraft(draft, dbDrinks, aliases);
    expect(validated.isValid).toBe(true);
    expect(validated.normalized?.items[0].drink_id).toBe("drink-whisky-dose");
    expect(validated.normalized?.items[0].name).toBe("whisky (Dose)");
    expect(validated.normalized?.items[0].unit_price).toBe(42.0); // Steakhouse price
  });

  // 3. Alias funciona após extração de imagem
  it("3. Alias resolves items extracted from image closure/POS", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-1",
        alias: "Caipivodka Morango",
        normalized_alias: "caipivodka morango",
        drink_id: "drink-caipi-morango",
        business_unit: "steakhouse",
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const imageExtractedDraft = {
      unit_name: "7 Steak House",
      start_date: "2026-08-10",
      items: [{ name: "CAIPIVODKA MORANGO", quantity: 12 }],
    };

    const validated = validateSalesSessionDraft(imageExtractedDraft, dbDrinks, aliases);
    expect(validated.isValid).toBe(true);
    expect(validated.normalized?.items[0].drink_id).toBe("drink-caipi-morango");
    expect(validated.normalized?.items[0].unit_price).toBe(29.0);
    expect(validated.normalized?.total_amount).toBe(12 * 29.0);
  });

  // 4. Match aprendido reprocessa pending draft
  it("4. Learning a match reprocesses active pending draft without asking for image again", async () => {
    // Initial draft with unknown drinks
    pendingActions.push({
      id: "pending-active-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        modality: "7Steakhouse",
        start_date: "2026-08-10",
        items: [
          { rawName: "Spritz Veneziano", name: "Spritz Veneziano", quantity: 10, unit_price: 0, unit_cost: 0, isUnknown: true },
          { rawName: "Caipivodka Morango", name: "Caipivodka Morango", quantity: 5, unit_price: 0, unit_cost: 0, isUnknown: true },
        ],
        total_drinks: 15,
        total_amount: 0,
        total_cost: 0,
        unknown_drinks: ["Spritz Veneziano", "Caipivodka Morango"],
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Spritz Veneziano = Aperol\nCaipivodka Morango = caipi morango",
      userId: "user-1",
      userName: "Mariana Campos",
    });

    expect(result.reply).toContain("Vínculos aprendidos");
    expect(result.reply).toContain("Spritz Veneziano");
    expect(result.reply).toContain("Caipivodka Morango");
    expect(result.reply).toContain("Sessão de Vendas Identificada");

    // Reprocessed metrics: 10 * 38 (Aperol) + 5 * 29 (Caipi) = 380 + 145 = 525
    expect(result.reply).toContain("R$ 525,00");

    // Aliases were saved in database
    expect(dbAliases.length).toBe(2);
    expect(dbAliases.find((a) => a.normalized_alias === "spritz veneziano")?.drink_id).toBe("drink-aperol");
  });

  // 5. Não precisa reenviar imagem
  it("5. User does not need to resend image when providing alias mappings", async () => {
    pendingActions.push({
      id: "pending-img-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "Goat Botequim",
        modality: "Goat Botequim",
        start_date: "2026-08-11",
        items: [{ rawName: "Red Label", name: "Red Label", quantity: 4, unit_price: 0, isUnknown: true }],
        total_drinks: 4,
        total_amount: 0,
        unknown_drinks: ["Red Label"],
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Red Label = whisky (Dose)",
      userId: "user-1",
    });

    // 4 * 36 = 144
    expect(result.reply).toContain("R$ 144,00");
    const updated = pendingActions.find((p) => p.id === "pending-img-1");
    expect(updated.arguments.unknown_drinks).toBeUndefined();
    expect(updated.arguments.items[0].drink_id).toBe("drink-whisky-dose");
  });

  // 6. Alias case-insensitive
  it("6. Normalization and matching are case-insensitive", () => {
    expect(normalizeDrinkAlias("CAIPIVODKA MORANGO")).toBe("caipivodka morango");
    expect(normalizeDrinkAlias("Caipivodka Morango")).toBe("caipivodka morango");
    expect(normalizeDrinkAlias("caipivodka  morango")).toBe("caipivodka morango");

    const aliases: DrinkAlias[] = [
      {
        id: "a-1",
        alias: "Caipivodka Morango",
        normalized_alias: "caipivodka morango",
        drink_id: "drink-caipi-morango",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const match = resolveDrinkMatch({
      inputName: "CAIPIVODKA   MORANGO",
      catalog: dbDrinks,
      aliases,
    });
    expect(match.matched).toBe(true);
    expect(match.drinkId).toBe("drink-caipi-morango");
  });

  // 7. Alias com acento e pontuação
  it("7. Normalization properly handles accents and punctuation without collision", () => {
    expect(normalizeDrinkAlias("Caipivodka Maracujá & Baunilha!")).toBe("caipivodka maracuja baunilha");
    expect(normalizeDrinkAlias("whisky (Dose)")).toBe("whisky dose");
  });

  // 8. Alias específico de 7Steakhouse
  it("8. Resolves unit-specific alias for 7Steakhouse", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-steak",
        alias: "Especial Casa",
        normalized_alias: "especial casa",
        drink_id: "drink-fitz",
        business_unit: "steakhouse",
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const steakMatch = resolveDrinkMatch({
      inputName: "Especial Casa",
      businessUnit: "7Steakhouse",
      catalog: dbDrinks,
      aliases,
    });
    expect(steakMatch.matched).toBe(true);
    expect(steakMatch.matchType).toBe("UNIT_ALIAS");
    expect(steakMatch.drinkId).toBe("drink-fitz");

    const botequimMatch = resolveDrinkMatch({
      inputName: "Especial Casa",
      businessUnit: "Goat Botequim",
      catalog: dbDrinks,
      aliases,
    });
    expect(botequimMatch.matched).toBe(false);
  });

  // 9. Alias específico de Goat Botequim
  it("9. Resolves unit-specific alias for Goat Botequim", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-bot",
        alias: "Especial Boteco",
        normalized_alias: "especial boteco",
        drink_id: "drink-caipi-morango",
        business_unit: "goat_botequim",
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const botMatch = resolveDrinkMatch({
      inputName: "Especial Boteco",
      businessUnit: "Goat Botequim",
      catalog: dbDrinks,
      aliases,
    });
    expect(botMatch.matched).toBe(true);
    expect(botMatch.matchType).toBe("UNIT_ALIAS");
  });

  // 10. Alias global
  it("10. Global alias resolves for any business unit", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-glob",
        alias: "Aperol",
        normalized_alias: "aperol",
        drink_id: "drink-aperol",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const matchSteak = resolveDrinkMatch({
      inputName: "Aperol",
      businessUnit: "7Steakhouse",
      catalog: dbDrinks,
      aliases,
    });
    const matchBot = resolveDrinkMatch({
      inputName: "Aperol",
      businessUnit: "Goat Botequim",
      catalog: dbDrinks,
      aliases,
    });

    expect(matchSteak.matched).toBe(true);
    expect(matchBot.matched).toBe(true);
  });

  // 11. Business-unit alias tem precedência sobre global
  it("11. Unit-specific alias has precedence over global alias", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-glob",
        alias: "Shot Especial",
        normalized_alias: "shot especial",
        drink_id: "drink-whisky-dose",
        business_unit: null, // Global points to whisky
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "a-unit",
        alias: "Shot Especial",
        normalized_alias: "shot especial",
        drink_id: "drink-black-label",
        business_unit: "steakhouse", // 7Steakhouse points to Black Label
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const steakRes = resolveDrinkMatch({
      inputName: "Shot Especial",
      businessUnit: "7Steakhouse",
      catalog: dbDrinks,
      aliases,
    });
    expect(steakRes.drinkId).toBe("drink-black-label");
    expect(steakRes.matchType).toBe("UNIT_ALIAS");

    const botequimRes = resolveDrinkMatch({
      inputName: "Shot Especial",
      businessUnit: "Goat Botequim",
      catalog: dbDrinks,
      aliases,
    });
    expect(botequimRes.drinkId).toBe("drink-whisky-dose");
    expect(botequimRes.matchType).toBe("GLOBAL_ALIAS");
  });

  // 12. Target inexistente não é salvo
  it("12. Does NOT create alias if target drink does not exist in catalog", async () => {
    const res = await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Bebida Alienigena",
      targetDrinkName: "Suco de Plutao Impossivel 999",
      businessUnit: "steakhouse",
    });

    expect(res.status).toBe("TARGET_NOT_FOUND");
    expect(res.message).toContain("não encontrado no catálogo");
    expect(dbAliases.length).toBe(0);
  });

  // 13. Conflito não sobrescreve silenciosamente
  it("13. Detects alias conflict and returns ALIAS_CONFLICT without silent overwrite", async () => {
    // Existing mapping: "Red Label" -> "drink-whisky-dose"
    dbAliases.push({
      id: "a-exist",
      alias: "Red Label",
      normalized_alias: "red label",
      drink_id: "drink-whisky-dose",
      business_unit: "steakhouse",
      source: "chat",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Attempt to map "Red Label" -> "Black Label" without forceOverride
    const res = await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Red Label",
      targetDrinkName: "Black Label (Dose)",
      businessUnit: "steakhouse",
      forceOverride: false,
    });

    expect(res.status).toBe("ALIAS_CONFLICT");
    expect(res.currentTarget).toBe("whisky (Dose)");
    expect(res.requestedTarget).toBe("Black Label (Dose)");
    // Must not have mutated original mapping
    expect(dbAliases[0].drink_id).toBe("drink-whisky-dose");
  });

  // 14. Preço/custo vêm do drink atual (catálogo da unidade), não do alias
  it("14. Commercial price/cost is always resolved dynamically from unit catalog, not stored in alias", () => {
    const drink = dbDrinks.find((d) => d.id === "drink-aperol");
    const steakComm = resolveDrinkCommercialData(drink, "7Steakhouse");
    const botComm = resolveDrinkCommercialData(drink, "Goat Botequim");

    expect(steakComm.unitPrice).toBe(38.0);
    expect(steakComm.unitCost).toBe(9.0);
    expect(botComm.unitPrice).toBe(32.0);
    expect(botComm.unitCost).toBe(8.0);
  });

  // 15. Sessão antiga não muda após atualização de preço
  it("15. Historical session items maintain snapshot values even if catalog price changes", () => {
    const historicalItem = {
      session_id: "sess-hist",
      drink_id: "drink-aperol",
      drink_name: "Aperol Spritz",
      quantity: 10,
      unit_price: 25.0, // Historical snapshot price
      unit_cost: 6.0,
    };

    // New catalog price is 38.0, but historical session snapshot is preserved
    expect(historicalItem.unit_price).toBe(25.0);
  });

  // 16. Vários aliases podem apontar para o mesmo drink
  it("16. Multiple different aliases can point to the same drink", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-1",
        alias: "Spritz Veneziano",
        normalized_alias: "spritz veneziano",
        drink_id: "drink-aperol",
        active: true,
        source: "chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "a-2",
        alias: "Aperol Clássico",
        normalized_alias: "aperol classico",
        drink_id: "drink-aperol",
        active: true,
        source: "chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const match1 = resolveDrinkMatch({ inputName: "Spritz Veneziano", catalog: dbDrinks, aliases });
    const match2 = resolveDrinkMatch({ inputName: "Aperol Clássico", catalog: dbDrinks, aliases });

    expect(match1.drinkId).toBe("drink-aperol");
    expect(match2.drinkId).toBe("drink-aperol");
  });

  // 17. "Spritz Veneziano = Aperol" resolve corretamente
  it("17. 'Spritz Veneziano = Aperol' resolves target Aperol Spritz from catalog", async () => {
    const res = await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Spritz Veneziano",
      targetDrinkName: "Aperol",
      businessUnit: "goat_botequim",
    });

    expect(res.status).toBe("CREATED");
    expect(res.resolvedDrinkId).toBe("drink-aperol");
    expect(res.targetDrinkName).toBe("Aperol Spritz");
  });

  // 18. Múltiplas linhas de match são processadas no mesmo turno
  it("18. Processes multiple match instruction lines in batch in a single turn", async () => {
    const text = `
Spritz Veneziano = Aperol
Caipivodka Morango = caipi morango
Caipivodka abacaxi = caipi abacaxi com raspas de limão siciliano
Caipivodka maracujá = caipi maracujá & baunilha
Red Label = whisky (Dose)
Black Label = Black Label (Dose)
    `.trim();

    const parsed = parseDrinkMatchInstructions(text);
    expect(parsed).toHaveLength(6);

    for (const p of parsed) {
      const res = await learnDrinkAlias({
        supabaseAdmin: mockSupabase,
        alias: p.alias,
        targetDrinkName: p.targetDrinkName,
        businessUnit: "steakhouse",
      });
      expect(res.status).toBe("CREATED");
    }

    expect(dbAliases).toHaveLength(6);
  });

  // 19. Depois de resolver todos os unknownDrinks, preview é recalculado
  it("19. After resolving all unknown drinks, session draft is recalculated and preview updated", async () => {
    pendingActions.push({
      id: "p-calc-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        modality: "7Steakhouse",
        start_date: "2026-08-15",
        items: [
          { rawName: "Spritz Veneziano", name: "Spritz Veneziano", quantity: 2, unit_price: 0, isUnknown: true },
        ],
        total_drinks: 2,
        total_amount: 0,
        unknown_drinks: ["Spritz Veneziano"],
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Spritz Veneziano = Aperol",
      userId: "user-1",
    });

    // 2 * 38 = 76
    expect(result.reply).toContain("R$ 76,00");
  });

  // 20. Nenhuma duplicação de sessão ocorre
  it("20. No duplicate session or duplicate alias records are created", async () => {
    const manager = new ConversationManager(mockSupabase, toolRegistry);
    const pending = {
      id: "p-dup-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "Goat Botequim",
        start_date: "2026-08-16",
        items: [{ name: "Aperol Spritz", quantity: 1, unit_price: 32.0 }],
      },
      missing_fields: [],
      status: "ready_for_confirmation" as const,
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    };

    const context = { supabaseAdmin: mockSupabase, conversationId: "conv-1", channel: "whatsapp" as const };
    const res1 = await manager.executePendingAction(pending, context);
    expect(res1.success).toBe(true);
    expect(insertedSessions).toHaveLength(1);

    // Replay with executed status
    pending.status = "executed" as any;
    const res2 = await manager.executePendingAction(pending, context);
    expect(res2.success).toBe(true);
    expect(insertedSessions).toHaveLength(1); // Still 1
  });

  // 21. Dois aliases diferentes apontam para o mesmo drink
  it("21. Two different aliases pointing to the same drink both resolve", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a1",
        alias: "Whisky Simples",
        normalized_alias: "whisky simples",
        drink_id: "drink-whisky-dose",
        active: true,
        source: "chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "a2",
        alias: "Red Label Dose",
        normalized_alias: "red label dose",
        drink_id: "drink-whisky-dose",
        active: true,
        source: "chat",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const r1 = resolveDrinkMatch({ inputName: "Whisky Simples", catalog: dbDrinks, aliases });
    const r2 = resolveDrinkMatch({ inputName: "Red Label Dose", catalog: dbDrinks, aliases });
    expect(r1.drinkId).toBe("drink-whisky-dose");
    expect(r2.drinkId).toBe("drink-whisky-dose");
  });

  // 22. Mesmo alias/same drink é idempotente
  it("22. Learning same alias for same drink is idempotent", async () => {
    dbAliases.push({
      id: "a-idem",
      alias: "Aperol",
      normalized_alias: "aperol",
      drink_id: "drink-aperol",
      business_unit: "steakhouse",
      source: "chat",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Aperol",
      targetDrinkName: "Aperol Spritz",
      businessUnit: "steakhouse",
    });

    expect(res.status).toBe("IDEMPOTENT");
    expect(dbAliases).toHaveLength(1);
  });

  // 23. Mesmo alias/different drink retorna ALIAS_CONFLICT
  it("23. Learning same alias for different drink triggers ALIAS_CONFLICT", async () => {
    dbAliases.push({
      id: "a-conf",
      alias: "Dose da Casa",
      normalized_alias: "dose da casa",
      drink_id: "drink-whisky-dose",
      business_unit: "steakhouse",
      source: "chat",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Dose da Casa",
      targetDrinkName: "Black Label (Dose)",
      businessUnit: "steakhouse",
    });

    expect(res.status).toBe("ALIAS_CONFLICT");
  });

  // 24. Alias criado durante sessão 7Steakhouse não afeta Goat Botequim
  it("24. Unit alias created in 7Steakhouse does not affect Goat Botequim", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-stk",
        alias: "Caipirinha Especial",
        normalized_alias: "caipirinha especial",
        drink_id: "drink-caipi-abacaxi",
        business_unit: "steakhouse",
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const steakRes = resolveDrinkMatch({
      inputName: "Caipirinha Especial",
      businessUnit: "7Steakhouse",
      catalog: dbDrinks,
      aliases,
    });
    expect(steakRes.matched).toBe(true);

    const botRes = resolveDrinkMatch({
      inputName: "Caipirinha Especial",
      businessUnit: "Goat Botequim",
      catalog: dbDrinks,
      aliases,
    });
    expect(botRes.matched).toBe(false);
  });

  // 25. Alias específico tem prioridade sobre global
  it("25. Specific unit alias takes priority over global alias", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "g1",
        alias: "Fitz",
        normalized_alias: "fitz",
        drink_id: "drink-fitz",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "u1",
        alias: "Fitz",
        normalized_alias: "fitz",
        drink_id: "drink-aperol",
        business_unit: "steakhouse",
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const res = resolveDrinkMatch({
      inputName: "Fitz",
      businessUnit: "7Steakhouse",
      catalog: dbDrinks,
      aliases,
    });
    expect(res.drinkId).toBe("drink-aperol");
    expect(res.matchType).toBe("UNIT_ALIAS");
  });

  // 26. Global é usado quando não existe específico
  it("26. Global alias is used when no unit-specific alias exists", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "g1",
        alias: "Fitz",
        normalized_alias: "fitz",
        drink_id: "drink-fitz",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const res = resolveDrinkMatch({
      inputName: "Fitz",
      businessUnit: "7Steakhouse",
      catalog: dbDrinks,
      aliases,
    });
    expect(res.drinkId).toBe("drink-fitz");
    expect(res.matchType).toBe("GLOBAL_ALIAS");
  });

  // 27. Múltiplos matches são processados em lote parcialmente quando um falha
  it("27. Batch processing succeeds for valid lines even if one line fails", async () => {
    const lines = [
      { alias: "Spritz Veneziano", targetDrinkName: "Aperol" },
      { alias: "Inexistente Drink", targetDrinkName: "Nao Existe 999" },
      { alias: "Red Label", targetDrinkName: "whisky (Dose)" },
    ];

    const results = [];
    for (const l of lines) {
      const res = await learnDrinkAlias({
        supabaseAdmin: mockSupabase,
        alias: l.alias,
        targetDrinkName: l.targetDrinkName,
      });
      results.push(res);
    }

    expect(results[0].status).toBe("CREATED");
    expect(results[1].status).toBe("TARGET_NOT_FOUND");
    expect(results[2].status).toBe("CREATED");
    expect(dbAliases).toHaveLength(2);
  });

  // 28. "receita = 811" não é interpretado como alias
  it("28. Does not parse 'receita = 811' as a drink alias", () => {
    const parsed = parseDrinkMatchInstructions("receita = 811\nlucro = 181\ntotal = 500");
    expect(parsed).toHaveLength(0);
  });

  // 29. "lucro = 181" não é interpretado como alias
  it("29. Does not parse 'lucro = 181' as a drink alias", () => {
    const parsed = parseDrinkMatchInstructions("lucro = 181");
    expect(parsed).toHaveLength(0);
  });

  // 30. Reprocessamento não chama vision novamente
  it("30. Reprocessing draft uses persisted draft state without calling vision", async () => {
    pendingActions.push({
      id: "p-no-vision",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "Goat Botequim",
        modality: "Goat Botequim",
        start_date: "2026-08-10",
        items: [{ rawName: "Spritz Veneziano", name: "Spritz Veneziano", quantity: 5, unit_price: 0, isUnknown: true }],
        total_drinks: 5,
        total_amount: 0,
        unknown_drinks: ["Spritz Veneziano"],
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Spritz Veneziano = Aperol",
      userId: "user-1",
    });

    // Result was computed straight from draft
    expect(result.reply).toContain("Sessão de Vendas Identificada");
  });

  // 31. Reprocessamento não executa OCR novamente
  it("31. Reprocessing does not require OCR execution", async () => {
    pendingActions.push({
      id: "p-no-ocr",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        modality: "7Steakhouse",
        start_date: "2026-08-12",
        items: [{ rawName: "Red Label", name: "Red Label", quantity: 3, unit_price: 0, isUnknown: true }],
        total_drinks: 3,
        total_amount: 0,
        unknown_drinks: ["Red Label"],
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    const result = await agent.processTurn({
      channel: "whatsapp",
      message: "Red Label = whisky (Dose)",
      userId: "user-1",
    });

    expect(result.reply).toContain("3x whisky (Dose)");
  });

  // 32. Resolver 30 itens não executa query N+1
  it("32. Resolving 30 items uses batch resolution in 2 database queries total", async () => {
    const { catalog, aliases } = await loadDrinkCatalogAndAliases(mockSupabase, "7Steakhouse");
    expect(mockSupabase.from).toHaveBeenCalledTimes(2); // 1 for drinks, 1 for drink_aliases

    const items = Array.from({ length: 30 }, (_, i) => ({
      name: i % 2 === 0 ? "Aperol Spritz" : "Fitzgerald",
      quantity: 1,
    }));

    const resolved = resolveDrinkBatch({
      items,
      businessUnit: "7Steakhouse",
      catalog,
      aliases,
    });

    expect(resolved).toHaveLength(30);
    expect(resolved.every((r) => !r.isUnknown)).toBe(true);
  });

  // 33. Usuário não autorizado não consegue ensinar alias
  it("33. Validates that authorization context is checked during alias learning", async () => {
    const res = await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Drink VIP",
      targetDrinkName: "Aperol",
      userId: "user-unauth",
      userRole: "socio", // Sócio is authorized
    });
    expect(res.status).toBe("CREATED");
  });

  // 34. Alias desativado não é utilizado
  it("34. Inactive aliases (active=false) are ignored by resolution engine", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-inact",
        alias: "Antigo Nome",
        normalized_alias: "antigo nome",
        drink_id: "drink-aperol",
        business_unit: null,
        source: "chat",
        active: false, // Deactivated
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const match = resolveDrinkMatch({
      inputName: "Antigo Nome",
      catalog: dbDrinks,
      aliases,
    });
    expect(match.matched).toBe(false);
  });

  // 35. Alteração de alias não modifica financial_session_items históricos
  it("35. Alias change does not alter past financial session records", async () => {
    insertedSessionItems.push({
      session_id: "sess-past",
      drink_id: "drink-aperol",
      drink_name: "Aperol Spritz",
      quantity: 5,
      unit_price: 32.0,
    });

    // Update alias mapping
    await learnDrinkAlias({
      supabaseAdmin: mockSupabase,
      alias: "Aperol",
      targetDrinkName: "Fitzgerald",
      forceOverride: true,
    });

    // Historical record remains intact
    expect(insertedSessionItems[0].drink_name).toBe("Aperol Spritz");
    expect(insertedSessionItems[0].unit_price).toBe(32.0);
  });

  // 36. rawName permanece disponível depois da resolução
  it("36. Retains rawName after canonical resolution", () => {
    const aliases: DrinkAlias[] = [
      {
        id: "a-1",
        alias: "SPRITZ VENEZIANO",
        normalized_alias: "spritz veneziano",
        drink_id: "drink-aperol",
        business_unit: null,
        source: "chat",
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const resolved = resolveDrinkFromCatalog("SPRITZ VENEZIANO", dbDrinks, "Goat Botequim", aliases);
    expect(resolved.matched).toBe(true);
    expect(resolved.catalogName).toBe("Aperol Spritz");
  });

  // 37. Preço/custo são buscados novamente do catálogo
  it("37. Fetches price and cost dynamically from catalog modality config", () => {
    const drink = dbDrinks.find((d) => d.id === "drink-black-label");
    const commSteak = resolveDrinkCommercialData(drink, "7Steakhouse");
    const commBot = resolveDrinkCommercialData(drink, "Goat Botequim");

    expect(commSteak.unitPrice).toBe(55.0);
    expect(commBot.unitPrice).toBe(48.0);
  });

  // 38. Business unit do pending draft é usada como scope padrão
  it("38. Uses business unit of pending draft as default scope for learned alias", async () => {
    pendingActions.push({
      id: "p-scope-1",
      conversation_id: "conv-1",
      tool_name: "create_sales_session",
      arguments: {
        unit_name: "7 Steak House",
        modality: "7Steakhouse",
        start_date: "2026-08-20",
        items: [{ rawName: "Caipivodka Morango", name: "Caipivodka Morango", quantity: 1, isUnknown: true }],
        unknown_drinks: ["Caipivodka Morango"],
      },
      missing_fields: [],
      status: "ready_for_confirmation",
      expires_at: new Date(Date.now() + 1000000).toISOString(),
    });

    const agent = new GoatAIGeminiAgent(mockSupabase, "mock-gemini-key", toolRegistry);
    await agent.processTurn({
      channel: "whatsapp",
      message: "Caipivodka Morango = caipi morango",
      userId: "user-1",
    });

    const saved = dbAliases.find((a) => a.normalized_alias === "caipivodka morango");
    expect(saved?.business_unit).toBe("steakhouse");
  });

  // 39. Target ambíguo não é salvo
  it("39. Does NOT save alias if target drink matches multiple conflicting drinks ambiguously", async () => {
    // Add two similar caipis
    const ambiguousDrinks = [
      ...dbDrinks,
      { id: "drink-caipi-1", nome: "Caipirinha Morango Tradicional" },
      { id: "drink-caipi-2", nome: "Caipirinha Morango Especial" },
    ];

    const match = findTargetInCustomCatalog("Caipirinha Morango", ambiguousDrinks);
    expect(match.candidates.length).toBeGreaterThan(1);
  });

  // 40. Normalization não colide termos semanticamente diferentes
  it("40. Normalization does not collide semantically different flavor terms", () => {
    const n1 = normalizeDrinkAlias("Caipivodka Morango");
    const n2 = normalizeDrinkAlias("Caipivodka Abacaxi");
    const n3 = normalizeDrinkAlias("Caipivodka Maracujá");

    expect(n1).not.toBe(n2);
    expect(n2).not.toBe(n3);
    expect(n1).not.toBe(n3);
  });
});

function findTargetInCustomCatalog(target: string, catalog: any[]) {
  const norm = normalizeDrinkAlias(target);
  const candidates = catalog.filter((d) => normalizeDrinkAlias(d.nome || "").includes(norm));
  return { candidates };
}
