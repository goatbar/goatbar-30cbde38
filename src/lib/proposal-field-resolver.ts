import {
  getBudgetVersionEventContext,
  getBudgetVersionGuestCount,
} from "./budget-version-snapshot";

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
  "package.drinks_count": "computed.total_drink_varieties",
  "package.total_drinks": "computed.total_drink_varieties",
  "budget.quantity_drinks": "computed.total_drink_varieties",
  "budget.drinks_count": "computed.total_drink_varieties",
  "budget.total_drink_varieties": "computed.total_drink_varieties",
  "package.total_drink_varieties": "computed.total_drink_varieties",
  "budget.variedades_drinks": "computed.total_drink_varieties",
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
  | "computed.total_drink_varieties"
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

const list = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const nome = record.nome ?? record.name;
          if (typeof nome === "string" && nome.trim()) return nome.trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
};

export function countDistinctDrinkVarieties(context: ProposalFieldContext): number | null {
  const rawList =
    context.hydratedData?.selectedDrinkNames ??
    context.budget?.selected_drinks ??
    context.budget?.selectedDrinkNames;

  if (!rawList) return null;

  if (Array.isArray(rawList)) {
    if (rawList.length === 0) return null;
    const names = rawList
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const name = record.nome ?? record.name;
          if (typeof name === "string" && name.trim()) return name.trim();
          const id = record.id ?? record.drink_id;
          if (typeof id === "string" && id.trim()) return id.trim();
        }
        return "";
      })
      .filter(Boolean);
    const unique = new Set(names);
    return unique.size > 0 ? unique.size : null;
  }

  if (typeof rawList === "object") {
    const obj = rawList as Record<string, unknown>;
    const candidate = Array.isArray(obj.ids)
      ? obj.ids
      : Array.isArray(obj.names)
        ? obj.names
        : null;
    if (Array.isArray(candidate)) {
      const items = candidate
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim());
      const unique = new Set(items);
      return unique.size > 0 ? unique.size : null;
    }
  }

  return null;
}

export const PROPOSAL_FIELD_RESOLVERS: Record<
  ProposalSourceKey,
  (context: ProposalFieldContext) => ProposalFieldValue
> = {
  "event.event_name": ({ event }) => event.event_name?.trim() || null,
  "budget.created_at": ({ budget }) => budget.created_at || null,
  "event.date": ({ event }) => event.date || null,
  "computed.groom_initial": ({ event }) => resolveExplicitInitial(event.groom_name),
  "computed.bride_initial": ({ event }) => resolveExplicitInitial(event.bride_name),
  "event.guests": ({ event, budget }) => getBudgetVersionGuestCount(budget, event),
  "budget.selected_drinks": ({ hydratedData, budget }) =>
    list(hydratedData?.selectedDrinkNames ?? budget?.selected_drinks ?? budget?.selectedDrinkNames),
  "budget.beverages": ({ budget }) => list(budget.beverages),
  "budget.bartender_quantity": ({ budget }) => budget.bartender_quantity ?? null,
  "budget.copeira_quantity": ({ budget }) => budget.copeira_quantity ?? null,
  "budget.keeper_quantity": ({ budget }) => budget.keeper_quantity ?? null,
  "computed.total_drinks": ({ event, budget }) => {
    const guests = parseNumericValue(getBudgetVersionGuestCount(budget, event));
    const perPerson = parseNumericValue(budget?.drinks_per_person);
    return guests !== null && perPerson !== null ? guests * perPerson : null;
  },
  "computed.total_drink_varieties": (context) => countDistinctDrinkVarieties(context),
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
  const historicalContext = {
    ...context,
    event: getBudgetVersionEventContext(context.budget, context.event),
  };
  return PROPOSAL_FIELD_RESOLVERS[canonical]?.(historicalContext) ?? null;
}

export function formatDateDot(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const year = String(value.getUTCFullYear());
    return `${day}.${month}.${year}`;
  }
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  // YYYY-MM-DD (or ISO datetime)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }

  // DD.MM.YYYY
  const dotMatch = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(trimmed);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    return `${day}.${month}.${year}`;
  }

  // DD/MM/YYYY
  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(trimmed);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${day}.${month}.${year}`;
  }

  return "";
}

/**
 * Formats dates inside a value that is semantically known to be a proposal date.
 *
 * Unlike a global slash replacement, this only recognizes complete calendar date
 * tokens and is only called by date formatters/Canva date presenters.
 */
export function formatProposalDateText(value: unknown): string {
  if (value instanceof Date) return formatDateDot(value);
  if (typeof value !== "string") return "";

  return value
    .replace(
      /\b(\d{4})-(\d{2})-(\d{2})(?:T[^\s]*)?\b/g,
      (_match, year, month, day) => `${day}.${month}.${year}`,
    )
    .replace(
      /\b(\d{2})\/(\d{2})\/(\d{4})\b/g,
      (_match, day, month, year) => `${day}.${month}.${year}`,
    );
}

function cleanLeadingBullet(item: string): string {
  return item.replace(/^[\s•\-\*·\u2022\u25E6\u25AA\u25CF]+/u, "").trim();
}

export function formatBulletList(value: unknown): string {
  if (!value) return "";
  const lines: string[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const sublines = item.split("\n");
        for (const subline of sublines) {
          const cleaned = cleanLeadingBullet(subline);
          if (cleaned) lines.push(`• ${cleaned}`);
        }
      } else if (item != null) {
        const cleaned = cleanLeadingBullet(String(item));
        if (cleaned) lines.push(`• ${cleaned}`);
      }
    }
  } else if (typeof value === "string") {
    const sublines = value.split("\n");
    for (const subline of sublines) {
      const cleaned = cleanLeadingBullet(subline);
      if (cleaned) lines.push(`• ${cleaned}`);
    }
  }

  return lines.join("\n");
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
  if (formatter === "currency" && typeof value === "number") return formatCurrency(value);
  if (formatter === "integer" && typeof value === "number") return Math.round(value).toString();
  if (
    (formatter === "date_canva" || formatter === "date_dot" || formatter === "date_short") &&
    typeof value === "string"
  ) {
    return formatProposalDateText(value);
  }
  if (formatter === "date_long" && typeof value === "string") {
    const [year, month, day] = value.slice(0, 10).split("-");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isNaN(date.getTime())
      ? formatDateDot(value)
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
  DATA_ORCAMENTO: (v) => formatProposalDateText(v),
  DATA_EVENTO: (v) => formatProposalDateText(v),
  DATA_FINAL_PAGAMENTO: (v) => formatProposalDateText(v),
  QUANTIDADE_PESSOAS: (v) => {
    const n = parseNumericValue(v);
    return n === null ? "" : String(n);
  },
  QUANTIDADE_HORAS_EVENTO: (v) => {
    const n = parseNumericValue(v);
    // Zero is the database default for an unfilled duration. Sending it created
    // the isolated "0" below the guest count in the current Canva template.
    return n === null || n <= 0 ? "" : String(n);
  },
  QTD_BARTENDERS: (v) => {
    const n = parseNumericValue(v);
    if (n === null || n <= 0) return "";
    return n === 1 ? "1 Bartender" : `${n} Bartenders`;
  },
  QTD_BAR_KEEPERS: (v) => {
    const n = parseNumericValue(v);
    if (n === null || n <= 0) return "";
    return n === 1 ? "1 Bar Keeper" : `${n} Bar Keepers`;
  },
  QTD_COPEIRAS: (v) => {
    const n = parseNumericValue(v);
    if (n === null || n <= 0) return "";
    return n === 1 ? "1 Copeira" : `${n} Copeiras`;
  },
  QUANTIDADE_DRINKS: (v) => {
    const n = parseNumericValue(v);
    return n === null ? "" : String(n);
  },
  DRINKS: (v) => formatBulletList(v),
  BEBIDAS: (v) => formatBulletList(v),
  VALOR_INVESTIMENTO: (v) => formatCurrency(v),
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

export interface CanonicalProposalData {
  // 15 Campos Oficiais
  nomeEvento: string;
  dataOrcamento: string;
  dataEvento: string;
  inicialNoivo: string;
  inicialNoiva: string;
  quantidadePessoas: number | null;
  quantidadePessoasFormatted: string;
  drinks: string[];
  drinksFormatted: string;
  bebidas: string[];
  bebidasFormatted: string;
  qtdBartenders: number | null;
  qtdBartendersFormatted: string;
  qtdCopeiras: number | null;
  qtdCopeirasFormatted: string;
  qtdBarKeepers: number | null;
  qtdBarKeepersFormatted: string;
  quantidadeVariedadesDrinks: number | null;
  quantidadeVariedadesDrinksFormatted: string;
  valorInvestimento: number | null;
  valorInvestimentoFormatted: string;
  dataFinalPagamento: string;
  quantidadeHorasEvento: number | null;
  quantidadeHorasEventoFormatted: string;

  // Campos complementares do evento/orçamento
  nomeCliente: string;
  tipoEvento: string;
  horarioEvento: string | null;
  formaPagamento: string;
  observacoes: string;
  welcomeDrinks: string[];
  welcomeDrinksTotal: number;
  shots: string[];
  shotsTotal: number;
  servicosInclusos: string[];

  // Dicionário canônico indexado pelas 15 chaves oficiais do Canva
  officialCanvaValues: Record<string, string>;
}

export function resolveCanonicalProposalData(context: ProposalFieldContext): CanonicalProposalData {
  const historicalContext = {
    ...context,
    event: getBudgetVersionEventContext(context.budget, context.event),
  };

  const rawNomeEvento = resolveProposalField("event.event_name", historicalContext);
  const rawDataOrcamento = resolveProposalField("budget.created_at", historicalContext);
  const rawDataEvento = resolveProposalField("event.date", historicalContext);
  const rawIno = resolveProposalField("computed.groom_initial", historicalContext);
  const rawIna = resolveProposalField("computed.bride_initial", historicalContext);
  const rawQtdPessoas = resolveProposalField("event.guests", historicalContext);
  const rawDrinks = resolveProposalField("budget.selected_drinks", historicalContext);
  const rawBebidas = resolveProposalField("budget.beverages", historicalContext);
  const rawBartenders = resolveProposalField("budget.bartender_quantity", historicalContext);
  const rawCopeiras = resolveProposalField("budget.copeira_quantity", historicalContext);
  const rawKeepers = resolveProposalField("budget.keeper_quantity", historicalContext);
  const rawVariedades = resolveProposalField("computed.total_drink_varieties", historicalContext);
  const rawValor = resolveProposalField("budget.final_budget_value", historicalContext);
  const rawDataFinalPagamento = resolveProposalField("computed.final_payment_date", historicalContext);
  const rawHoras = resolveProposalField("event.duration_hours", historicalContext);

  const numQtdPessoas = parseNumericValue(rawQtdPessoas);
  const numBartenders = parseNumericValue(rawBartenders);
  const numCopeiras = parseNumericValue(rawCopeiras);
  const numKeepers = parseNumericValue(rawKeepers);
  const numVariedades = parseNumericValue(rawVariedades);
  const numValor = parseNumericValue(rawValor);
  const numHoras = parseNumericValue(rawHoras);

  const drinksList = Array.isArray(rawDrinks) ? rawDrinks : [];
  const bebidasList = Array.isArray(rawBebidas) ? rawBebidas : [];

  const officialCanvaValues: Record<string, string> = {
    NOME_EVENTO: formatCanvaProposalField("NOME_EVENTO", rawNomeEvento),
    DATA_ORCAMENTO: formatCanvaProposalField("DATA_ORCAMENTO", rawDataOrcamento),
    DATA_EVENTO: formatCanvaProposalField("DATA_EVENTO", rawDataEvento),
    INO: formatCanvaProposalField("INO", rawIno),
    INA: formatCanvaProposalField("INA", rawIna),
    QUANTIDADE_PESSOAS: formatCanvaProposalField("QUANTIDADE_PESSOAS", rawQtdPessoas),
    DRINKS: formatCanvaProposalField("DRINKS", rawDrinks),
    BEBIDAS: formatCanvaProposalField("BEBIDAS", rawBebidas),
    QTD_BARTENDERS: formatCanvaProposalField("QTD_BARTENDERS", rawBartenders),
    QTD_COPEIRAS: formatCanvaProposalField("QTD_COPEIRAS", rawCopeiras),
    QTD_BAR_KEEPERS: formatCanvaProposalField("QTD_BAR_KEEPERS", rawKeepers),
    QUANTIDADE_DRINKS: formatCanvaProposalField("QUANTIDADE_DRINKS", rawVariedades),
    VALOR_INVESTIMENTO: formatCanvaProposalField("VALOR_INVESTIMENTO", rawValor),
    DATA_FINAL_PAGAMENTO: formatCanvaProposalField("DATA_FINAL_PAGAMENTO", rawDataFinalPagamento),
    QUANTIDADE_HORAS_EVENTO: formatCanvaProposalField("QUANTIDADE_HORAS_EVENTO", rawHoras),
  };

  const ev = historicalContext.event as Record<string, any>;
  const bg = historicalContext.budget as Record<string, any>;

  const clientName =
    (typeof ev.client_name === "string" && ev.client_name.trim()) ||
    (typeof ev.event_name === "string" && ev.event_name.trim()) ||
    "";
  const eventType = typeof ev.event_type === "string" ? ev.event_type : "";
  const eventTime =
    typeof ev.start_time === "string"
      ? ev.start_time
      : typeof ev.time === "string"
        ? ev.time
        : null;
  const paymentTerms =
    typeof bg.payment_terms === "string"
      ? bg.payment_terms
      : typeof bg.forma_pagamento === "string"
        ? bg.forma_pagamento
        : "";
  const observations =
    typeof bg.observations === "string"
      ? bg.observations
      : typeof bg.observacoes === "string"
        ? bg.observacoes
        : "";
  const welcomeDrinks = Array.isArray(bg.welcome_drinks) ? bg.welcome_drinks : [];
  const welcomeDrinksTotal = Number(bg.welcome_drinks_total || 0);
  const shots = Array.isArray(bg.shots) ? bg.shots : [];
  const shotsTotal = Number(bg.shots_total || 0);
  const servicosInclusos = Array.isArray(bg.included_services) ? bg.included_services : [];

  return {
    nomeEvento: officialCanvaValues.NOME_EVENTO,
    dataOrcamento: officialCanvaValues.DATA_ORCAMENTO,
    dataEvento: officialCanvaValues.DATA_EVENTO,
    inicialNoivo: officialCanvaValues.INO,
    inicialNoiva: officialCanvaValues.INA,
    quantidadePessoas: numQtdPessoas,
    quantidadePessoasFormatted: officialCanvaValues.QUANTIDADE_PESSOAS,
    drinks: drinksList,
    drinksFormatted: officialCanvaValues.DRINKS,
    bebidas: bebidasList,
    bebidasFormatted: officialCanvaValues.BEBIDAS,
    qtdBartenders: numBartenders,
    qtdBartendersFormatted: officialCanvaValues.QTD_BARTENDERS,
    qtdCopeiras: numCopeiras,
    qtdCopeirasFormatted: officialCanvaValues.QTD_COPEIRAS,
    qtdBarKeepers: numKeepers,
    qtdBarKeepersFormatted: officialCanvaValues.QTD_BAR_KEEPERS,
    quantidadeVariedadesDrinks: numVariedades,
    quantidadeVariedadesDrinksFormatted: officialCanvaValues.QUANTIDADE_DRINKS,
    valorInvestimento: numValor,
    valorInvestimentoFormatted: officialCanvaValues.VALOR_INVESTIMENTO,
    dataFinalPagamento: officialCanvaValues.DATA_FINAL_PAGAMENTO,
    quantidadeHorasEvento: numHoras && numHoras > 0 ? numHoras : null,
    quantidadeHorasEventoFormatted: officialCanvaValues.QUANTIDADE_HORAS_EVENTO,

    nomeCliente: clientName,
    tipoEvento: typeof eventType === "string" ? eventType : String(eventType ?? ""),
    horarioEvento: typeof eventTime === "string" ? eventTime : null,
    formaPagamento: paymentTerms,
    observacoes: observations,
    welcomeDrinks,
    welcomeDrinksTotal,
    shots,
    shotsTotal,
    servicosInclusos,

    officialCanvaValues,
  };
}

