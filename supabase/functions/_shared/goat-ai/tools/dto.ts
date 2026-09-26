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
