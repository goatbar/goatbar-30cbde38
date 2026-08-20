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

export function formatDateDot(value: unknown): string {
  if (!value || typeof value !== "string") return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.slice(0, 10));
  if (!match) return String(value);
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

export function formatBulletList(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
      .filter(Boolean)
      .map((item) => (item.startsWith("•") ? item : `• ${item}`))
      .join("\n");
  }
  return String(value);
}

export function formatCurrency(value: unknown): string {
  if (value == null) return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function formatProposalFieldValue(value: ProposalFieldValue, formatter = "raw"): string {
  if (value == null) return "";
  if (formatter === "bullet_list" || formatter === "canva_bullet_list") {
    return formatBulletList(value);
  }
  if (Array.isArray(value)) return value.join(", ");
  if (formatter === "currency" && typeof value === "number")
    return formatCurrency(value);
  if (formatter === "integer" && typeof value === "number") return Math.round(value).toString();
  if ((formatter === "date_canva" || formatter === "date_dot") && typeof value === "string") {
    return formatDateDot(value);
  }
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

export const CANVA_PROPOSAL_PRESENTERS: Record<
  string,
  (value: ProposalFieldValue, formatter?: string) => string
> = {
  DATA_ORCAMENTO: (v) => formatDateDot(v),
  DATA_EVENTO: (v) => formatDateDot(v),
  DATA_FINAL_PAGAMENTO: (v) => {
    const dateStr = formatDateDot(v);
    if (!dateStr) return "";
    return `Formas de pagamento:\n\n• 30% na assinatura do contrato -\n  Restante até dia ${dateStr}\n• 5% de desconto para pagamento à vista\n• Parcelamento no cartão ou boleto (a consultar)`;
  },
  QUANTIDADE_PESSOAS: (v) => {
    const n = parseNumericValue(v);
    if (n === null) return "";
    const label = n === 1 ? "1 pessoa" : `${n} pessoas`;
    return `Preparamos uma proposta especial para você:\nNúmero de convidados: ${label}`;
  },
  QUANTIDADE_HORAS_EVENTO: (v) => {
    const n = parseNumericValue(v);
    if (n === null) return "";
    const label = n === 1 ? "1 hora" : `${n} horas`;
    return `Serviço de bar completo durante ${label} de festa`;
  },
  QTD_BARTENDERS: (v) => {
    const n = parseNumericValue(v);
    if (n === null) return "";
    return n === 1 ? "1 Bartender" : `${n} Bartenders`;
  },
  QTD_BAR_KEEPERS: (v) => {
    const n = parseNumericValue(v);
    if (n === null) return "";
    return n === 1 ? "1 Bar Keeper" : `${n} Bar Keepers`;
  },
  QTD_COPEIRAS: (v) => {
    const n = parseNumericValue(v);
    if (n === null) return "";
    return n === 1 ? "1 Copeira" : `${n} Copeiras`;
  },
  QUANTIDADE_DRINKS: (v) => {
    const n = parseNumericValue(v);
    if (n === null) return "";
    return n === 1 ? "Previsão de 1 drink durante o evento" : `Previsão de ${n} drinks durante o evento`;
  },
  DRINKS: (v) => formatBulletList(v),
  BEBIDAS: (v) => formatBulletList(v),
  VALOR_INVESTIMENTO: (v) => {
    const formatted = formatCurrency(v);
    return formatted ? `Investimento:\n${formatted}` : "";
  },
  INO: (v) => (v == null ? "" : String(v)),
  INA: (v) => (v == null ? "" : String(v)),
  NOME_EVENTO: (v) => (v == null ? "" : String(v)),
};

export function formatCanvaProposalField(
  canvaKey: string,
  value: ProposalFieldValue,
  formatter = "raw",
): string {
  if (value == null) return "";
  const presenter = CANVA_PROPOSAL_PRESENTERS[canvaKey];
  if (presenter) {
    return presenter(value, formatter);
  }
  return formatProposalFieldValue(value, formatter);
}
