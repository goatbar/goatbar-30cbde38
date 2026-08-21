// src/lib/proposal-field-catalog.ts
// Official catalog of Goat Bar fields available for Canva Brand Template mapping

export type FieldValueType = "text" | "date" | "number" | "currency" | "list";

export interface ProposalCatalogField {
  key: string;
  label: string;
  group:
    | "Cliente"
    | "Evento"
    | "Orçamento"
    | "Equipe"
    | "Cardápio & Bebidas"
    | "Drinks"
    | "Bebidas"
    | "Empresa"
    | "Campos Formatados / Calculados"
    | "Campos calculados";
  type: FieldValueType;
  description: string;
  example: string;
}

export interface FieldFormatterOption {
  key: string;
  label: string;
  description: string;
}

/** Campos que todo Brand Template de proposta pode mapear, mesmo sem dataset Canva. */
export const OFFICIAL_CANVA_PROPOSAL_FIELDS = [
  "NOME_EVENTO",
  "DATA_ORCAMENTO",
  "DATA_EVENTO",
  "INO",
  "INA",
  "QUANTIDADE_PESSOAS",
  "DRINKS",
  "BEBIDAS",
  "QTD_BARTENDERS",
  "QTD_COPEIRAS",
  "QTD_BAR_KEEPERS",
  "QUANTIDADE_DRINKS",
  "VALOR_INVESTIMENTO",
  "DATA_FINAL_PAGAMENTO",
  "QUANTIDADE_HORAS_EVENTO",
] as const;

export interface CanvaDatasetField {
  key: string;
  name?: string;
  type?: string;
}

export interface CanvaFieldAudit {
  officialCount: number;
  datasetCount: number;
  configuredMappingCount: number;
  validMappingCount: number;
  missingMappingKeys: string[];
  legacyMappingKeys: string[];
}

/** Normaliza somente para comparação; a chave original continua sendo usada pela API. */
export function normalizeCanvaFieldKey(key: string): string {
  return key
    .trim()
    .replace(/\s*_\s*/g, "_")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Calcula os contadores sem confundir o catálogo local com o Dataset do Canva. */
export function auditCanvaFields(
  dataset: CanvaDatasetField[],
  mappingKeys: string[],
): CanvaFieldAudit {
  const datasetKeys = new Set(dataset.map((field) => normalizeCanvaFieldKey(field.key)));
  const uniqueMappings = new Map(mappingKeys.map((key) => [normalizeCanvaFieldKey(key), key]));
  const legacyMappingKeys = [...uniqueMappings.values()].filter(
    (key) => normalizeCanvaFieldKey(key) === "INICIAIS_NOIVOS",
  );
  const activeMappingKeys = [...uniqueMappings.values()].filter(
    (key) => normalizeCanvaFieldKey(key) !== "INICIAIS_NOIVOS",
  );
  const missingMappingKeys = activeMappingKeys.filter(
    (key) => !datasetKeys.has(normalizeCanvaFieldKey(key)),
  );

  return {
    officialCount: OFFICIAL_CANVA_PROPOSAL_FIELDS.length,
    datasetCount: datasetKeys.size,
    configuredMappingCount: uniqueMappings.size,
    validMappingCount: activeMappingKeys.length - missingMappingKeys.length,
    missingMappingKeys,
    legacyMappingKeys,
  };
}

/** Preserva exatamente os 15 campos oficiais. Extras são exibidos apenas na auditoria. */
export function mergeOfficialCanvaFields(
  dataset: CanvaDatasetField[],
): Required<CanvaDatasetField>[] {
  const canvaByKey = new Map<string, CanvaDatasetField>();
  for (const field of dataset) {
    const normalized = normalizeCanvaFieldKey(field.key);
    if (!canvaByKey.has(normalized)) canvaByKey.set(normalized, field);
  }
  const merged: Required<CanvaDatasetField>[] = OFFICIAL_CANVA_PROPOSAL_FIELDS.map((key) => {
    const metadata = canvaByKey.get(normalizeCanvaFieldKey(key));
    return {
      key: metadata?.key || key,
      name: metadata?.name || key,
      type: metadata?.type || "text",
    };
  });

  return merged;
}

export const PROPOSAL_FORMATTERS: FieldFormatterOption[] = [
  {
    key: "raw",
    label: "Texto Original (Sem formatação)",
    description: "Insere o valor bruto do sistema.",
  },
  {
    key: "currency",
    label: "Moeda (R$ 1.234,56)",
    description: "Formata valores numéricos como reais.",
  },
  { key: "date_short", label: "Data (DD.MM.AAAA)", description: "Exemplo: 20.10.2026" },
  { key: "date_canva", label: "Data Canva (DD.MM.AAAA)", description: "Exemplo: 20.10.2026" },
  { key: "date_long", label: "Data por Extenso", description: "Exemplo: 20 de Outubro de 2026" },
  { key: "integer", label: "Número Inteiro", description: "Remove casas decimais." },
  {
    key: "bullet_list",
    label: "Lista com Marcadores (•)",
    description: "Insere cada item em uma linha com bullet.",
  },
  {
    key: "uppercase",
    label: "TUDO EM MAIÚSCULAS",
    description: "Converte o texto para caixa alta.",
  },
  {
    key: "lowercase",
    label: "tudo em minúsculas",
    description: "Converte o texto para caixa baixa.",
  },
  { key: "yes_no", label: "Sim / Não", description: "Converte booleanos para Sim ou Não." },
];

export const PROPOSAL_FIELD_CATALOG: ProposalCatalogField[] = [
  {
    key: "event.event_name",
    label: "Nome do evento",
    group: "Evento",
    type: "text",
    description: "events.event_name",
    example: "Casamento Ana e Bruno",
  },
  {
    key: "budget.created_at",
    label: "Data do orçamento",
    group: "Orçamento",
    type: "date",
    description: "event_budget_versions.created_at",
    example: "2026-08-19",
  },
  {
    key: "event.date",
    label: "Data do evento",
    group: "Evento",
    type: "date",
    description: "events.date",
    example: "2026-10-20",
  },
  {
    key: "computed.groom_initial",
    label: "Inicial do noivo",
    group: "Campos calculados",
    type: "text",
    description: "Primeira letra útil de events.groom_name",
    example: "B",
  },
  {
    key: "computed.bride_initial",
    label: "Inicial da noiva",
    group: "Campos calculados",
    type: "text",
    description: "Primeira letra útil de events.bride_name",
    example: "A",
  },
  {
    key: "event.guests",
    label: "Quantidade de pessoas",
    group: "Evento",
    type: "number",
    description: "events.guests",
    example: "150",
  },
  {
    key: "budget.selected_drinks",
    label: "Drinks selecionados",
    group: "Drinks",
    type: "list",
    description: "event_budget_versions.selected_drinks.ids hidratados por drinks.nome",
    example: "Moscow Mule",
  },
  {
    key: "budget.beverages",
    label: "Bebidas selecionadas",
    group: "Bebidas",
    type: "list",
    description: "event_budget_versions.beverages",
    example: "Água",
  },
  {
    key: "budget.bartender_quantity",
    label: "Quantidade de Bartenders",
    group: "Equipe",
    type: "number",
    description: "event_budget_versions.bartender_quantity",
    example: "3",
  },
  {
    key: "budget.copeira_quantity",
    label: "Quantidade de Copeiras",
    group: "Equipe",
    type: "number",
    description: "event_budget_versions.copeira_quantity",
    example: "1",
  },
  {
    key: "budget.keeper_quantity",
    label: "Quantidade de Bar Keepers",
    group: "Equipe",
    type: "number",
    description: "event_budget_versions.keeper_quantity",
    example: "2",
  },
  {
    key: "computed.total_drink_varieties",
    label: "Variedades de drinks",
    group: "Cardápio & Bebidas",
    type: "number",
    description: "Quantidade de drinks distintos no cardápio",
    example: "6",
  },
  {
    key: "computed.total_drinks",
    label: "Quantidade total calculada de drinks",
    group: "Orçamento",
    type: "number",
    description: "events.guests × event_budget_versions.drinks_per_person",
    example: "600",
  },
  {
    key: "budget.final_budget_value",
    label: "Valor do investimento",
    group: "Orçamento",
    type: "currency",
    description: "event_budget_versions.final_budget_value (total final persistido)",
    example: "8500",
  },
  {
    key: "computed.final_payment_date",
    label: "Data final para pagamento",
    group: "Campos calculados",
    type: "date",
    description: "events.date menos 7 dias",
    example: "2026-10-13",
  },
  {
    key: "event.duration_hours",
    label: "Duração do evento",
    group: "Evento",
    type: "number",
    description: "events.duration_hours",
    example: "6",
  },
];

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
  "computed.couple_initials": "computed.couple_initials",
} as const;

const VALID_FIELD_KEYS = new Set([
  ...PROPOSAL_FIELD_CATALOG.map((field) => field.key),
  ...Object.keys(LEGACY_SOURCE_ALIASES),
]);
export function isValidSourceFieldKey(key: string): boolean {
  return VALID_FIELD_KEYS.has(key);
}
export function getFieldCatalogItem(key: string): ProposalCatalogField | undefined {
  const canonical = (LEGACY_SOURCE_ALIASES as Record<string, string>)[key] ?? key;
  return PROPOSAL_FIELD_CATALOG.find((field) => field.key === canonical);
}
function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
const OFFICIAL_SOURCES = [
  "event.event_name",
  "budget.created_at",
  "event.date",
  "computed.groom_initial",
  "computed.bride_initial",
  "event.guests",
  "budget.selected_drinks",
  "budget.beverages",
  "budget.bartender_quantity",
  "budget.copeira_quantity",
  "budget.keeper_quantity",
  "computed.total_drink_varieties",
  "budget.final_budget_value",
  "computed.final_payment_date",
  "event.duration_hours",
] as const;
export const OFFICIAL_CANVA_SOURCE_MAP = Object.fromEntries(
  OFFICIAL_CANVA_PROPOSAL_FIELDS.map((key, index) => [key, OFFICIAL_SOURCES[index]]),
) as Record<(typeof OFFICIAL_CANVA_PROPOSAL_FIELDS)[number], (typeof OFFICIAL_SOURCES)[number]>;
export function suggestAutoMatches(
  fields: Array<{ key: string; name?: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    const normalized = normalizeName(field.key);
    const official = OFFICIAL_CANVA_PROPOSAL_FIELDS.find(
      (key) => normalizeName(key) === normalized,
    );
    if (official) {
      result[field.key] = OFFICIAL_CANVA_SOURCE_MAP[official];
      continue;
    }
    const legacy: Record<string, string> = {
      totalvalue: "budget.final_budget_value",
      guests: "event.guests",
      listadrinks: "budget.selected_drinks",
    };
    if (legacy[normalized]) result[field.key] = legacy[normalized];
  }
  return result;
}
