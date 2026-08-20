export interface ProposalFieldContext {
  event: Record<string, any>;
  budget: Record<string, any>;
  hydratedData?: { selectedDrinkNames?: string[] };
}

export type ProposalFieldValue = string | number | string[] | null;

export const LEGACY_SOURCE_ALIASES = {
  "event.event_date": "event.date",
  "event.guest_count": "event.guests",
  "computed.proposal_date": "budget.created_at",
  "budget.total_drinks": "computed.total_drinks",
  "package.drinks_count": "computed.total_drinks",
  "package.total_drinks": "computed.total_drinks",
  "budget.quantity_drinks": "computed.total_drinks",
  "budget.drinks_count": "computed.total_drinks",
  "budget.total_value": "budget.final_budget_value",
  "package.drinks_list": "budget.selected_drinks",
  "budget.bartenders_count": "budget.bartender_quantity",
  "budget.copeiras_count": "budget.copeira_quantity",
  "budget.bar_keepers_count": "budget.keeper_quantity",
} as const;

export type ProposalSourceKey =
  | "event.event_name"
  | "budget.created_at"
  | "event.date"
  | "computed.groom_initial"
  | "computed.bride_initial"
  | "event.guests"
  | "budget.selected_drinks"
  | "budget.beverages"
  | "budget.bartender_quantity"
  | "budget.copeira_quantity"
  | "budget.keeper_quantity"
  | "computed.total_drinks"
  | "budget.final_budget_value"
  | "computed.final_payment_date"
  | "event.duration_hours";

export function canonicalizeProposalSourceKey(key: string): string {
  return (LEGACY_SOURCE_ALIASES as Record<string, string>)[key] ?? key;
}

export function resolveExplicitInitial(name: string | null | undefined): string | null {
  const normalized = name?.trim();
  return normalized ? Array.from(normalized)[0]?.toLocaleUpperCase("pt-BR") || null : null;
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

function parseNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];

export const PROPOSAL_FIELD_RESOLVERS: Record<
  ProposalSourceKey,
  (context: ProposalFieldContext) => ProposalFieldValue
> = {
  "event.event_name": ({ event }) => event.event_name || event.event_type || null,
  "budget.created_at": ({ budget }) => budget.created_at || null,
  "event.date": ({ event }) => event.date || null,
  "computed.groom_initial": ({ event }) => resolveExplicitInitial(event.groom_name),
  "computed.bride_initial": ({ event }) => resolveExplicitInitial(event.bride_name),
  "event.guests": ({ event }) => event.guests ?? null,
  "budget.selected_drinks": ({ hydratedData, budget }) =>
    list(hydratedData?.selectedDrinkNames ?? budget?.selected_drinks ?? budget?.selectedDrinkNames),
  "budget.beverages": ({ budget }) => list(budget.beverages),
  "budget.bartender_quantity": ({ budget }) => budget.bartender_quantity ?? null,
  "budget.copeira_quantity": ({ budget }) => budget.copeira_quantity ?? null,
  "budget.keeper_quantity": ({ budget }) => budget.keeper_quantity ?? null,
  "computed.total_drinks": ({ event, budget }) => {
    const guests = parseNumericValue(event?.guests);
    const perPerson = parseNumericValue(budget?.drinks_per_person);
    return guests !== null && perPerson !== null ? guests * perPerson : null;
  },
  "budget.final_budget_value": ({ budget }) => budget.final_budget_value ?? null,
  "computed.final_payment_date": ({ event }) => subtractUtcDays(event.date, 7),
  "event.duration_hours": ({ event }) => event.duration_hours ?? null,
};

export function hasProposalFieldResolver(key: string): boolean {
  return canonicalizeProposalSourceKey(key) in PROPOSAL_FIELD_RESOLVERS;
}

/** Pure resolution: all database hydration must already be present in context. */
export function resolveProposalField(
  key: string,
  context: ProposalFieldContext,
): ProposalFieldValue {
  if (key === "computed.couple_initials") {
    const value = context.event.client_name?.trim();
    if (!value) return null;
    const names = value.split(/\s+(?:&|e)\s+|\s*\/\s*/i).filter(Boolean);
    return names.length === 2
      ? `${resolveExplicitInitial(names[0])} | ${resolveExplicitInitial(names[1])}`
      : null;
  }
  const canonical = canonicalizeProposalSourceKey(key) as ProposalSourceKey;
  return PROPOSAL_FIELD_RESOLVERS[canonical]?.(context) ?? null;
}

export function formatProposalFieldValue(value: ProposalFieldValue, formatter = "raw"): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (formatter === "currency" && typeof value === "number")
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  if (formatter === "integer" && typeof value === "number") return Math.round(value).toString();
  if ((formatter === "date_short" || formatter === "date_long") && typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-");
    if (formatter === "date_short") return year && month && day ? `${day}/${month}/${year}` : value;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("pt-BR", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(date);
  }
  if (formatter === "uppercase") return String(value).toLocaleUpperCase("pt-BR");
  if (formatter === "lowercase") return String(value).toLocaleLowerCase("pt-BR");
  return String(value);
}
