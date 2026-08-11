export type WelcomeDrinkSelection = {
  drinkId: string;
  nameSnapshot: string;
  unitCostSnapshot: number;
};

export type ShotBudgetItem = {
  id: string;
  productId?: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
};

export const ADDITIONAL_COST_LABEL = "Custo Adicional";

export type WelcomeDrinkDistribution = WelcomeDrinkSelection & {
  quantidade: number;
  subtotal: number;
};

const nonNegative = (value: unknown, integer = false) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return integer ? Math.floor(parsed) : parsed;
};

export function calcularWelcomeDrinks(
  convidados: unknown,
  drinksPorPessoa: unknown,
  selecionados: WelcomeDrinkSelection[] | null | undefined,
  lucroPct: unknown,
) {
  const safeSelections = Array.isArray(selecionados) ? selecionados : [];
  const totalDrinks = nonNegative(convidados, true) * nonNegative(drinksPorPessoa, true);
  if (safeSelections.length === 0 || totalDrinks === 0) {
    return {
      totalDrinks,
      distribuicao: [] as WelcomeDrinkDistribution[],
      custoTotal: 0,
      valorFinal: 0,
    };
  }
  const base = Math.floor(totalDrinks / safeSelections.length);
  const remainder = totalDrinks % safeSelections.length;
  const distribuicao = safeSelections.map((selection, index) => {
    const quantidade = base + (index < remainder ? 1 : 0);
    const unitCostSnapshot = nonNegative(selection.unitCostSnapshot);
    return { ...selection, unitCostSnapshot, quantidade, subtotal: quantidade * unitCostSnapshot };
  });
  const custoTotal = distribuicao.reduce((total, item) => total + item.subtotal, 0);
  const valorFinal = custoTotal * (1 + nonNegative(lucroPct) / 100);
  return { totalDrinks, distribuicao, custoTotal, valorFinal };
}

export function calcularTotalShots(items: ShotBudgetItem[] | null | undefined) {
  return (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + nonNegative(item.quantidade) * nonNegative(item.valorUnitario),
    0,
  );
}

export function normalizeAdditionalBudgetFields(
  source: Record<string, unknown> | null | undefined,
) {
  const value = source || {};
  return {
    hasWelcomeDrinks: value.has_welcome_drinks === true,
    welcomeDrinksPerPerson: nonNegative(value.welcome_drinks_per_person, true),
    welcomeDrinksProfitPercentage: nonNegative(value.welcome_drinks_profit_percentage),
    welcomeDrinksSelected: (Array.isArray(value.welcome_drinks_selected)
      ? value.welcome_drinks_selected
      : []) as WelcomeDrinkSelection[],
    welcomeDrinksCost: nonNegative(value.welcome_drinks_cost),
    welcomeDrinksFinalValue: nonNegative(value.welcome_drinks_final_value),
    hasShots: value.has_shots === true,
    shotsItems: (Array.isArray(value.shots_items) ? value.shots_items : []) as ShotBudgetItem[],
    shotsTotalValue: nonNegative(value.shots_total_value),
  };
}

export function calcularTotalOrcamentoComAdicionais(
  valorSemAdicionais: unknown,
  welcomeFinal: unknown,
  shotsTotal: unknown,
) {
  return nonNegative(valorSemAdicionais) + nonNegative(welcomeFinal) + nonNegative(shotsTotal);
}
