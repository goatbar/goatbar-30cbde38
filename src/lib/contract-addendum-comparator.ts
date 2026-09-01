import { numberToWordsBRL } from "./number-to-words-brl";

export interface BudgetVersionData {
  id?: string;
  version_number?: number;
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
  financial: {
    currentTotal: number;
    paidAmount: number;
    remainingBalance: number;
    hasExcessPaymentCredit: boolean;
    creditAmount: number;
    paymentMethod: string;
    dueDate: string;
  };
}

/** Formata uma lista de strings em português (ex: ["A", "B", "C"] -> "A, B e C") */
export function formatPortugueseList(items: string[]): string {
  if (!items || items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** Extrai a lista unificada de nomes de drinks e bebidas de uma versão de proposta */
export function extractDrinksList(budget: BudgetVersionData): string[] {
  const list: string[] = [];

  // 1. Extrai coquetéis em selected_drinks
  const selected = budget.selected_drinks;
  if (Array.isArray(selected)) {
    selected.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        list.push(item.trim());
      } else if (item && typeof item === "object") {
        const name = item.name || item.nome || item.drink_name || item.titulo;
        if (typeof name === "string" && name.trim()) list.push(name.trim());
      }
    });
  } else if (selected && typeof selected === "object") {
    if (Array.isArray(selected.items)) {
      selected.items.forEach((item: any) => {
        const name = typeof item === "string" ? item : item?.name || item?.nome;
        if (typeof name === "string" && name.trim()) list.push(name.trim());
      });
    }
  }

  // 2. Extrai bebidas em beverages
  const bev = budget.beverages;
  if (Array.isArray(bev)) {
    bev.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        list.push(item.trim());
      } else if (item && typeof item === "object") {
        const name = item.name || item.nome || item.beverage_name;
        if (typeof name === "string" && name.trim()) list.push(name.trim());
      }
    });
  }

  // Deduplica preservando ordem e mantendo caixa
  const seen = new Set<string>();
  const result: string[] = [];
  list.forEach((item) => {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });

  return result;
}

/** Calcula o valor do convidado excedente de acordo com a regra comercial da GOAT Bar */
export function calculateExtraGuestValue(budget: BudgetVersionData): number {
  if (typeof budget.average_value_per_person === "number" && budget.average_value_per_person > 0) {
    return budget.average_value_per_person;
  }
  if (typeof budget.value_per_person === "number" && budget.value_per_person > 0) {
    return budget.value_per_person;
  }
  const total = Number(budget.final_budget_value || 0);
  const guests = Number(budget.guest_count || budget.guests || 0);
  if (total > 0 && guests > 0) {
    return Math.round((total / guests) * 100) / 100;
  }
  return 0;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

/**
 * Compara deterministicamente duas versões de proposta (Versão Contratada Base vs Nova Versão Aprovada).
 * Retorna as alterações detalhadas e a flag `requiresAddendum`.
 */
export function compareContractVersions(
  baseVersion: BudgetVersionData,
  updatedVersion: BudgetVersionData,
): ContractAddendumComparison {
  // 1. Drinks & Bebidas
  const previousDrinks = extractDrinksList(baseVersion);
  const currentDrinks = extractDrinksList(updatedVersion);

  const previousSet = new Set(previousDrinks.map((d) => d.toLowerCase()));
  const currentSet = new Set(currentDrinks.map((d) => d.toLowerCase()));

  const added = currentDrinks.filter((d) => !previousSet.has(d.toLowerCase()));
  const removed = previousDrinks.filter((d) => !currentSet.has(d.toLowerCase()));
  const maintained = currentDrinks.filter((d) => previousSet.has(d.toLowerCase()));

  const drinksChanged = added.length > 0 || removed.length > 0;
  const finalListText = formatPortugueseList(currentDrinks);

  // 2. Valor Total
  const previousTotal = Number(baseVersion.final_budget_value || 0);
  const currentTotal = Number(updatedVersion.final_budget_value || 0);
  const totalValueChanged = Math.abs(previousTotal - currentTotal) > 0.01;
  const totalDifference = currentTotal - previousTotal;

  // 3. Convidado Excedente
  const previousExtraGuestVal = calculateExtraGuestValue(baseVersion);
  const currentExtraGuestVal = calculateExtraGuestValue(updatedVersion);
  const extraGuestValueChanged = Math.abs(previousExtraGuestVal - currentExtraGuestVal) > 0.01;

  // 4. Financeiro
  const paidAmount = Number(
    updatedVersion.paid_value !== undefined
      ? updatedVersion.paid_value
      : baseVersion.paid_value || 0,
  );
  const remainingBalance = Math.max(0, currentTotal - paidAmount);
  const hasExcessPaymentCredit = paidAmount > currentTotal + 0.01;
  const creditAmount = hasExcessPaymentCredit ? paidAmount - currentTotal : 0;

  const paymentMethod =
    updatedVersion.payment_method || baseVersion.payment_method || "Não informado";
  const dueDate =
    updatedVersion.pending_payment_date || baseVersion.pending_payment_date || "A definir";

  // 5. Necessidade de Aditivo (Relevância Contratual)
  const requiresAddendum = drinksChanged || totalValueChanged || extraGuestValueChanged;

  return {
    requiresAddendum,
    drinks: {
      changed: drinksChanged,
      previousDrinks,
      currentDrinks,
      added,
      removed,
      maintained,
      finalListText,
    },
    totalValue: {
      changed: totalValueChanged,
      previous: previousTotal,
      current: currentTotal,
      difference: totalDifference,
      currentFormatted: fmt(currentTotal),
      currentWords: numberToWordsBRL(currentTotal),
    },
    extraGuestValue: {
      changed: extraGuestValueChanged,
      previous: previousExtraGuestVal,
      current: currentExtraGuestVal,
      currentFormatted: fmt(currentExtraGuestVal),
      currentWords: numberToWordsBRL(currentExtraGuestVal),
    },
    financial: {
      currentTotal,
      paidAmount,
      remainingBalance,
      hasExcessPaymentCredit,
      creditAmount,
      paymentMethod,
      dueDate,
    },
  };
}
