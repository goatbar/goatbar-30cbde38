import { numberToWordsBRL } from "./number-to-words-brl";

export interface BudgetVersionData {
  id?: string;
  final_budget_value?: number | null;
  guest_count?: number | null;
  guests?: number | null;
  average_value_per_person?: number | null;
  value_per_person?: number | null;
  selected_drinks?: any;
  beverages?: any;
  paid_value?: number | null;
  payment_method?: string | null;
  pending_payment_date?: string | null;
  event_snapshot?: any;
  [key: string]: any;
}

export interface DrinkComparisonResult {
  changed: boolean;
  previousDrinks: string[];
  currentDrinks: string[];
  added: string[];
  removed: string[];
  maintained: string[];
  finalListText: string;
}

export interface ContractualChange {
  key: string;
  label: string;
  previous: unknown;
  current: unknown;
  category: string;
}

export interface ContractAddendumComparison {
  requiresAddendum: boolean;
  drinks: DrinkComparisonResult;
  totalValue: {
    changed: boolean;
    previous: number;
    current: number;
    difference: number;
    currentFormatted: string;
    currentWords: string;
  };
  extraGuestValue: {
    changed: boolean;
    previous: number;
    current: number;
    currentFormatted: string;
    currentWords: string;
  };
  guestCount: { changed: boolean; previous: number | null; current: number | null };
  changes: ContractualChange[];
  resumo_alteracoes: string;
  valor_total_anterior: number;
  valor_total_novo: number;
  valor_diferenca: number;
  valor_ja_pago: number | null;
  saldo_anterior: number | null;
  novo_saldo_restante: number | null;
  credito_cliente: number | null;
  forma_pagamento_saldo: string | null;
  meio_pagamento_saldo: string | null;
  datas_vencimento: string[];
  financial: {
    currentTotal: number;
    paidAmount: number | null;
    remainingBalance: number | null;
    previousBalance: number | null;
    hasExcessPaymentCredit: boolean;
    creditAmount: number;
    paymentCondition: string | null;
    paymentMethod: string | null;
    dueDates: string[];
    dueDate: string;
  };
}

export type DrinkNameById = Record<string, string>;

export function formatPortugueseList(items: string[]): string {
  if (!items?.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

const resolveDrinkName = (value: any, drinkNameById: DrinkNameById): string => {
  if (typeof value === "string") {
    const clean = value.trim();
    return drinkNameById[clean] || clean;
  }

  if (!value || typeof value !== "object") return "";

  const explicitName =
    value.name || value.nome || value.drink_name || value.beverage_name || value.titulo;
  if (typeof explicitName === "string" && explicitName.trim()) return explicitName.trim();

  const id = value.drink_id || value.id;
  if (typeof id === "string" && id.trim()) {
    const cleanId = id.trim();
    return drinkNameById[cleanId] || cleanId;
  }

  return "";
};

const dedupeDrinkNames = (values: string[]): string[] =>
  values.filter(
    (value, index, all) =>
      value &&
      all.findIndex(
        (candidate) =>
          candidate.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"),
      ) === index,
  );

/**
 * Retorna os COQUETÉIS selecionados na proposta.
 *
 * A fonte canônica é selected_drinks (items/ids/array). O campo `beverages`
 * contém bebidas/insumos-base em versões atuais e não pode ser misturado à
 * carta de drinks do aditivo. Ele permanece somente como fallback para versões
 * legadas que não possuam selected_drinks.
 */
export function extractDrinksList(
  budget: BudgetVersionData,
  drinkNameById: DrinkNameById = {},
): string[] {
  const selected: string[] = [];
  const raw = budget.selected_drinks;

  if (Array.isArray(raw)) {
    raw.forEach((value) => selected.push(resolveDrinkName(value, drinkNameById)));
  } else if (raw && typeof raw === "object") {
    if (Array.isArray(raw.items) && raw.items.length > 0) {
      raw.items.forEach((value: any) =>
        selected.push(resolveDrinkName(value, drinkNameById)),
      );
    } else if (Array.isArray(raw.ids) && raw.ids.length > 0) {
      raw.ids.forEach((value: any) =>
        selected.push(resolveDrinkName(value, drinkNameById)),
      );
    }
  }

  const canonicalSelected = dedupeDrinkNames(selected.filter(Boolean));
  if (canonicalSelected.length > 0) return canonicalSelected;

  // Compatibilidade exclusiva com propostas antigas sem selected_drinks.
  const legacyBeverages: string[] = [];
  if (Array.isArray(budget.beverages)) {
    budget.beverages.forEach((value: any) =>
      legacyBeverages.push(resolveDrinkName(value, drinkNameById)),
    );
  } else if (Array.isArray(budget.beverages?.items)) {
    budget.beverages.items.forEach((value: any) =>
      legacyBeverages.push(resolveDrinkName(value, drinkNameById)),
    );
  }

  return dedupeDrinkNames(legacyBeverages.filter(Boolean));
}

export function calculateExtraGuestValue(b: BudgetVersionData): number {
  const direct = Number(b.average_value_per_person || b.value_per_person || 0);
  if (direct > 0) return direct;
  const total = Number(b.final_budget_value || 0);
  const guests = Number(b.guest_count || b.guests || 0);
  return total > 0 && guests > 0 ? Math.round((total / guests) * 100) / 100 : 0;
}

const fmt = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const stable = (value: any): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.keys(item)
          .sort()
          .reduce((acc, key) => {
            acc[key] = item[key];
            return acc;
          }, {} as any)
      : item,
  );

const same = (a: any, b: any) =>
  typeof a === "number" || typeof b === "number"
    ? Math.abs(Number(a || 0) - Number(b || 0)) <= 0.01
    : stable(a ?? null) === stable(b ?? null);

const field = (budget: BudgetVersionData, ...keys: string[]) => {
  for (const key of keys) {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      if (budget[parent]?.[child] !== undefined) return budget[parent][child];
    } else if (budget[key] !== undefined) {
      return budget[key];
    }
  }
  return null;
};

const RELEVANT = [
  ["guest_count", "Convidados", "evento", ["guest_count", "guests", "event_snapshot.guest_count", "event_snapshot.guests"]],
  ["duration", "Duração", "evento", ["duration_hours", "event_snapshot.duration_hours", "event_snapshot.duration"]],
  ["event_date", "Data do evento", "evento", ["event_date", "date", "event_snapshot.date", "event_snapshot.event_date"]],
  ["location", "Local do evento", "evento", ["location", "event_snapshot.location", "event_snapshot.venue"]],
  ["city", "Cidade", "evento", ["city", "event_snapshot.city"]],
  ["miscellaneous_items", "Adicionais", "comercial", ["miscellaneous_items"]],
  ["team", "Equipe/mão de obra", "comercial", ["bartender_quantity", "keeper_quantity", "copeira_quantity", "team_total_value"]],
  ["welcome_drinks", "Welcome drinks", "comercial", ["has_welcome_drinks", "welcome_drinks_selected", "welcome_drinks_final_value"]],
  ["shots", "Shots", "comercial", ["has_shots", "shots_items", "shots_total_value"]],
  ["ice", "Gelo", "comercial", ["ice_packages_quantity", "ice_total_value"]],
  ["travel", "Deslocamento", "comercial", ["has_travel", "fuel_value"]],
  ["discount", "Desconto", "financeiro", ["discount_value", "discount_description"]],
] as const;

export function compareContractVersions(
  base: BudgetVersionData,
  current: BudgetVersionData,
  drinkNameById: DrinkNameById = {},
): ContractAddendumComparison {
  const prevDrinks = extractDrinksList(base, drinkNameById);
  const curDrinks = extractDrinksList(current, drinkNameById);
  const previousSet = new Set(prevDrinks.map((value) => value.toLocaleLowerCase("pt-BR")));
  const currentSet = new Set(curDrinks.map((value) => value.toLocaleLowerCase("pt-BR")));

  const added = curDrinks.filter(
    (value) => !previousSet.has(value.toLocaleLowerCase("pt-BR")),
  );
  const removed = prevDrinks.filter(
    (value) => !currentSet.has(value.toLocaleLowerCase("pt-BR")),
  );
  const drinksChanged = Boolean(added.length || removed.length);

  const previous = Number(base.final_budget_value || 0);
  const next = Number(current.final_budget_value || 0);
  const difference = next - previous;
  const totalChanged = !same(previous, next);

  const previousExtra = calculateExtraGuestValue(base);
  const currentExtra = calculateExtraGuestValue(current);
  const extraChanged = !same(previousExtra, currentExtra);

  const changes: ContractualChange[] = [];
  if (drinksChanged) {
    changes.push({
      key: "drinks",
      label: "Drinks",
      previous: prevDrinks,
      current: curDrinks,
      category: "comercial",
    });
  }
  if (totalChanged) {
    changes.push({
      key: "total_value",
      label: "Valor total",
      previous,
      current: next,
      category: "financeiro",
    });
  }
  if (extraChanged) {
    changes.push({
      key: "extra_guest_value",
      label: "Valor por convidado excedente",
      previous: previousExtra,
      current: currentExtra,
      category: "financeiro",
    });
  }

  for (const [key, label, category, keys] of RELEVANT) {
    const before = keys.map((fieldKey) => field(base, fieldKey));
    const after = keys.map((fieldKey) => field(current, fieldKey));
    if (!same(before, after)) {
      changes.push({
        key,
        label,
        previous: before.length === 1 ? before[0] : before,
        current: after.length === 1 ? after[0] : after,
        category,
      });
    }
  }

  const paidRaw = current.paid_value ?? base.paid_value;
  const paid =
    paidRaw === null || paidRaw === undefined ? null : Number(paidRaw);

  const remaining = paid === null ? null : Math.max(next - paid, 0);
  const previousBalance = paid === null ? null : Math.max(previous - paid, 0);
  const credit = paid === null ? 0 : Math.max(paid - next, 0);

  const rawPayment = String(current.payment_method || base.payment_method || "").trim();
  const condition = /parcel|\d+x/i.test(rawPayment)
    ? "Parcelado"
    : /vista/i.test(rawPayment)
      ? "À vista"
      : null;
  const method =
    (rawPayment.match(/pix|transfer[eê]ncia|cart[aã]o|boleto/i)?.[0] || "")
      .replace(/^pix$/i, "PIX") || null;

  const due = String(current.pending_payment_date || base.pending_payment_date || "").trim();
  const dueDates = due
    ? due.split(/\s*(?:,|;|\se\s)\s*/).filter(Boolean)
    : [];

  const guest = changes.find((change) => change.key === "guest_count");
  const summary = changes
    .map((change) =>
      change.key === "drinks"
        ? `Drinks: adicionados ${formatPortugueseList(added) || "nenhum"}; removidos ${formatPortugueseList(removed) || "nenhum"}`
        : `${change.label}: alterado`,
    )
    .join("; ");

  return {
    requiresAddendum: changes.length > 0,
    drinks: {
      changed: drinksChanged,
      previousDrinks: prevDrinks,
      currentDrinks: curDrinks,
      added,
      removed,
      maintained: curDrinks.filter((value) =>
        previousSet.has(value.toLocaleLowerCase("pt-BR")),
      ),
      finalListText: formatPortugueseList(curDrinks),
    },
    totalValue: {
      changed: totalChanged,
      previous,
      current: next,
      difference,
      currentFormatted: fmt(next),
      currentWords: numberToWordsBRL(next),
    },
    extraGuestValue: {
      changed: extraChanged,
      previous: previousExtra,
      current: currentExtra,
      currentFormatted: fmt(currentExtra),
      currentWords: numberToWordsBRL(currentExtra),
    },
    guestCount: {
      changed: Boolean(guest),
      previous: Number(field(base, "guest_count", "guests") ?? 0) || null,
      current: Number(field(current, "guest_count", "guests") ?? 0) || null,
    },
    changes,
    resumo_alteracoes: summary,
    valor_total_anterior: previous,
    valor_total_novo: next,
    valor_diferenca: difference,
    valor_ja_pago: paid,
    saldo_anterior: previousBalance,
    novo_saldo_restante: remaining,
    credito_cliente: paid === null ? null : credit,
    forma_pagamento_saldo: condition,
    meio_pagamento_saldo: method,
    datas_vencimento: dueDates,
    financial: {
      currentTotal: next,
      paidAmount: paid,
      remainingBalance: remaining,
      previousBalance,
      hasExcessPaymentCredit: credit > 0,
      creditAmount: credit,
      paymentCondition: condition,
      paymentMethod: method,
      dueDates,
      dueDate: dueDates.join(" e "),
    },
  };
}
