import {
  formatCanvaProposalField,
  formatProposalFieldValue,
  resolveProposalField,
} from "../../../src/lib/proposal-field-resolver.ts";
import {
  formatCustomizedDrinkNames,
  getDrinkCustomizations,
} from "../../../src/lib/drink-customization.ts";
import { normalizeProposalEventType as normalizeEventType } from "../../../src/lib/proposal-template-resolver.ts";

export type Mapping = {
  canva_field_key: string;
  source_type?: string;
  source_field_key?: string | null;
  static_value?: string | null;
  formatter?: string;
  required?: boolean;
};

export class ProposalGenerationError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Safe text capacities of the current "Drinks & Experiências" Brand Template.
 * Canva Autofill accepts only the replacement text; it does not expose the text
 * box bounds or an overflow mode. Keeping this guard here prevents a generated
 * design from silently flowing into the footer/logo reservation.
 */
export const CANVA_MENU_SAFE_LINES: Record<"DRINKS" | "BEBIDAS", number> = {
  DRINKS: 8,
  BEBIDAS: 5,
};

const CANVA_MENU_CHARS_PER_LINE = 34;

export function estimateCanvaMenuLines(text: string): number {
  if (!text.trim()) return 0;
  return text.split("\n").reduce((total, line) => {
    // Include wrapped lines, not just item count: long labels consume more of
    // the fixed-height Canva Data Field and can reach the footer sooner.
    return (
      total + Math.max(1, Math.ceil(Array.from(line.trim()).length / CANVA_MENU_CHARS_PER_LINE))
    );
  }, 0);
}

export function assertCanvaMenuSafeArea(canvaFieldKey: string, text: string) {
  if (canvaFieldKey !== "DRINKS" && canvaFieldKey !== "BEBIDAS") return;
  const capacity = CANVA_MENU_SAFE_LINES[canvaFieldKey];
  const usedLines = estimateCanvaMenuLines(text);
  if (usedLines <= capacity) return;

  throw new ProposalGenerationError(
    "canva_menu_overflow",
    `A lista ${canvaFieldKey} ocupa aproximadamente ${usedLines} linhas, mas a área segura do template comporta ${capacity}. Reduza a lista antes de gerar a proposta para preservar a logo no rodapé.`,
    400,
    { field: canvaFieldKey, used_lines: usedLines, safe_lines: capacity },
  );
}

type DrinkRow = { id: string; nome: string };
type DrinksQueryResult = { data: DrinkRow[] | null; error: any };

function selectedDrinksShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value === "string" ? "string" : "unknown";
}

/** Resolve o formato versionado sem confundir IDs do catálogo com nomes para o Canva. */
export async function resolveSelectedDrinks(
  selectedDrinks: unknown,
  budgetVersionId: string,
  queryDrinks: (ids: string[]) => Promise<DrinksQueryResult>,
): Promise<string[]> {
  const detectedShape = selectedDrinksShape(selectedDrinks);
  let value = selectedDrinks;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new ProposalGenerationError(
        "selected_drinks_invalid",
        "Os dados de drinks desta versão estão em um formato inválido.",
        400,
        {
          details: { budget_version_id: budgetVersionId, detected_shape: detectedShape },
        },
      );
    }
  }

  if (value === null || (!Array.isArray(value) && typeof value !== "object")) {
    throw new ProposalGenerationError(
      "selected_drinks_invalid",
      "Os dados de drinks desta versão estão em um formato inválido.",
      400,
      {
        details: { budget_version_id: budgetVersionId, detected_shape: detectedShape },
      },
    );
  }

  const candidate = Array.isArray(value) ? value : (value as Record<string, unknown>).ids;
  if (!Array.isArray(candidate)) {
    throw new ProposalGenerationError(
      "selected_drinks_invalid",
      "Os dados de drinks desta versão estão em um formato inválido.",
      400,
      {
        details: { budget_version_id: budgetVersionId, detected_shape: detectedShape },
      },
    );
  }
  if (candidate.length === 0) return [];

  // Algumas versões históricas guardavam objetos já hidratados. Eles são snapshots,
  // não são convertidos em IDs nem misturados com budget.beverages.
  const hydratedNames = candidate.map((item) => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const name = record.nome ?? record.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  });
  if (hydratedNames.every((name) => name !== null)) return hydratedNames as string[];

  const ids = candidate.map((item) =>
    typeof item === "string"
      ? item.trim()
      : item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string"
        ? ((item as Record<string, unknown>).id as string).trim()
        : "",
  );
  if (ids.some((id) => !id)) {
    throw new ProposalGenerationError(
      "selected_drinks_invalid",
      "Os dados de drinks desta versão estão em um formato inválido.",
      400,
      {
        details: { budget_version_id: budgetVersionId, detected_shape: detectedShape },
      },
    );
  }

  const uniqueIds = [...new Set(ids)];
  console.info("[canva-generate-proposal][drinks]", {
    stage: "resolve_selected_drinks",
    budget_version_id: budgetVersionId,
    selected_drinks_shape: detectedShape,
    requested_count: uniqueIds.length,
  });
  const { data, error } = await queryDrinks(uniqueIds);
  console.info("[canva-generate-proposal][drinks]", {
    stage: "resolve_selected_drinks_result",
    requested_count: uniqueIds.length,
    found_count: data?.length ?? 0,
    has_query_error: Boolean(error),
    db_code: error?.code ?? null,
  });
  if (error) {
    throw new ProposalGenerationError(
      "drinks_query_failed",
      "Não foi possível carregar os drinks desta versão.",
      500,
      {
        details: {
          budget_version_id: budgetVersionId,
          requested_count: uniqueIds.length,
          db_code: error.code ?? null,
          db_message: error.message ?? null,
        },
      },
    );
  }

  const byId = new Map((data ?? []).map((drink) => [drink.id, drink.nome]));
  const missingIds = uniqueIds.filter((id) => !byId.has(id));
  if (missingIds.length) {
    throw new ProposalGenerationError(
      "drinks_not_found",
      "Alguns drinks desta versão não foram encontrados no cadastro.",
      404,
      {
        details: {
          budget_version_id: budgetVersionId,
          requested_count: uniqueIds.length,
          found_count: uniqueIds.length - missingIds.length,
          missing_ids: missingIds,
        },
      },
    );
  }
  const names = ids
    .map((id) => byId.get(id)!)
    .filter((name) => typeof name === "string" && name.trim());
  return formatCustomizedDrinkNames(ids, names, getDrinkCustomizations(value));
}

export function isEmptyProposalValue(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.every(isEmptyProposalValue);
  return false;
}

export type NormalizedSelectedDrinks = {
  ids: string[];
  hydratedNames: string[];
  isEmpty: boolean;
  isValid: boolean;
  format: "empty" | "ids_object" | "ids_array" | "hydrated_array" | "names_object" | "invalid";
  rawType: string;
  isArray: boolean;
  hasIds: boolean;
  idsCount: number;
  idsTypes: string[];
};

export function normalizeSelectedDrinks(value: unknown): NormalizedSelectedDrinks {
  if (value == null) {
    return {
      ids: [],
      hydratedNames: [],
      isEmpty: true,
      isValid: true,
      format: "empty",
      rawType: value === null ? "null" : "undefined",
      isArray: false,
      hasIds: false,
      idsCount: 0,
      idsTypes: [],
    };
  }

  const rawType = typeof value;
  const isArray = Array.isArray(value);

  if (isArray) {
    if (value.length === 0) {
      return {
        ids: [],
        hydratedNames: [],
        isEmpty: true,
        isValid: true,
        format: "empty",
        rawType,
        isArray: true,
        hasIds: false,
        idsCount: 0,
        idsTypes: [],
      };
    }

    const elementTypes = [...new Set(value.map((v) => (v === null ? "null" : typeof v)))];
    const allStrings = value.every((v) => typeof v === "string");
    if (allStrings) {
      const ids = (value as string[]).map((s) => s.trim()).filter(Boolean);
      return {
        ids,
        hydratedNames: [],
        isEmpty: ids.length === 0,
        isValid: true,
        format: "ids_array",
        rawType,
        isArray: true,
        hasIds: ids.length > 0,
        idsCount: ids.length,
        idsTypes: ["string"],
      };
    }

    const allObjects = value.every((v) => v !== null && typeof v === "object" && !Array.isArray(v));
    if (allObjects) {
      const ids: string[] = [];
      const hydratedNames: string[] = [];
      for (const item of value as Record<string, unknown>[]) {
        const id =
          typeof item.id === "string"
            ? item.id.trim()
            : typeof item.drink_id === "string"
              ? item.drink_id.trim()
              : null;
        if (id) ids.push(id);
        const name =
          typeof item.nome === "string"
            ? item.nome.trim()
            : typeof item.name === "string"
              ? item.name.trim()
              : null;
        if (name) hydratedNames.push(name);
      }
      return {
        ids,
        hydratedNames,
        isEmpty: ids.length === 0 && hydratedNames.length === 0,
        isValid: true,
        format: "hydrated_array",
        rawType,
        isArray: true,
        hasIds: ids.length > 0,
        idsCount: ids.length,
        idsTypes: ids.length > 0 ? ["string"] : [],
      };
    }

    return {
      ids: [],
      hydratedNames: [],
      isEmpty: false,
      isValid: false,
      format: "invalid",
      rawType,
      isArray: true,
      hasIds: false,
      idsCount: 0,
      idsTypes: elementTypes,
    };
  }

  if (rawType === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return {
        ids: [],
        hydratedNames: [],
        isEmpty: true,
        isValid: true,
        format: "empty",
        rawType,
        isArray: false,
        hasIds: false,
        idsCount: 0,
        idsTypes: [],
      };
    }

    if ("ids" in obj) {
      if (Array.isArray(obj.ids)) {
        const idTypes = [...new Set(obj.ids.map((v) => (v === null ? "null" : typeof v)))];
        const ids = obj.ids
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim());
        return {
          ids,
          hydratedNames: [],
          isEmpty: ids.length === 0,
          isValid: true,
          format: "ids_object",
          rawType,
          isArray: false,
          hasIds: ids.length > 0,
          idsCount: ids.length,
          idsTypes: idTypes,
        };
      }
      return {
        ids: [],
        hydratedNames: [],
        isEmpty: false,
        isValid: false,
        format: "invalid",
        rawType,
        isArray: false,
        hasIds: false,
        idsCount: 0,
        idsTypes: [typeof obj.ids],
      };
    }

    if ("names" in obj && Array.isArray(obj.names)) {
      const names = obj.names
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => v.trim());
      return {
        ids: [],
        hydratedNames: names,
        isEmpty: names.length === 0,
        isValid: true,
        format: "names_object",
        rawType,
        isArray: false,
        hasIds: false,
        idsCount: 0,
        idsTypes: [],
      };
    }

    const list = obj.items || obj.drinks;
    if (Array.isArray(list)) {
      return normalizeSelectedDrinks(list);
    }

    if (keys.every((k) => k === "copos" || k === "descricaoBebidas")) {
      return {
        ids: [],
        hydratedNames: [],
        isEmpty: true,
        isValid: true,
        format: "ids_object",
        rawType,
        isArray: false,
        hasIds: false,
        idsCount: 0,
        idsTypes: [],
      };
    }

    return {
      ids: [],
      hydratedNames: [],
      isEmpty: false,
      isValid: false,
      format: "invalid",
      rawType,
      isArray: false,
      hasIds: false,
      idsCount: 0,
      idsTypes: [],
    };
  }

  return {
    ids: [],
    hydratedNames: [],
    isEmpty: false,
    isValid: false,
    format: "invalid",
    rawType,
    isArray: false,
    hasIds: false,
    idsCount: 0,
    idsTypes: [],
  };
}

export type DrinksQueryClient = {
  from(table: string): {
    select(columns: string): {
      in(column: string, values: string[]): Promise<{ data: any[] | null; error: any }>;
    };
  };
};

export async function hydrateBudgetDrinks(
  selectedDrinksRaw: unknown,
  dbClient: DrinksQueryClient,
  context?: { event_id?: string; budget_version_id?: string },
): Promise<{ resolvedDrinkNames: string[]; normalized: NormalizedSelectedDrinks }> {
  const normalized = normalizeSelectedDrinks(selectedDrinksRaw);

  if (!normalized.isValid) {
    console.error("[hydrate_selected_drinks] invalid format", {
      stage: "hydrate_selected_drinks",
      event_id: context?.event_id,
      budget_version_id: context?.budget_version_id,
      selected_drinks_type: normalized.rawType,
      selected_drinks_is_array: normalized.isArray,
      selected_drinks_has_ids: normalized.hasIds,
      selected_drinks_ids_count: normalized.idsCount,
      selected_drinks_ids_types: normalized.idsTypes,
      query_error_code: null,
      query_error_message: "Formato inválido de selected_drinks",
    });
    throw new ProposalGenerationError(
      "selected_drinks_invalid_format",
      "Os drinks desta versão estão em um formato antigo ou inválido.",
      400,
      {
        type: normalized.rawType,
        is_array: normalized.isArray,
        keys:
          selectedDrinksRaw && typeof selectedDrinksRaw === "object"
            ? Object.keys(selectedDrinksRaw as object)
            : [],
      },
    );
  }

  if (normalized.isEmpty) {
    return { resolvedDrinkNames: [], normalized };
  }

  if (normalized.ids.length > 0) {
    const { data: drinkRows, error: drinksError } = await dbClient
      .from("drinks")
      .select("id, nome")
      .in("id", normalized.ids);

    if (drinksError) {
      console.error("[hydrate_selected_drinks] query error", {
        stage: "hydrate_selected_drinks",
        event_id: context?.event_id,
        budget_version_id: context?.budget_version_id,
        selected_drinks_type: normalized.rawType,
        selected_drinks_is_array: normalized.isArray,
        selected_drinks_has_ids: normalized.hasIds,
        selected_drinks_ids_count: normalized.idsCount,
        selected_drinks_ids_types: normalized.idsTypes,
        query_error_code: drinksError.code || null,
        query_error_message: drinksError.message || null,
      });
      throw new ProposalGenerationError(
        "selected_drinks_query_failed",
        "Não foi possível consultar os drinks desta versão.",
        500,
        { query_error_code: drinksError.code },
      );
    }

    const namesById = new Map<string, string>();
    for (const row of drinkRows || []) {
      if (row && typeof row.id === "string" && typeof row.nome === "string") {
        namesById.set(row.id, row.nome);
      }
    }

    const missingIds = normalized.ids.filter((id) => !namesById.has(id));
    if (missingIds.length > 0) {
      console.warn("[hydrate_selected_drinks] drink not found in catalog", {
        stage: "hydrate_selected_drinks",
        event_id: context?.event_id,
        budget_version_id: context?.budget_version_id,
        selected_drinks_type: normalized.rawType,
        selected_drinks_is_array: normalized.isArray,
        selected_drinks_has_ids: normalized.hasIds,
        selected_drinks_ids_count: normalized.idsCount,
        selected_drinks_ids_types: normalized.idsTypes,
        missing_count: missingIds.length,
        query_error_code: null,
        query_error_message: null,
      });
      throw new ProposalGenerationError(
        "selected_drink_not_found",
        "Um ou mais drinks desta versão não existem mais no cadastro.",
        400,
        {
          missing_count: missingIds.length,
          expected_count: normalized.ids.length,
          found_count: (drinkRows || []).length,
        },
      );
    }

    const resolvedDrinkNames = normalized.ids
      .map((id) => namesById.get(id))
      .filter((nome): nome is string => typeof nome === "string" && Boolean(nome.trim()));

    return { resolvedDrinkNames, normalized };
  }

  if (normalized.hydratedNames.length > 0) {
    return { resolvedDrinkNames: normalized.hydratedNames, normalized };
  }

  return { resolvedDrinkNames: [], normalized };
}

export function getMissingCanvaMappingKeys(mappings: Mapping[], datasetKeys: string[]) {
  const available = new Set(datasetKeys);
  return [
    ...new Set(
      mappings
        .filter((mapping) => mapping.canva_field_key !== "INICIAIS_NOIVOS")
        .filter((mapping) => !available.has(mapping.canva_field_key))
        .map((mapping) => mapping.canva_field_key),
    ),
  ];
}

export function normalizeProposalEventType(value: string) {
  return normalizeEventType(value);
}

const LABELS: Record<string, string> = {
  "computed.groom_initial": "Nome do noivo",
  "computed.bride_initial": "Nome da noiva",
};

export function buildAutofillData(
  mappings: Mapping[],
  datasetKeys: string[],
  event: any,
  budget: any,
) {
  const available = new Set(datasetKeys);
  const data: Record<string, { type: "text"; text: string }> = {};
  for (const mapping of mappings) {
    if (mapping.canva_field_key === "INICIAIS_NOIVOS") continue;
    if ((mapping.source_type || "field") === "none") continue;
    if (!available.has(mapping.canva_field_key)) {
      throw new ProposalGenerationError(
        "canva_field_missing",
        `O Brand Template não possui o Data Field "${mapping.canva_field_key}". Atualize o template no Canva ou sincronize os campos.`,
      );
    }
    let raw: any;
    if (mapping.source_type === "static") raw = mapping.static_value;
    else {
      if (!mapping.source_field_key)
        throw new ProposalGenerationError(
          "mapping_incomplete",
          `O Data Field "${mapping.canva_field_key}" não possui uma origem configurada.`,
        );
      raw = resolveProposalField(mapping.source_field_key, {
        event,
        budget,
        hydratedData: { selectedDrinkNames: budget.selectedDrinkNames ?? budget.selected_drinks },
      });
    }
    if (
      mapping.canva_field_key === "QUANTIDADE_DRINKS" ||
      mapping.source_field_key === "computed.total_drinks" ||
      mapping.source_field_key === "computed.total_drink_varieties" ||
      mapping.source_field_key === "budget.total_drinks"
    ) {
      console.log("[canva-generate-proposal] QUANTIDADE_DRINKS audit", {
        mapping_key: mapping.canva_field_key,
        source_key: mapping.source_field_key,
        computed_type: typeof raw,
        computed_valid: typeof raw === "number" && !Number.isNaN(raw),
      });
    }
    if (mapping.required && isEmptyProposalValue(raw)) {
      throw new ProposalGenerationError(
        "required_field_empty",
        `O campo ${mapping.canva_field_key} não possui valor na versão do orçamento selecionada.`,
        400,
        { field: mapping.canva_field_key, source_key: mapping.source_field_key },
      );
    }
    const value =
      mapping.formatter && mapping.formatter !== "raw"
        ? formatProposalFieldValue(raw, mapping.formatter)
        : formatCanvaProposalField(mapping.canva_field_key, raw, mapping.formatter || "raw");
    assertCanvaMenuSafeArea(mapping.canva_field_key, value);
    data[mapping.canva_field_key] = { type: "text", text: value };
  }
  if (!Object.keys(data).length)
    throw new ProposalGenerationError(
      "mapping_incomplete",
      "Nenhum campo Canva foi configurado para geração.",
    );
  return data;
}

export type CanvaPayloadAuditEntry = {
  canva_field_key: string;
  source_type: string;
  source_field_key: string | null;
  value: string;
  status: "filled" | "empty";
};

/** Complete, credential-free inventory of exactly what is sent to Canva. */
export function auditAutofillPayload(
  mappings: Mapping[],
  payload: Record<string, { type: "text"; text: string }>,
): CanvaPayloadAuditEntry[] {
  const mappingByKey = new Map(mappings.map((mapping) => [mapping.canva_field_key, mapping]));
  return Object.entries(payload).map(([canvaFieldKey, field]) => {
    const mapping = mappingByKey.get(canvaFieldKey);
    return {
      canva_field_key: canvaFieldKey,
      source_type: mapping?.source_type || "field",
      source_field_key: mapping?.source_field_key || null,
      value: field.text,
      status: field.text.trim() ? "filled" : "empty",
    };
  });
}

type Fetch = typeof fetch;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SENSITIVE_CANVA_KEYS =
  /^(access_token|refresh_token|authorization|client_secret|token|secret)$/i;
const DIAGNOSTIC_CANVA_KEYS = /(quota|entitlement|plan|workspace|team|account)/i;
const QUOTA_CANVA_PATTERN =
  /(autofill.{0,40}(quota|limit)|(quota|limit).{0,40}autofill|quota[_ -]?exceeded)/i;

/** Preserve Canva diagnostics while ensuring credentials can never cross the API boundary. */
export function redactCanvaResponse(value: any): any {
  if (Array.isArray(value)) return value.map(redactCanvaResponse);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      SENSITIVE_CANVA_KEYS.test(key) ? "[REDACTED]" : redactCanvaResponse(child),
    ]),
  );
}

function findString(value: any, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && typeof child === "string") return child;
    const nested = findString(child, keys);
    if (nested) return nested;
  }
  return undefined;
}

export function collectDiagnosticFields(value: any, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return [
    ...new Set(
      Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return [
          ...(DIAGNOSTIC_CANVA_KEYS.test(key) ? [path] : []),
          ...collectDiagnosticFields(child, path),
        ];
      }),
    ),
  ];
}

export function extractCanvaQuotaError(
  status: number,
  body: any,
  responseHeaders?: Headers,
): ProposalGenerationError | null {
  const code = body?.code || body?.error?.code || findString(body, ["code", "error_code"]) || "";
  const message = body?.message || body?.error?.message || findString(body, ["message"]) || "";
  const upsellUrl =
    body?.upsell_url ||
    body?.upsellUrl ||
    body?.error?.upsell_url ||
    body?.error?.upsellUrl ||
    findString(body, ["upsell_url", "upsellUrl"]) ||
    null;

  // HTTP 429 also means transient request rate limiting. It is not, by itself,
  // evidence that an Autofill entitlement/quota was exhausted.
  const isQuota =
    code === "quota_exceeded" ||
    code === "autofill_quota_exceeded" ||
    QUOTA_CANVA_PATTERN.test(`${code} ${message}`);

  if (isQuota) {
    const details = redactCanvaResponse(body);
    const requestId =
      responseHeaders?.get("x-request-id") ||
      responseHeaders?.get("x-trace-id") ||
      responseHeaders?.get("trace-id") ||
      findString(details, ["request_id", "requestId", "trace_id", "traceId"]);
    return new ProposalGenerationError(
      "canva_autofill_quota_exceeded",
      "A cota de Autofill do Canva foi atingida.",
      status || 429,
      {
        code: "canva_autofill_quota_exceeded",
        message: "A cota de Autofill do Canva foi atingida.",
        upsell_url: upsellUrl,
        canva_message: message || undefined,
        canva_details: { ...details, ...(requestId ? { request_id: requestId } : {}) },
      },
    );
  }
  return null;
}

function getCanvaRequestId(headers: Headers, body: any): string | undefined {
  return (
    headers.get("x-request-id") ||
    headers.get("x-correlation-id") ||
    headers.get("x-trace-id") ||
    headers.get("trace-id") ||
    findString(body, [
      "request_id",
      "requestId",
      "correlation_id",
      "correlationId",
      "trace_id",
      "traceId",
    ])
  );
}

async function jsonRequest(
  fetcher: Fetch,
  url: string,
  token: string,
  init?: RequestInit,
  stage = "canva_api",
) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const safeBody = redactCanvaResponse(body);
    const canvaCode = body?.code || body?.error?.code || findString(body, ["code", "error_code"]);
    const canvaMessage = body?.message || body?.error?.message || findString(body, ["message"]);
    const responseHeaders = response.headers || new Headers();
    const requestId = getCanvaRequestId(responseHeaders, safeBody);
    console.error("[canva-generate-proposal][canva-api-error]", {
      stage,
      endpoint: new URL(url).pathname,
      method: init?.method || "GET",
      http_status: response.status,
      error_code: canvaCode || null,
      message: canvaMessage || null,
      request_id: requestId || null,
      retry_after: responseHeaders.get("retry-after"),
      diagnostic_fields: collectDiagnosticFields(safeBody),
      response: safeBody,
    });
    const quotaError = extractCanvaQuotaError(response.status, body, responseHeaders);
    if (quotaError) throw quotaError;
    if (response.status === 429) {
      throw new ProposalGenerationError(
        "canva_rate_limited",
        "O Canva limitou temporariamente a frequência de requisições. Tente novamente em instantes.",
        429,
        {
          code: "canva_rate_limited",
          canva_message: canvaMessage,
          canva_details: { ...safeBody, ...(requestId ? { request_id: requestId } : {}) },
          retry_after: responseHeaders.get("retry-after"),
        },
      );
    }
    throw new Error(
      `Canva HTTP ${response.status}: ${body?.message || body?.error?.message || "erro desconhecido"}`,
    );
  }
  return body;
}

async function pollJob(
  fetcher: Fetch,
  url: string,
  token: string,
  failureCode: string,
  sleep = wait,
  stage = "canva_job",
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const body = await jsonRequest(fetcher, url, token, undefined, stage);
    const job = body.job || body;
    if (job.status === "success") return job;
    if (job.status === "failed") {
      const safeError = redactCanvaResponse(job.error || job);
      console.error("[canva-generate-proposal][canva-job-error]", {
        stage,
        endpoint: new URL(url).pathname,
        http_status: 200,
        error_code: findString(safeError, ["code", "error_code"]) || null,
        message: findString(safeError, ["message"]) || null,
        request_id:
          findString(safeError, [
            "request_id",
            "requestId",
            "correlation_id",
            "correlationId",
            "trace_id",
            "traceId",
          ]) || null,
        diagnostic_fields: collectDiagnosticFields(safeError),
        response: safeError,
      });
      const quotaError = extractCanvaQuotaError(0, job.error || job);
      if (quotaError) throw quotaError;
      throw new ProposalGenerationError(
        failureCode,
        `O job do Canva falhou: ${job.error?.message || "sem detalhes"}`,
        502,
      );
    }
    await sleep(Math.min(500 + attempt * 250, 2000));
  }
  throw new ProposalGenerationError(failureCode, "Tempo limite aguardando o Canva.", 504);
}

export async function autofillAndExportPdf(args: {
  token: string;
  brandTemplateId: string;
  data: Record<string, any>;
  fetcher?: Fetch;
  sleep?: (ms: number) => Promise<any>;
}) {
  const fetcher = args.fetcher || fetch;
  let autofill: any;
  try {
    const created = await jsonRequest(
      fetcher,
      "https://api.canva.com/rest/v1/autofills",
      args.token,
      {
        method: "POST",
        body: JSON.stringify({ brand_template_id: args.brandTemplateId, data: args.data }),
      },
      "canva_autofill_create",
    );
    autofill = await pollJob(
      fetcher,
      `https://api.canva.com/rest/v1/autofills/${encodeURIComponent(created.job.id)}`,
      args.token,
      "canva_autofill_failed",
      args.sleep,
      "canva_autofill_poll",
    );
  } catch (error) {
    if (error instanceof ProposalGenerationError) throw error;
    throw new ProposalGenerationError("canva_autofill_failed", String(error), 502);
  }
  const designId = autofill.result?.design?.id;
  if (!designId)
    throw new ProposalGenerationError(
      "canva_autofill_failed",
      "O Canva não retornou o design gerado.",
      502,
    );
  try {
    const created = await jsonRequest(
      fetcher,
      "https://api.canva.com/rest/v1/exports",
      args.token,
      { method: "POST", body: JSON.stringify({ design_id: designId, format: { type: "pdf" } }) },
      "canva_export_create",
    );
    const exported = await pollJob(
      fetcher,
      `https://api.canva.com/rest/v1/exports/${encodeURIComponent(created.job.id)}`,
      args.token,
      "canva_export_failed",
      args.sleep,
      "canva_export_poll",
    );
    const downloadUrl = exported.urls?.[0];
    if (!downloadUrl) throw new Error("URL do PDF ausente");
    return { designId, downloadUrl, autofillJobId: autofill.id, exportJobId: exported.id };
  } catch (error) {
    if (error instanceof ProposalGenerationError) throw error;
    throw new ProposalGenerationError("canva_export_failed", String(error), 502);
  }
}

export function validatePdfBytes(pdf: Uint8Array): void {
  if (!pdf || !pdf.length || pdf.length < 4) {
    throw new ProposalGenerationError(
      "pdf_invalid",
      "O arquivo exportado pelo Canva está vazio ou corrompido.",
      502,
    );
  }
  const magic = new TextDecoder().decode(pdf.subarray(0, 4));
  if (magic !== "%PDF") {
    throw new ProposalGenerationError(
      "pdf_invalid",
      "O arquivo retornado pelo Canva não é um documento PDF válido.",
      502,
    );
  }
}

export function buildDeterministicStoragePath(
  eventId: string,
  budgetVersionId: string,
  proposalId: string,
  filename: string,
): string {
  // Keep the existing proposal-id collision strategy while giving the object
  // the same human-readable basename delivered to the user.
  return `events/${eventId}/budgets/${budgetVersionId}/proposals/${proposalId}/${filename}`;
}

export async function uploadPdfToStorage(
  storageClient: any,
  bucketName: string,
  storagePath: string,
  pdfBytes: Uint8Array,
): Promise<{ error: any }> {
  let { error: uploadError } = await storageClient.from(bucketName).upload(storagePath, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });

  // If bucket does not exist, attempt creation and retry upload
  if (
    uploadError &&
    (uploadError.message?.toLowerCase().includes("bucket not found") ||
      (uploadError as any).statusCode === "404" ||
      (uploadError as any).status === 404)
  ) {
    console.warn(`[storage] Bucket '${bucketName}' not found. Attempting creation...`);
    const { error: createError } = await storageClient.createBucket(bucketName, {
      public: true,
    });
    if (!createError || createError.message?.toLowerCase().includes("already exists")) {
      const retryResult = await storageClient.from(bucketName).upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      uploadError = retryResult.error;
    }
  }

  return { error: uploadError };
}
