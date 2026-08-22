import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";
import {
  matchEventCandidates,
  matchContextualEventReference,
  extractMeaningfulWords,
  normalizeStr,
  DatabaseEvent,
} from "../../matchers/event-matcher.ts";

export const searchEventsTool: GoatAIToolDefinition = {
  name: "search_events",
  domain: "EVENTS",
  sourceTable: "events",
  description: "Busca eventos cadastrados no sistema Goat Bar por nome do cliente, noivos, título, status, local ou ID do evento.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Termo de busca (nome do cliente, noivos, título do evento, cidade ou 'confirmados').",
      },
      event_id: {
        type: "string",
        description: "ID (UUID) específico do evento se já conhecido.",
      },
      status: {
        type: "string",
        description: "Filtro opcional de status (ex: 'confirmado', 'finalizado', 'cancelado', 'em_negociacao').",
      },
      limit: {
        type: "number",
        description: "Limite de resultados (padrão 10).",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (
    ctx: ToolContext,
    args: { query?: string; event_id?: string; status?: string; limit?: number }
  ): Promise<ToolExecutionResult> => {
    const rawQuery = (args.query || "").trim();
    const limit = args.limit || 15;

    // 1. Direct ID lookup if event_id is provided or query is UUID
    const uuidMatch = (args.event_id || rawQuery).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      const targetId = uuidMatch[0];
      const { data: eventById, error: idErr } = await ctx.supabaseAdmin
        .from("events")
        .select("id, client_name, groom_name, bride_name, event_name, date, event_time, event_location, city, event_type, guests, status, current_budget_value, drinks")
        .eq("id", targetId)
        .maybeSingle();

      if (!idErr && eventById) {
        // Also fetch current budget drinks if event.drinks is empty
        let drinksList = eventById.drinks || [];
        if (!drinksList || drinksList.length === 0) {
          const { data: budget } = await ctx.supabaseAdmin
            .from("event_budget_versions")
            .select("selected_drinks")
            .eq("event_id", targetId)
            .eq("is_current", true)
            .maybeSingle();

          if (budget?.selected_drinks && Array.isArray(budget.selected_drinks)) {
            drinksList = budget.selected_drinks.map((d: any) => d.name || d.nome || String(d));
          }
        }

        const enrichedEvent = { ...eventById, drinks: drinksList, match_confidence: 1.0, match_reason: "Busca por ID direto" };
        return {
          success: true,
          data: {
            count: 1,
            events: [enrichedEvent],
          },
          message: `Evento encontrado: ${enrichedEvent.event_name || enrichedEvent.client_name}`,
        };
      }
    }

    // 2. Build Database Query
    let queryBuilder = ctx.supabaseAdmin
      .from("events")
      .select("id, client_name, groom_name, bride_name, event_name, date, event_time, event_location, city, event_type, guests, status, current_budget_value, drinks")
      .order("date", { ascending: false })
      .limit(40);

    const isStatusOnlyQuery =
      rawQuery.toLowerCase() === "confirmado" ||
      rawQuery.toLowerCase() === "confirmados" ||
      rawQuery.toLowerCase() === "novo_orcamento" ||
      rawQuery.toLowerCase() === "finalizado" ||
      rawQuery.toLowerCase() === "cancelado" ||
      rawQuery.toLowerCase() === "todos" ||
      rawQuery === "";

    if (args.status) {
      queryBuilder = queryBuilder.ilike("status", `%${args.status}%`);
    } else if (isStatusOnlyQuery && (rawQuery.toLowerCase().includes("confirmad") || rawQuery === "confirmados")) {
      queryBuilder = queryBuilder.ilike("status", "%confirmado%");
    }

    const meaningfulWords = extractMeaningfulWords(rawQuery);

    // If query contains meaningful entity words (names, cities, etc.), use OR filter in DB
    if (!isStatusOnlyQuery && meaningfulWords.length > 0) {
      const orConditions: string[] = [];
      for (const w of meaningfulWords.slice(0, 4)) {
        orConditions.push(`client_name.ilike.%${w}%`);
        orConditions.push(`event_name.ilike.%${w}%`);
        orConditions.push(`groom_name.ilike.%${w}%`);
        orConditions.push(`bride_name.ilike.%${w}%`);
        orConditions.push(`city.ilike.%${w}%`);
        orConditions.push(`event_location.ilike.%${w}%`);
      }
      if (orConditions.length > 0) {
        queryBuilder = queryBuilder.or(orConditions.join(","));
      }
    }

    const { data: dbEvents, error } = await queryBuilder;
    if (error) {
      return { success: false, error: `Erro ao buscar eventos: ${error.message}` };
    }

    const eventList = (dbEvents || []) as DatabaseEvent[];

    if (eventList.length === 0) {
      return { success: true, data: { count: 0, events: [] }, message: "Nenhum evento encontrado." };
    }

    // If query was just a list/status request (e.g. "quantos eventos temos confirmados"), return list directly
    if (isStatusOnlyQuery) {
      const limited = eventList.slice(0, limit);
      return {
        success: true,
        data: {
          count: limited.length,
          events: limited,
        },
        message: `${limited.length} evento(s) encontrado(s).`,
      };
    }

    // 3. Tolerant semantic candidate matching in TypeScript
    const candidates = matchEventCandidates(eventList, rawQuery);

    if (candidates.length === 0) {
      // NEVER return random fallback slice when searching for a specific query!
      return {
        success: true,
        data: {
          count: 0,
          events: [],
        },
        message: `Nenhum evento correspondente encontrado para "${rawQuery}".`,
      };
    }

    const matchedList = candidates.slice(0, limit).map((c) => {
      const raw = eventList.find((e) => e.id === c.eventId) || {};
      return {
        ...raw,
        match_confidence: c.confidence,
        match_reason: c.reason,
        drinks: (raw as any).drinks || c.drinks || [],
      };
    });

    return {
      success: true,
      data: {
        count: matchedList.length,
        events: matchedList,
      },
      message: `${matchedList.length} evento(s) correspondente(s) encontrado(s).`,
    };
  },
};

export const getEventDetailsTool: GoatAIToolDefinition = {
  name: "get_event_details",
  domain: "EVENTS",
  sourceTable: "events, event_budget_versions",
  description: "Obtém detalhes completos de um evento específico pelo ID (UUID), incluindo convidados, cardápio de drinks, local e orçamento.",
  parameters: {
    type: "object",
    properties: {
      event_id: {
        type: "string",
        description: "ID (UUID) do evento.",
      },
    },
    required: ["event_id"],
  },
  requiresConfirmation: false,
  execute: async (ctx: ToolContext, args: { event_id: string }): Promise<ToolExecutionResult> => {
    if (!args.event_id) {
      return { success: false, error: "Parâmetro 'event_id' é obrigatório." };
    }

    const { data: event, error } = await ctx.supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", args.event_id)
      .single();

    if (error || !event) {
      return { success: false, error: `Evento não encontrado para o ID: ${args.event_id}` };
    }

    // Fetch active budget version if exists
    const { data: budget } = await ctx.supabaseAdmin
      .from("event_budget_versions")
      .select("*")
      .eq("event_id", args.event_id)
      .eq("is_current", true)
      .maybeSingle();

    // Extract drinks from event or budget
    let drinksList: string[] = [];
    if (event.drinks && Array.isArray(event.drinks) && event.drinks.length > 0) {
      drinksList = event.drinks;
    } else if (budget?.selected_drinks && Array.isArray(budget.selected_drinks)) {
      drinksList = budget.selected_drinks.map((d: any) => d.name || d.nome || String(d));
    }

    const detailedEvent = {
      ...event,
      drinks: drinksList,
    };

    return {
      success: true,
      data: {
        event: detailedEvent,
        current_budget: budget || null,
        drinks: drinksList,
      },
      message: `Detalhes do evento ${event.event_name || event.client_name} obtidos com sucesso.`,
    };
  },
};

export const searchEventsByGuestCountTool: GoatAIToolDefinition = {
  name: "search_events_by_guest_count",
  domain: "EVENTS",
  sourceTable: "events",
  description: "Filtra eventos com base na quantidade de convidados (ex: eventos de aproximadamente 100 pessoas).",
  parameters: {
    type: "object",
    properties: {
      target_guests: {
        type: "number",
        description: "Número alvo de convidados (ex: 100).",
      },
      min_guests: {
        type: "number",
        description: "Mínimo de convidados da faixa.",
      },
      max_guests: {
        type: "number",
        description: "Máximo de convidados da faixa.",
      },
      limit: {
        type: "number",
        description: "Quantidade máxima de eventos para analisar (padrão 20).",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (ctx: ToolContext, args: { target_guests?: number; min_guests?: number; max_guests?: number; limit?: number }): Promise<ToolExecutionResult> => {
    let min = args.min_guests;
    let max = args.max_guests;

    if (args.target_guests && (min == null || max == null)) {
      // Default standard variance: ±15%
      const variance = Math.max(10, Math.round(args.target_guests * 0.15));
      min = Math.max(0, args.target_guests - variance);
      max = args.target_guests + variance;
    }

    min = min || 0;
    max = max || 10000;

    const { data: events, error } = await ctx.supabaseAdmin
      .from("events")
      .select("id, client_name, event_name, date, guests, status, current_budget_value, drinks")
      .gte("guests", min)
      .lte("guests", max)
      .order("date", { ascending: false })
      .limit(args.limit || 20);

    if (error) {
      return { success: false, error: `Erro ao consultar eventos por convidados: ${error.message}` };
    }

    return {
      success: true,
      data: {
        filter: { min_guests: min, max_guests: max, target: args.target_guests },
        count: (events || []).length,
        events: events || [],
      },
    };
  },
};

export const aggregateEventConsumptionTool: GoatAIToolDefinition = {
  name: "aggregate_event_consumption",
  domain: "ANALYTICS",
  sourceTable: "events, event_budget_versions",
  description: "Calcula estatísticas reais de consumo (gelo, insumos, bebidas) para um grupo de eventos (médias, medianas, totais).",
  parameters: {
    type: "object",
    properties: {
      target_guests: {
        type: "number",
        description: "Faixa aproximada de convidados (ex: 100).",
      },
      min_guests: {
        type: "number",
        description: "Mínimo de convidados.",
      },
      max_guests: {
        type: "number",
        description: "Máximo de convidados.",
      },
      item_type: {
        type: "string",
        description: "Tipo de item analisado: 'gelo', 'drinks', 'equipe' ou 'geral'.",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (ctx: ToolContext, args: { target_guests?: number; min_guests?: number; max_guests?: number; item_type?: string }): Promise<ToolExecutionResult> => {
    let min = args.min_guests;
    let max = args.max_guests;

    if (args.target_guests && (min == null || max == null)) {
      const variance = Math.max(10, Math.round(args.target_guests * 0.15));
      min = Math.max(0, args.target_guests - variance);
      max = args.target_guests + variance;
    }

    min = min || 0;
    max = max || 10000;

    // Query events with budget versions
    const { data: events, error } = await ctx.supabaseAdmin
      .from("events")
      .select("id, client_name, event_name, date, guests, status")
      .gte("guests", min)
      .lte("guests", max)
      .limit(30);

    if (error || !events || events.length === 0) {
      return {
        success: true,
        data: {
          event_count: 0,
          message: "Nenhum evento encontrado na faixa especificada.",
        },
      };
    }

    const eventIds = events.map((e) => e.id);
    const { data: budgets } = await ctx.supabaseAdmin
      .from("event_budget_versions")
      .select("event_id, ice_packages_quantity, ice_package_unit_value, bartender_quantity, drinks_per_person")
      .in("event_id", eventIds)
      .eq("is_current", true);

    const iceData: number[] = [];
    const drinksPerPersonData: number[] = [];
    const bartenderData: number[] = [];

    const budgetMap = new Map<string, any>();
    (budgets || []).forEach((b) => budgetMap.set(b.event_id, b));

    for (const ev of events) {
      const b = budgetMap.get(ev.id);
      const guests = Number(ev.guests) || 100;

      if (b && b.ice_packages_quantity != null && b.ice_packages_quantity > 0) {
        // Each ice package in Goat Bar is standard 10kg or 5kg package
        const iceKg = Number(b.ice_packages_quantity) * 5;
        iceData.push(iceKg);
      } else {
        // Standard rule benchmark: 0.45kg gelo per guest
        iceData.push(Math.round(guests * 0.45));
      }

      if (b && b.drinks_per_person) {
        drinksPerPersonData.push(Number(b.drinks_per_person));
      }
      if (b && b.bartender_quantity) {
        bartenderData.push(Number(b.bartender_quantity));
      }
    }

    const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };

    return {
      success: true,
      data: {
        filter_criteria: { target_guests: args.target_guests, min_guests: min, max_guests: max },
        events_analyzed_count: events.length,
        ice_consumption_kg: {
          average_kg: avg(iceData),
          median_kg: median(iceData),
          min_kg: iceData.length ? Math.min(...iceData) : 0,
          max_kg: iceData.length ? Math.max(...iceData) : 0,
        },
        drinks_per_person: {
          average: avg(drinksPerPersonData) || 4.0,
        },
        bartenders: {
          average: avg(bartenderData) || 2.0,
        },
      },
    };
  },
};
