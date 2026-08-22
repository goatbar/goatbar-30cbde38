/**
 * Módulo de Cálculos Financeiros da Unidade 7 Steak House
 * Regra Financeira Oficial - Goat Bar Management System
 */

export interface SteakhouseItemFinancials {
  drinkId?: string;
  nome: string;
  quantidade: number;
  // Valores unitários
  precoVenda7Steakhouse: number;
  custoOperacional7Steakhouse: number;
  custoEventoDrink: number;
  // Totais agregados do item
  valorTotalBruto: number; // quantidade * precoVenda7Steakhouse
  receitaGoatBar: number; // quantidade * custoOperacional7Steakhouse
  valorRetidoRestaurante: number; // valorTotalBruto - receitaGoatBar
  custoInsumos: number; // quantidade * custoEventoDrink
  margemContribuicao: number; // receitaGoatBar - custoInsumos (mão de obra existe apenas no agregado da sessão)
}

export interface SteakhouseSessionFinancials {
  items: SteakhouseItemFinancials[];
  totalDrinks: number;
  valorTotalBruto: number; // sum(item.valorTotalBruto)
  receitaGoatBar: number; // sum(item.receitaGoatBar)
  valorRetidoRestaurante: number; // valorTotalBruto - receitaGoatBar
  custoInsumos: number; // sum(item.custoInsumos)
  margemContribuicao: number; // receitaGoatBar - custoInsumos
  maoDeObraSemanal: number;
  reposicaoRestaurante: number; // Informacional / discriminado separadamente
  custoOperacionalGoatBar: number; // maoDeObraSemanal + custoInsumos
  lucroFinal: number; // receitaGoatBar - custoOperacionalGoatBar
}

export function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    // Trata moedas com formato brasileiro (ex: 1.234,56 ou 288,80) e internacional (1234.56)
    let normalized = trimmed.replace(/R\$\s*/gi, "").replace(/\s+/g, "");
    if (normalized.includes(",") && normalized.includes(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
      normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Extrai e resolve os três valores fundamentais de um item da 7 Steak House:
 * 1. Preço de Venda 7 Steak House
 * 2. Custo Operacional 7 Steak House
 * 3. Custo Insumos / Evento
 *
 * Prioridade:
 * - Snapshot gravado no item (se presente e finito)
 * - Configuração da modalidade no catálogo
 * - Fallback de catálogo legado para insumos (custo_unitario / custoUnitario)
 * - 0
 */
export function resolveSteakhouseItemValues(
  item: any,
  catalogDrink?: any
): {
  precoVenda7Steakhouse: number;
  custoOperacional7Steakhouse: number;
  custoEventoDrink: number;
} {
  const modConfig = catalogDrink?.modality_config || catalogDrink?.modalityConfig;
  const steakConfig = modConfig?.steakhouse;
  const eventoConfig = modConfig?.evento;

  // 1. Preço de Venda 7 Steak House
  let precoVenda7Steakhouse = 0;
  if (item?.precoUnitario !== undefined && item?.precoUnitario !== null && !isNaN(Number(item.precoUnitario))) {
    precoVenda7Steakhouse = toFiniteNumber(item.precoUnitario);
  } else if (item?.unit_price !== undefined && item?.unit_price !== null && !isNaN(Number(item.unit_price))) {
    precoVenda7Steakhouse = toFiniteNumber(item.unit_price);
  } else if (steakConfig?.price !== undefined && steakConfig?.price !== null) {
    precoVenda7Steakhouse = toFiniteNumber(steakConfig.price);
  } else if (catalogDrink?.precoVenda !== undefined || catalogDrink?.preco_venda !== undefined) {
    precoVenda7Steakhouse = toFiniteNumber(catalogDrink.precoVenda ?? catalogDrink.preco_venda);
  }

  // 2. Custo Operacional 7 Steak House (base exclusiva da Receita Goat Bar)
  let custoOperacional7Steakhouse = 0;
  if (item?.custoUnitario !== undefined && item?.custoUnitario !== null && !isNaN(Number(item.custoUnitario))) {
    custoOperacional7Steakhouse = toFiniteNumber(item.custoUnitario);
  } else if (item?.unit_cost !== undefined && item?.unit_cost !== null && !isNaN(Number(item.unit_cost))) {
    custoOperacional7Steakhouse = toFiniteNumber(item.unit_cost);
  } else if (steakConfig?.cost !== undefined && steakConfig?.cost !== null) {
    custoOperacional7Steakhouse = toFiniteNumber(steakConfig.cost);
  }

  // 3. Custo dos Insumos (Modalidade Evento)
  let custoEventoDrink = 0;
  if (item?.custoInsumo !== undefined && item?.custoInsumo !== null && !isNaN(Number(item.custoInsumo))) {
    custoEventoDrink = toFiniteNumber(item.custoInsumo);
  } else if (item?.ingredient_cost !== undefined && item?.ingredient_cost !== null && !isNaN(Number(item.ingredient_cost))) {
    custoEventoDrink = toFiniteNumber(item.ingredient_cost);
  } else if (eventoConfig?.cost !== undefined && eventoConfig?.cost !== null) {
    custoEventoDrink = toFiniteNumber(eventoConfig.cost);
  } else if (catalogDrink?.custoUnitario !== undefined || catalogDrink?.custo_unitario !== undefined) {
    // Fallback legado documentado: utilizado somente quando o drink foi cadastrado antes da separação por modalidades
    custoEventoDrink = toFiniteNumber(catalogDrink.custoUnitario ?? catalogDrink.custo_unitario);
  }

  return {
    precoVenda7Steakhouse,
    custoOperacional7Steakhouse,
    custoEventoDrink,
  };
}

/**
 * Calcula a apuração financeira de um drink individual na 7 Steak House.
 */
export function calculateSteakhouseItemFinancials(
  item: any,
  catalogDrinks: any[] = []
): SteakhouseItemFinancials {
  const drinkId = item?.drinkId ?? item?.drink_id;
  const drinkName = item?.nome ?? item?.drink_name ?? item?.name ?? "";

  const catalogDrink = catalogDrinks.find(
    (d) =>
      (drinkId && (String(d.id) === String(drinkId) || d.nome === drinkId)) ||
      (drinkName && (d.nome === drinkName || d.id === drinkName))
  );

  const {
    precoVenda7Steakhouse,
    custoOperacional7Steakhouse,
    custoEventoDrink,
  } = resolveSteakhouseItemValues(item, catalogDrink);

  const quantidade = toFiniteNumber(item?.quantidade ?? item?.quantity ?? 0);

  const valorTotalBruto = Math.round(quantidade * precoVenda7Steakhouse * 100) / 100;
  const receitaGoatBar = Math.round(quantidade * custoOperacional7Steakhouse * 100) / 100;
  const valorRetidoRestaurante = Math.round((valorTotalBruto - receitaGoatBar) * 100) / 100;
  const custoInsumos = Math.round(quantidade * custoEventoDrink * 100) / 100;
  const margemContribuicao = Math.round((receitaGoatBar - custoInsumos) * 100) / 100;

  return {
    drinkId: catalogDrink?.id ?? drinkId,
    nome: drinkName || catalogDrink?.nome || "Drink sem nome",
    quantidade,
    precoVenda7Steakhouse,
    custoOperacional7Steakhouse,
    custoEventoDrink,
    valorTotalBruto,
    receitaGoatBar,
    valorRetidoRestaurante,
    custoInsumos,
    margemContribuicao,
  };
}

export type DayOfWeekKey =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado"
  | "domingo";

export interface SteakhouseDailyLabor {
  dia: DayOfWeekKey | string;
  data?: string;
  valor: number;
  qtdPessoas?: number;
  nomes?: string;
}

export const STEAKHOUSE_DAYS_OF_WEEK: { key: DayOfWeekKey; label: string; shortLabel: string }[] = [
  { key: "segunda", label: "Segunda-feira", shortLabel: "Seg" },
  { key: "terca", label: "Terça-feira", shortLabel: "Ter" },
  { key: "quarta", label: "Quarta-feira", shortLabel: "Qua" },
  { key: "quinta", label: "Quinta-feira", shortLabel: "Qui" },
  { key: "sexta", label: "Sexta-feira", shortLabel: "Sex" },
  { key: "sabado", label: "Sábado", shortLabel: "Sáb" },
  { key: "domingo", label: "Domingo", shortLabel: "Dom" },
];

export function normalizeDayKey(input: string): DayOfWeekKey | null {
  if (!input || typeof input !== "string") return null;
  const norm = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (/^(segunda(-feira)?|seg)$/i.test(norm)) return "segunda";
  if (/^(terca(-feira)?|ter)$/i.test(norm)) return "terca";
  if (/^(quarta(-feira)?|qua)$/i.test(norm)) return "quarta";
  if (/^(quinta(-feira)?|qui)$/i.test(norm)) return "quinta";
  if (/^(sexta(-feira)?|sex)$/i.test(norm)) return "sexta";
  if (/^(sabado|sab)$/i.test(norm)) return "sabado";
  if (/^(domingo|dom)$/i.test(norm)) return "domingo";

  return null;
}

/**
 * Calcula a apuração financeira consolidada de uma sessão semanal da 7 Steak House.
 */
export function calculateSteakhouseSessionFinancials(
  session: any,
  catalogDrinks: any[] = []
): SteakhouseSessionFinancials {
  const rawItems = session?.items || [];
  const items: SteakhouseItemFinancials[] = rawItems.map((item: any) =>
    calculateSteakhouseItemFinancials(item, catalogDrinks)
  );

  const totalDrinks = items.reduce((acc, it) => acc + it.quantidade, 0);
  const valorTotalBruto = Math.round(items.reduce((acc, it) => acc + it.valorTotalBruto, 0) * 100) / 100;
  const receitaGoatBar = Math.round(items.reduce((acc, it) => acc + it.receitaGoatBar, 0) * 100) / 100;
  const valorRetidoRestaurante = Math.round((valorTotalBruto - receitaGoatBar) * 100) / 100;
  const custoInsumos = Math.round(items.reduce((acc, it) => acc + it.custoInsumos, 0) * 100) / 100;
  const margemContribuicao = Math.round((receitaGoatBar - custoInsumos) * 100) / 100;

  // Cálculo da Mão de Obra Semanal
  let maoDeObraSemanal = 0;
  const laborDetails = session?.maoDeObraDetalhes || session?.labor_details;
  const hasValidDetails =
    Array.isArray(laborDetails) &&
    laborDetails.length > 0 &&
    laborDetails.some((d: any) => toFiniteNumber(d.valor) > 0);

  if (hasValidDetails) {
    maoDeObraSemanal = laborDetails.reduce((acc, d) => acc + toFiniteNumber(d.valor), 0);
  } else {
    const laborVal = toFiniteNumber(session?.maoDeObraValor ?? session?.labor_value ?? 0);
    const laborQtd = toFiniteNumber(session?.maoDeObraQtd ?? session?.labor_quantity ?? 0);
    maoDeObraSemanal = laborQtd > 0 ? laborVal * laborQtd : laborVal;
  }
  maoDeObraSemanal = Math.round(maoDeObraSemanal * 100) / 100;

  // Reposição Restaurante (informativo, não entra no custo operacional da Goat Bar)
  const reposicaoRestaurante = Math.round(
    toFiniteNumber(session?.reposicaoRestaurante ?? session?.reposicao_restaurante ?? 0) * 100
  ) / 100;

  // Custo Operacional Goat Bar = Mão de Obra + Custo dos Insumos
  const custoOperacionalGoatBar = Math.round((maoDeObraSemanal + custoInsumos) * 100) / 100;

  // Lucro Final Goat Bar = Receita Goat Bar - Custo Operacional Goat Bar
  const lucroFinal = Math.round((receitaGoatBar - custoOperacionalGoatBar) * 100) / 100;

  return {
    items,
    totalDrinks,
    valorTotalBruto,
    receitaGoatBar,
    valorRetidoRestaurante,
    custoInsumos,
    margemContribuicao,
    maoDeObraSemanal,
    reposicaoRestaurante,
    custoOperacionalGoatBar,
    lucroFinal,
  };
}
