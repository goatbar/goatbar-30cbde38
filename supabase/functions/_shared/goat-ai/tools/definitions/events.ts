import { GoatAIToolDefinition, ToolContext, ToolExecutionResult } from "../../types.ts";
import {
  matchEventCandidates,
  matchContextualEventReference,
  extractMeaningfulWords,
  normalizeStr,
  DatabaseEvent,
} from "../../matchers/event-matcher.ts";
import { PIPELINE_CONFIRMED_STATUS } from "../../events/confirmed-events.ts";

type ResolvedEventDrink = {
  id?: string;
  name: string;
  description?: string;
  category?: string;
};

function extractDrinkRefs(value: any): Array<{ id?: string; name?: string }> {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item: any) => {
      if (typeof item === "string") return [{ id: item, name: item }];
      if (item && typeof item === "object") {
        const id = item.id || item.drink_id;
        const name = item.name || item.nome;
        return id || name ? [{ id, name }] : [];
      }
      return [];
    });
  }

  if (typeof value === "object") {
    if (Array.isArray(value.ids)) {
      return value.ids
        .filter((id: any) => typeof id === "string" && id.trim())
        .map((id: string) => ({ id: id.trim() }));
    }
    if (Array.isArray(value.items)) {
      return value.items.flatMap((item: any) => {
        const id = item?.id || item?.drink_id;
        const name = item?.name || item?.nome;
        return id || name ? [{ id, name }] : [];
      });
    }
  }

  return [];
}

async function resolveEventDrinks(
  ctx: ToolContext,
  eventDrinks: any,
  budgetSelectedDrinks: any,
): Promise<ResolvedEventDrink[]> {
  const eventRefs = extractDrinkRefs(eventDrinks);
  const budgetRefs = extractDrinkRefs(budgetSelectedDrinks);
  const refs = eventRefs.length > 0 ? eventRefs : budgetRefs;
  if (refs.length === 0) return [];

  const { data: catalog, error } = await ctx.supabaseAdmin
    .from("drinks")
    .select("id,nome,descricao,categoria");

  if (error) {
    return refs
      .map((ref) => ({
        id: ref.id,
        name: String(ref.name || ref.id || "").trim(),
      }))
      .filter((drink) => drink.name);
  }

  const byId = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const drink of catalog || []) {
    byId.set(String(drink.id), drink);
    byName.set(normalizeStr(drink.nome), drink);
  }

  const seen = new Set<string>();
  const resolved: ResolvedEventDrink[] = [];

  for (const ref of refs) {
    const match =
      (ref.id ? byId.get(String(ref.id)) : undefined) ||
      (ref.name ? byName.get(normalizeStr(ref.name)) : undefined);
    const name = String(match?.nome || ref.name || ref.id || "").trim();
    if (!name) continue;

    const key = String(match?.id || ref.id || normalizeStr(name));
    if (seen.has(key)) continue;
    seen.add(key);

    resolved.push({
      id: String(match?.id || ref.id || key),
      name,
      description: String(match?.descricao || "").trim() || undefined,
      category: String(match?.categoria || "").trim() || undefined,
    });
  }

  return resolved;
}

export const searchEventsTool: GoatAIToolDefinition = {
  name: "search_events",
  domain: "EVENTS",
  sourceTable: "events",
  description:
    "Busca eventos cadastrados no sistema Goat Bar por nome do cliente, noivos, título, status, local ou ID do evento.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Termo de busca (nome do cliente, noivos, título do evento, cidade ou 'confirmados').",
      },
      event_id: {
        type: "string",
        description: "ID (UUID) específico do evento se já conhecido.",
      },
      status: {
        type: "string",
        description:
          "Filtro opcional de status (ex: 'confirmado', 'finalizado', 'cancelado', 'em_negociacao').",
      },
      date: {
        type: "string",
        description: "Data exata opcional do evento no formato YYYY-MM-DD.",
      },
      limit: {
        type: "number",
        description:
          "Limite explícito de resultados. Quando omitido, listas por status retornam todos os registros.",
      },
    },
    required: [],
  },
  requiresConfirmation: false,
  execute: async (
    ctx: ToolContext,
    args: { query?: string; event_id?: string; status?: string; date?: string; limit?: number },
  ): Promise<ToolExecutionResult> => {
    const rawQuery = (args.query || "").trim();
    const explicitLimit =
      Number.isFinite(args.limit) && Number(args.limit) > 0
        ? Math.floor(Number(args.limit))
        : undefined;

    // 1. Direct ID lookup if event_id is provided or query is UUID
    const uuidMatch = (args.event_id || rawQuery).match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (uuidMatch) {
      const targetId = uuidMatch[0];
      const { data: eventById, error: idErr } = await ctx.supabaseAdmin
        .from("events")
        .select(
          "id, client_name, groom_name, bride_name, event_name, date, event_time, event_location, city, event_type, guests, status, current_budget_value, drinks",
        )
        .eq("id", targetId)
        .maybeSingle();

      if (!idErr && eventById) {
        const { data: budget } = await ctx.supabaseAdmin
          .from("event_budget_versions")
          .select("selected_drinks,final_budget_value,average_value_per_person,guest_count")
          .eq("event_id", targetId)
          .eq("is_current", true)
          .maybeSingle();

        const drinksList = await resolveEventDrinks(
          ctx,
          eventById.drinks,
          budget?.selected_drinks,
        );

        const enrichedEvent = {
          ...eventById,
          current_budget_value:
            budget?.final_budget_value ?? eventById.current_budget_value ?? null,
          drinks: drinksList,
          match_confidence: 1.0,
          match_reason: "Busca por ID direto",
        };
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
      .select(
        "id, client_name, groom_name, bride_name, event_name, date, event_time, event_location, city, event_type, guests, status, current_budget_value, drinks",
      )
      .order("date", { ascending: true });

    const isStatusOnlyQuery =
      rawQuery.toLowerCase() === "confirmado" ||
      rawQuery.toLowerCase() === "confirmados" ||
      rawQuery.toLowerCase() === "novo_orcamento" ||
      rawQuery.toLowerCase() === "finalizado" ||
      rawQuery.toLowerCase() === "cancelado" ||
      rawQuery.toLowerCase() === "todos" ||
      rawQuery === "";

    const requestedDate = (args.date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      queryBuilder = queryBuilder.eq("date", requestedDate);
    }

    const requestedStatus = (args.status || "").trim().toLowerCase();
    const isConfirmedStatus =
      requestedStatus === "confirmed" || requestedStatus.startsWith("confirmad");
    if (isConfirmedStatus) {
      // Same canonical predicate as Pipeline -> Confirmados. Do not use a
      // substring match (which can include non-canonical/legacy statuses).
      queryBuilder = queryBuilder.ilike("status", PIPELINE_CONFIRMED_STATUS);
    } else if (args.status) {
      queryBuilder = queryBuilder.ilike("status", args.status.trim());
    } else if (
      isStatusOnlyQuery &&
      (rawQuery.toLowerCase().includes("confirmad") || rawQuery === "confirmados")
    ) {
      queryBuilder = queryBuilder.ilike("status", PIPELINE_CONFIRMED_STATUS);
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
      return {
        success: true,
        data: { count: 0, events: [] },
        message: "Nenhum evento encontrado.",
      };
    }

    // If query was just a list/status request (e.g. "quantos eventos temos confirmados"), return list directly
    if (isStatusOnlyQuery) {
      const limited = explicitLimit ? eventList.slice(0, explicitLimit) : eventList;
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

    const matchedList = candidates.slice(0, explicitLimit || 15).map((c) => {
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
  sourceTable: "events,event_budget_versions,generated_proposals,event_contracts,contract_documents,contract_signature_requests,event_contract_client_data,event_menu_settings,event_planning_items,event_closings,event_closing_items",
  description:
    "Investiga o contexto completo de um evento no sistema. Cruza cadastro, orçamento, proposta, contrato, documentos contratuais arquivados/assinados, assinatura, coleta de dados, cardápio, planejamento e fechamento. Use esta ferramenta antes de concluir que uma informação ou documento do evento não existe.",
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

    // Investigação ampla: o objetivo desta ferramenta é reproduzir a visão
    // factual do sistema, sem depender de uma única tela/tabela.
    const [
      budgetResult,
      proposalResult,
      contractResult,
      contractDocumentsResult,
      signatureResult,
      contractDataResult,
      menuSettingsResult,
      planningResult,
      closingResult,
      closingItemsResult,
    ] = await Promise.all([
      ctx.supabaseAdmin
        .from("event_budget_versions")
        .select("*")
        .eq("event_id", args.event_id)
        .eq("is_current", true)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("generated_proposals")
        .select("id,event_id,budget_id,template_id,status,generated_at,created_at,updated_at,storage_path,final_pdf_url")
        .eq("event_id", args.event_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("event_contracts")
        .select("id,event_id,budget_version_id,status,version,generated_at,sent_for_signature_at,fully_signed_at,created_at,updated_at,generated_file_path,signed_file_path,provider,provider_document_id")
        .eq("event_id", args.event_id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("contract_documents")
        .select("id,contract_id,addendum_id,document_type,document_name,original_filename,mime_type,file_size,source,is_signed,is_final,archive_status,manual_signature_date,signed_at,created_at")
        .eq("event_id", args.event_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      ctx.supabaseAdmin
        .from("contract_signature_requests")
        .select("id,event_id,contract_id,signature_provider,dispatch_status,internal_status,provider_status,sent_at,viewed_at,signed_at,completed_at,cancelled_at,expires_at,last_synced_at,last_error,document_kind")
        .eq("event_id", args.event_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("event_contract_client_data")
        .select("id,event_id,client_name,email,address,submitted_at,token_expires_at,updated_at,cpf_cnpj,phone,legal_representative_name,legal_representative_cpf")
        .eq("event_id", args.event_id)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("event_menu_settings")
        .select("event_id,artwork_mode,artwork_url,custom_label,created_at,updated_at")
        .eq("event_id", args.event_id)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("event_planning_items")
        .select("id,item_name,category,planned_quantity,unit,estimated_unit_cost,estimated_total_cost,origin,notes,updated_at")
        .eq("event_id", args.event_id)
        .order("created_at", { ascending: true })
        .limit(100),
      ctx.supabaseAdmin
        .from("event_closings")
        .select("id,event_id,closing_date,revenue_amount,total_purchase_cost,total_team_cost,total_logistics_cost,total_consumed_cost,total_lost_cost,total_event_cost,event_profit,event_margin,general_notes,improvement_points,status,updated_at")
        .eq("event_id", args.event_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabaseAdmin
        .from("event_closing_items")
        .select("id,item_name,category,quantity_taken,quantity_used,quantity_returned,quantity_lost_or_broken,unit,unit_cost,consumed_cost,lost_cost,notes,updated_at")
        .eq("event_id", args.event_id)
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    const budget = budgetResult.data || null;
    const latestProposal = proposalResult.data || null;
    const latestContract = contractResult.data || null;
    const contractDocuments = contractDocumentsResult.data || [];
    const latestSignatureRequest = signatureResult.data || null;
    const contractData = contractDataResult.data || null;
    const menuSettings = menuSettingsResult.data || null;
    const planningItems = planningResult.data || [];
    const closing = closingResult.data || null;
    const closingItems = closingItemsResult.data || [];

    const drinksList = await resolveEventDrinks(
      ctx,
      event.drinks,
      budget?.selected_drinks,
    );

    const detailedEvent = {
      ...event,
      current_budget_value:
        budget?.final_budget_value ?? event.current_budget_value ?? null,
      drinks: drinksList,
    };

    // Dados sensíveis não precisam ser enviados integralmente ao modelo para
    // responder perguntas comuns. Expomos presença/completude em vez de CPF.
    const contractDataSummary = contractData
      ? {
          id: contractData.id,
          client_name: contractData.client_name,
          email: contractData.email || null,
          address: contractData.address || null,
          submitted_at: contractData.submitted_at || null,
          token_expires_at: contractData.token_expires_at || null,
          updated_at: contractData.updated_at || null,
          has_document: Boolean(contractData.cpf_cnpj),
          has_phone: Boolean(contractData.phone),
          has_legal_representative: Boolean(
            contractData.legal_representative_name ||
              contractData.legal_representative_cpf,
          ),
        }
      : null;

    const sourceCoverage = {
      event: { checked: true, found: true },
      current_budget: {
        checked: true,
        found: Boolean(budget),
        error: budgetResult.error?.message || null,
      },
      latest_proposal: {
        checked: true,
        found: Boolean(latestProposal),
        error: proposalResult.error?.message || null,
      },
      contract: {
        checked: true,
        found: Boolean(latestContract),
        error: contractResult.error?.message || null,
      },
      contract_documents: {
        checked: true,
        found: contractDocuments.length > 0,
        count: contractDocuments.length,
        signed_final_count: contractDocuments.filter(
          (doc: any) => doc.is_signed && doc.is_final,
        ).length,
        error: contractDocumentsResult.error?.message || null,
      },
      signature_request: {
        checked: true,
        found: Boolean(latestSignatureRequest),
        error: signatureResult.error?.message || null,
      },
      contract_client_data: {
        checked: true,
        found: Boolean(contractData),
        error: contractDataResult.error?.message || null,
      },
      menu_settings: {
        checked: true,
        found: Boolean(menuSettings),
        error: menuSettingsResult.error?.message || null,
      },
      planning_items: {
        checked: true,
        found: planningItems.length > 0,
        count: planningItems.length,
        error: planningResult.error?.message || null,
      },
      closing: {
        checked: true,
        found: Boolean(closing),
        error: closingResult.error?.message || null,
      },
      closing_items: {
        checked: true,
        found: closingItems.length > 0,
        count: closingItems.length,
        error: closingItemsResult.error?.message || null,
      },
    };

    return {
      success: true,
      data: {
        event: detailedEvent,
        current_budget: budget,
        drinks: drinksList,
        latest_proposal: latestProposal,
        contract: latestContract,
        contract_documents: contractDocuments,
        signature_request: latestSignatureRequest,
        contract_client_data: contractDataSummary,
        menu_settings: menuSettings,
        planning_items: planningItems,
        closing,
        closing_items: closingItems,
        source_coverage: sourceCoverage,
      },
      message:
        `Contexto completo do evento ${event.event_name || event.client_name} investigado em ` +
        `${Object.keys(sourceCoverage).length} fontes do sistema.`,
    };
  },
};

export const searchEventsByGuestCountTool: GoatAIToolDefinition = {
  name: "search_events_by_guest_count",
  domain: "EVENTS",
  sourceTable: "events",
  description:
    "Filtra eventos com base na quantidade de convidados (ex: eventos de aproximadamente 100 pessoas).",
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
  execute: async (
    ctx: ToolContext,
    args: { target_guests?: number; min_guests?: number; max_guests?: number; limit?: number },
  ): Promise<ToolExecutionResult> => {
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
      return {
        success: false,
        error: `Erro ao consultar eventos por convidados: ${error.message}`,
      };
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
  description:
    "Calcula estatísticas reais de consumo (gelo, insumos, bebidas) para um grupo de eventos (médias, medianas, totais).",
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
  execute: async (
    ctx: ToolContext,
    args: { target_guests?: number; min_guests?: number; max_guests?: number; item_type?: string },
  ): Promise<ToolExecutionResult> => {
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
      .select(
        "event_id, ice_packages_quantity, ice_package_unit_value, bartender_quantity, drinks_per_person",
      )
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

    const avg = (arr: number[]) =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
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
