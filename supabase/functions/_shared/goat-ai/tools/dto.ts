/**
 * Semantic Tool Data Transfer Objects (DTOs) and Compacting for Goat AI
 * Prunes internal technical fields while preserving all business-critical information
 * for reasoning, synthesis, and accurate answers.
 */

export interface ToolCompactingResult {
  data: any;
  metrics: {
    rawBytes: number;
    compactedBytes: number;
    estimatedTokensSaved: number;
  };
}

// Estimate tokens roughly (1 token ~= 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function compactToolResultForAgent(toolName: string, rawData: any): ToolCompactingResult {
  if (!rawData || typeof rawData !== "object") {
    const json = JSON.stringify(rawData ?? {});
    return {
      data: rawData,
      metrics: {
        rawBytes: json.length,
        compactedBytes: json.length,
        estimatedTokensSaved: 0,
      },
    };
  }

  const rawJson = JSON.stringify(rawData);
  const rawBytes = rawJson.length;
  let compactedData: any = rawData;

  switch (toolName) {
    case "get_event_details": {
      if (rawData.event) {
        const ev = rawData.event;
        const budget = rawData.current_budget || {};
        compactedData = {
          event: {
            id: ev.id || ev.eventId,
            client_name: ev.client_name || ev.clientName,
            event_name: ev.event_name || ev.eventName,
            groom_name: ev.groom_name || ev.groomName,
            bride_name: ev.bride_name || ev.brideName,
            date: ev.date,
            event_time: ev.event_time || ev.eventTime,
            location: ev.event_location || ev.location,
            city: ev.city,
            guests: ev.guests ?? budget.guest_count,
            status: ev.status,
            current_budget_value:
              budget.final_budget_value ?? ev.current_budget_value ?? ev.currentBudgetValue,
            drinks: Array.isArray(ev.drinks)
              ? ev.drinks.map((d: any) =>
                  typeof d === "string"
                    ? { name: d }
                    : {
                        id: d.id,
                        name: d.name,
                        description: d.description,
                        category: d.category,
                      }
                )
              : ev.drinks,
            notes: ev.notes || undefined,
          },
          current_budget: {
            id: budget.id,
            version_number: budget.version_number,
            final_budget_value: budget.final_budget_value,
            average_value_per_person: budget.average_value_per_person,
            guest_count: budget.guest_count,
            drinks_per_person: budget.drinks_per_person,
            bartender_quantity: budget.bartender_quantity,
            bartender_unit_value: budget.bartender_unit_value,
            keeper_quantity: budget.keeper_quantity,
            keeper_unit_value: budget.keeper_unit_value,
            copeira_quantity: budget.copeira_quantity,
            copeira_unit_value: budget.copeira_unit_value,
            team_total_value: budget.team_total_value,
            beverages: Array.isArray(budget.beverages) ? budget.beverages : [],
            ice_packages_quantity: budget.ice_packages_quantity,
            ice_package_unit_value: budget.ice_package_unit_value,
            ice_total_value: budget.ice_total_value,
            fuel_value: budget.fuel_value,
            has_travel: budget.has_travel,
            miscellaneous_items: Array.isArray(budget.miscellaneous_items)
              ? budget.miscellaneous_items.slice(0, 20)
              : [],
            miscellaneous_total_value: budget.miscellaneous_total_value,
            paid_value: budget.paid_value,
            paid_percentage: budget.paid_percentage,
            pending_value: budget.pending_value,
            pending_percentage: budget.pending_percentage,
            profit_value: budget.profit_value,
            discount_value: budget.discount_value,
            payment_method: budget.payment_method,
          },
          latest_proposal: rawData.latest_proposal
            ? {
                id: rawData.latest_proposal.id,
                budget_id: rawData.latest_proposal.budget_id,
                status: rawData.latest_proposal.status,
                generated_at:
                  rawData.latest_proposal.generated_at ||
                  rawData.latest_proposal.created_at,
              }
            : null,
          contract: rawData.contract
            ? {
                id: rawData.contract.id,
                budget_version_id: rawData.contract.budget_version_id,
                status: rawData.contract.status,
                version: rawData.contract.version,
                generated_at: rawData.contract.generated_at,
                sent_for_signature_at: rawData.contract.sent_for_signature_at,
                fully_signed_at: rawData.contract.fully_signed_at,
                provider: rawData.contract.provider,
              }
            : null,
          contract_documents: Array.isArray(rawData.contract_documents)
            ? rawData.contract_documents.slice(0, 20).map((doc: any) => ({
                id: doc.id,
                contract_id: doc.contract_id,
                addendum_id: doc.addendum_id,
                document_type: doc.document_type,
                document_name: doc.document_name,
                original_filename: doc.original_filename,
                mime_type: doc.mime_type,
                file_size: doc.file_size,
                source: doc.source,
                is_signed: doc.is_signed,
                is_final: doc.is_final,
                archive_status: doc.archive_status,
                manual_signature_date: doc.manual_signature_date,
                signed_at: doc.signed_at,
                created_at: doc.created_at,
              }))
            : [],
          signature_request: rawData.signature_request
            ? {
                id: rawData.signature_request.id,
                signature_provider: rawData.signature_request.signature_provider,
                dispatch_status: rawData.signature_request.dispatch_status,
                internal_status: rawData.signature_request.internal_status,
                provider_status: rawData.signature_request.provider_status,
                sent_at: rawData.signature_request.sent_at,
                viewed_at: rawData.signature_request.viewed_at,
                signed_at: rawData.signature_request.signed_at,
                completed_at: rawData.signature_request.completed_at,
                last_synced_at: rawData.signature_request.last_synced_at,
                last_error: rawData.signature_request.last_error,
                document_kind: rawData.signature_request.document_kind,
              }
            : null,
          contract_client_data: rawData.contract_client_data || null,
          menu_settings: rawData.menu_settings
            ? {
                artwork_mode: rawData.menu_settings.artwork_mode,
                custom_label: rawData.menu_settings.custom_label,
                updated_at: rawData.menu_settings.updated_at,
              }
            : null,
          planning_items: Array.isArray(rawData.planning_items)
            ? rawData.planning_items.slice(0, 50).map((item: any) => ({
                item_name: item.item_name,
                category: item.category,
                planned_quantity: item.planned_quantity,
                unit: item.unit,
                estimated_unit_cost: item.estimated_unit_cost,
                estimated_total_cost: item.estimated_total_cost,
                origin: item.origin,
                notes: item.notes,
              }))
            : [],
          closing: rawData.closing
            ? {
                closing_date: rawData.closing.closing_date,
                revenue_amount: rawData.closing.revenue_amount,
                total_purchase_cost: rawData.closing.total_purchase_cost,
                total_team_cost: rawData.closing.total_team_cost,
                total_logistics_cost: rawData.closing.total_logistics_cost,
                total_consumed_cost: rawData.closing.total_consumed_cost,
                total_lost_cost: rawData.closing.total_lost_cost,
                total_event_cost: rawData.closing.total_event_cost,
                event_profit: rawData.closing.event_profit,
                event_margin: rawData.closing.event_margin,
                status: rawData.closing.status,
                general_notes: rawData.closing.general_notes,
                improvement_points: rawData.closing.improvement_points,
              }
            : null,
          closing_items: Array.isArray(rawData.closing_items)
            ? rawData.closing_items.slice(0, 50).map((item: any) => ({
                item_name: item.item_name,
                category: item.category,
                quantity_taken: item.quantity_taken,
                quantity_used: item.quantity_used,
                quantity_returned: item.quantity_returned,
                quantity_lost_or_broken: item.quantity_lost_or_broken,
                unit: item.unit,
                unit_cost: item.unit_cost,
                consumed_cost: item.consumed_cost,
                lost_cost: item.lost_cost,
                notes: item.notes,
              }))
            : [],
          source_coverage: rawData.source_coverage || {},
        };
      }
      break;
    }

    case "search_events":
    case "search_events_by_guest_count": {
      if (Array.isArray(rawData.events)) {
        compactedData = {
          events: rawData.events.slice(0, 15).map((ev: any) => ({
            id: ev.id || ev.eventId,
            client_name: ev.client_name || ev.clientName,
            event_name: ev.event_name || ev.eventName,
            groom_name: ev.groom_name || ev.groomName,
            bride_name: ev.bride_name || ev.brideName,
            date: ev.date,
            city: ev.city,
            guests: ev.guests,
            status: ev.status,
            current_budget_value: ev.current_budget_value || ev.currentBudgetValue,
          })),
        };
      }
      break;
    }

    case "get_drinks_catalog": {
      if (Array.isArray(rawData.drinks)) {
        compactedData = {
          drinks: rawData.drinks.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            category: d.category,
            alcoholic: d.alcoholic,
          })),
        };
      }
      break;
    }

    case "get_sales_sessions": {
      if (Array.isArray(rawData.sessions)) {
        compactedData = {
          sessions: rawData.sessions.slice(0, 10).map((s: any) => ({
            id: s.id,
            unit_name: s.unit_name || s.modality,
            start_date: s.start_date,
            total_revenue: s.total_revenue,
            net_result: s.net_result,
            status: s.status,
          })),
        };
      }
      break;
    }

    default:
      // Generic shallow pruning of obvious metadata / traces
      compactedData = sanitizeGenericObject(rawData);
      break;
  }

  const compactedJson = JSON.stringify(compactedData);
  const compactedBytes = compactedJson.length;
  const savedChars = Math.max(0, rawBytes - compactedBytes);
  const estimatedTokensSaved = estimateTokens(" ".repeat(savedChars));

  return {
    data: compactedData,
    metrics: {
      rawBytes,
      compactedBytes,
      estimatedTokensSaved,
    },
  };
}

function sanitizeGenericObject(obj: any, depth = 0): any {
  if (!obj || typeof obj !== "object" || depth > 4) return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map((item) => sanitizeGenericObject(item, depth + 1));
  }

  const pruned: Record<string, any> = {};
  const ignoredKeys = new Set([
    "raw_db_dump",
    "internal_audit_trace",
    "created_at",
    "updated_at",
    "deleted_at",
    "__typename",
  ]);

  for (const [key, value] of Object.entries(obj)) {
    if (ignoredKeys.has(key)) continue;
    if (typeof value === "string" && value.length > 2000) {
      pruned[key] = value.slice(0, 1000) + "... [truncated]";
    } else if (typeof value === "object" && value !== null) {
      pruned[key] = sanitizeGenericObject(value, depth + 1);
    } else {
      pruned[key] = value;
    }
  }

  return pruned;
}
