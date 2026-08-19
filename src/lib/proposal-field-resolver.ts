import type { BudgetVersion, Event } from "@/services/event-budget-service";

export interface ProposalFieldContext {
  event: Event & { duration_hours?: number | null };
  budget: BudgetVersion;
}

export type ProposalFieldValue = string | number | string[] | null;

function selectedDrinkNames(selectedDrinks: unknown): string[] {
  if (!Array.isArray(selectedDrinks)) return [];
  return selectedDrinks
    .map((drink) => {
      if (typeof drink === "string") return drink;
      if (!drink || typeof drink !== "object") return null;
      const item = drink as Record<string, unknown>;
      const name = item.nome ?? item.name;
      return typeof name === "string" ? name : null;
    })
    .filter((name): name is string => Boolean(name));
}

export function resolveCoupleInitials(clientName: string | null | undefined): string | null {
  if (!clientName?.trim()) return null;
  const names = clientName.trim().split(/\s+(?:&|e)\s+|\s*\/\s*/i).filter(Boolean);
  if (names.length !== 2) return null;
  const initials = names.map((name) => Array.from(name.trim())[0]?.toLocaleUpperCase("pt-BR"));
  return initials.every(Boolean) ? `${initials[0]} | ${initials[1]}` : null;
}

export function subtractUtcDays(date: string | null | undefined, days: number): string | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(value.getTime())) return null;
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

/** Resolve somente dados brutos; apresentação deve ser feita por formatProposalFieldValue. */
export function resolveProposalField(
  sourceFieldKey: string,
  { event, budget }: ProposalFieldContext
): ProposalFieldValue {
  switch (sourceFieldKey) {
    case "event.event_name": return event.event_name || event.event_type || null;
    case "event.event_date": return event.date || null;
    case "event.guest_count": return event.guests;
    case "event.duration_hours": return event.duration_hours ?? null;
    case "budget.created_at": return budget.created_at || null;
    case "budget.total_drinks": return event.guests * budget.drinks_per_person;
    case "budget.total_value": return budget.final_budget_value;
    case "package.drinks_list": return selectedDrinkNames(budget.selected_drinks);
    case "budget.bartenders_count": return budget.bartender_quantity;
    case "budget.copeiras_count": return budget.copeira_quantity;
    case "budget.bar_keepers_count": return budget.keeper_quantity;
    case "computed.couple_initials": return resolveCoupleInitials(event.client_name);
    case "computed.final_payment_date": return subtractUtcDays(event.date, 7);
    default: return null;
  }
}

export function formatProposalFieldValue(value: ProposalFieldValue, formatter = "raw"): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (formatter === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  if (formatter === "integer" && typeof value === "number") return Math.round(value).toString();
  if (formatter === "date_short" && typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
  if (formatter === "uppercase") return String(value).toLocaleUpperCase("pt-BR");
  if (formatter === "lowercase") return String(value).toLocaleLowerCase("pt-BR");
  return String(value);
}
