export type ControladoriaModality = "Evento" | "Steakhouse" | "Goatbotequim" | "Geral";
export type ControladoriaCategory = "Fornecedor" | "Equipe" | "Insumos" | "Operacional" | "Outros";
export type ControladoriaPaymentMethod = "PIX" | "Dinheiro" | "Cartao" | "Transferencia" | "Outros";
export type ControladoriaStatus = "Pago" | "Pendente";
export type ControladoriaClassification = "Direto" | "Indireto";
export type ControladoriaReviewStatus = "Lido automaticamente" | "Precisa revisar" | "Erro na leitura";

export interface ControladoriaExpenseItemDraft {
  product_name: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  total_price?: number;
  suggested_category?: string;
  confidence?: number;
}

export interface ControladoriaExpenseDraft {
  operation_id?: string;
  supplier_name?: string;
  supplier_cnpj?: string;
  amount?: number | string;
  date?: string;
  due_date?: string;
  modality?: string;
  category?: string;
  description?: string;
  payment_method?: string;
  status?: string;
  classification?: string;
  event_id?: string;
  responsible?: string;
  items?: ControladoriaExpenseItemDraft[];
  invoice_url?: string;
  receipt_url?: string;
  ocr_raw_text?: string;
  confidence?: number;
  auto_filled_fields?: string[];
  manually_edited_fields?: string[];
  unreadable_fields?: string[];
  source_message_id?: string;
  source_media_id?: string;
}

export interface NormalizedControladoriaExpenseItem {
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  suggested_category?: string;
}

export interface NormalizedControladoriaExpense {
  operation_id: string;
  supplier_name: string;
  supplier_cnpj?: string;
  amount: number;
  date: string;
  due_date?: string;
  modality: ControladoriaModality;
  category: ControladoriaCategory;
  description: string;
  payment_method: ControladoriaPaymentMethod;
  status: ControladoriaStatus;
  classification: ControladoriaClassification;
  event_id?: string;
  responsible: string;
  items: NormalizedControladoriaExpenseItem[];
  invoice_url?: string;
  receipt_url?: string;
  ocr_raw_text?: string;
  review_status: ControladoriaReviewStatus;
  confidence: number;
  auto_filled_fields: string[];
  manually_edited_fields: string[];
  unreadable_fields: string[];
  source_message_id?: string;
  source_media_id?: string;
}

export interface ControladoriaValidationResult {
  isValid: boolean;
  normalized?: NormalizedControladoriaExpense;
  missingFields: string[];
  warnings: string[];
  errors: string[];
  reviewStatus: ControladoriaReviewStatus;
}

/**
 * Normaliza valores monetários no padrão BRL determinístico.
 * "186,40" -> 186.40
 * "R$ 1.250,50" -> 1250.50
 * 186.4 -> 186.40
 */
export function normalizeCurrencyBRL(val: unknown): number {
  if (typeof val === "number") {
    return isNaN(val) || !isFinite(val) ? 0 : Math.round(val * 100) / 100;
  }
  if (!val || typeof val !== "string") return 0;

  const cleaned = val
    .replace(/r\$\s*/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const withoutDots = cleaned.replace(/\./g, "");
    const withDotDecimal = withoutDots.replace(",", ".");
    const num = parseFloat(withDotDecimal);
    return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100) / 100;
  }

  if (cleaned.includes(",")) {
    const withDot = cleaned.replace(",", ".");
    const num = parseFloat(withDot);
    return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100) / 100;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Normaliza datas determinísticas para formato YYYY-MM-DD.
 */
export function normalizeControladoriaDate(dateStr?: string, defaultYear = 2026): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  if (!trimmed) return "";

  // 1. YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. DD/MM/YYYY ou DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    return `${dmyMatch[3]}-${month}-${day}`;
  }

  // 3. DD/MM/YY
  const dmy2Match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2Match) {
    const day = dmy2Match[1].padStart(2, "0");
    const month = dmy2Match[2].padStart(2, "0");
    return `20${dmy2Match[3]}-${month}-${day}`;
  }

  // 4. DD/MM determinístico
  const dmMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    return `${defaultYear}-${month}-${day}`;
  }

  return trimmed;
}

/**
 * Normalização determinística de Modalidade para constraints da tabela financial_expenses.
 * Valores permitidos no banco: 'Evento', 'Steakhouse', 'Goatbotequim', 'Geral'
 */
export function normalizeControladoriaModality(val?: string | null): {
  normalized: ControladoriaModality;
  displayName: string;
  matched: boolean;
} {
  if (!val || typeof val !== "string") {
    return { normalized: "Geral", displayName: "Geral", matched: false };
  }

  const clean = val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (clean.includes("steak") || clean.includes("7steak") || clean.includes("steakhouse")) {
    return { normalized: "Steakhouse", displayName: "7 Steakhouse", matched: true };
  }

  if (clean.includes("botequim") || clean.includes("goatbotequim") || clean.includes("bar")) {
    return { normalized: "Goatbotequim", displayName: "Goat Botequim", matched: true };
  }

  if (clean.includes("evento")) {
    return { normalized: "Evento", displayName: "Evento", matched: true };
  }

  if (clean.includes("geral") || clean.includes("matriz") || clean.includes("administra") || clean.includes("outro")) {
    return { normalized: "Geral", displayName: "Geral", matched: true };
  }

  return { normalized: "Geral", displayName: val.trim(), matched: false };
}

/**
 * Normalização determinística de Categoria para constraints da tabela financial_expenses.
 * Valores permitidos: 'Fornecedor', 'Equipe', 'Insumos', 'Operacional', 'Outros'
 */
export function normalizeControladoriaCategory(val?: string | null, textHint = ""): ControladoriaCategory {
  const target = `${val || ""} ${textHint}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    target.includes("insumo") ||
    target.includes("bebida") ||
    target.includes("vodka") ||
    target.includes("gin") ||
    target.includes("cerveja") ||
    target.includes("energetico") ||
    target.includes("fruta") ||
    target.includes("limao") ||
    target.includes("mercado") ||
    target.includes("supermercado") ||
    target.includes("atacadao") ||
    target.includes("assai") ||
    target.includes("hortifruti")
  ) {
    return "Insumos";
  }

  if (
    target.includes("equipe") ||
    target.includes("freelancer") ||
    target.includes("bartender") ||
    target.includes("barman") ||
    target.includes("garcom") ||
    target.includes("diaria") ||
    target.includes("staff") ||
    target.includes("mao de obra") ||
    target.includes("mão de obra") ||
    /\bmo\b/i.test(target)
  ) {
    return "Equipe";
  }

  if (
    target.includes("operacional") ||
    target.includes("gelo") ||
    target.includes("copo") ||
    target.includes("guardanapo") ||
    target.includes("canudo") ||
    target.includes("descart") ||
    target.includes("transporte") ||
    target.includes("combustivel") ||
    target.includes("gasolina") ||
    target.includes("uber") ||
    target.includes("estacionamento") ||
    target.includes("limpeza") ||
    target.includes("manutencao")
  ) {
    return "Operacional";
  }

  if (
    target.includes("fornecedor") ||
    target.includes("distribuidora") ||
    target.includes("servico") ||
    target.includes("locacao")
  ) {
    return "Fornecedor";
  }

  return "Outros";
}

/**
 * Normalização determinística de Forma de Pagamento para constraints da tabela financial_expenses.
 * Valores permitidos: 'PIX', 'Dinheiro', 'Cartao', 'Transferencia', 'Outros'
 */
export function normalizeControladoriaPaymentMethod(val?: string | null): ControladoriaPaymentMethod {
  if (!val || typeof val !== "string") return "PIX";

  const clean = val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (clean.includes("pix")) return "PIX";
  if (clean.includes("dinheiro") || clean.includes("especie") || clean.includes("cash")) return "Dinheiro";
  if (clean.includes("cartao") || clean.includes("credito") || clean.includes("debito") || clean.includes("card")) return "Cartao";
  if (clean.includes("transfer") || clean.includes("ted") || clean.includes("doc")) return "Transferencia";

  return "Outros";
}

/**
 * Normalização de CNPJ.
 */
export function normalizeCNPJ(val?: string | null): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const digits = val.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return val.trim() || undefined;
}

/**
 * Validação e estruturação de rascunho de despesa da Controladoria.
 */
export function validateControladoriaExpenseDraft(
  draft: ControladoriaExpenseDraft,
  options?: {
    fallbackResponsible?: string;
    defaultYear?: number;
  }
): ControladoriaValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const autoFilledFields: string[] = Array.isArray(draft.auto_filled_fields) ? [...draft.auto_filled_fields] : [];
  const manuallyEditedFields: string[] = Array.isArray(draft.manually_edited_fields) ? [...draft.manually_edited_fields] : [];
  const unreadableFields: string[] = Array.isArray(draft.unreadable_fields) ? [...draft.unreadable_fields] : [];

  // 1. Amount
  const amount = normalizeCurrencyBRL(draft.amount);
  if (amount <= 0) {
    missingFields.push("amount");
    errors.push("Valor da despesa não identificado ou inválido.");
  } else if (!autoFilledFields.includes("amount") && !manuallyEditedFields.includes("amount")) {
    autoFilledFields.push("amount");
  }

  // 2. Date
  let parsedDate = "";
  if (!draft.date) {
    missingFields.push("date");
  } else {
    parsedDate = normalizeControladoriaDate(draft.date, options?.defaultYear || 2026);
    if (!parsedDate) {
      missingFields.push("date");
    } else if (!autoFilledFields.includes("date") && !manuallyEditedFields.includes("date")) {
      autoFilledFields.push("date");
    }
  }

  // 3. Modality (Destino / Unidade)
  const modalityRes = normalizeControladoriaModality(draft.modality);
  let resolvedModality = modalityRes.normalized;
  if (!draft.modality || (!modalityRes.matched && draft.modality.trim().toLowerCase() === "indefinido")) {
    missingFields.push("modality");
  } else if (!autoFilledFields.includes("modality") && !manuallyEditedFields.includes("modality")) {
    autoFilledFields.push("modality");
  }

  // 4. Supplier Name
  const supplierName = (draft.supplier_name || "").trim() || "Fornecedor não identificado";
  if (draft.supplier_name && !autoFilledFields.includes("supplier_name")) {
    autoFilledFields.push("supplier_name");
  }

  // 5. Supplier CNPJ
  const supplierCnpj = normalizeCNPJ(draft.supplier_cnpj);
  if (supplierCnpj && !autoFilledFields.includes("supplier_cnpj")) {
    autoFilledFields.push("supplier_cnpj");
  }

  // 6. Category
  const category = normalizeControladoriaCategory(draft.category, `${supplierName} ${draft.description || ""}`);

  // 7. Payment Method
  const paymentMethod = normalizeControladoriaPaymentMethod(draft.payment_method);

  // 8. Responsible
  const responsible = (draft.responsible || options?.fallbackResponsible || "Sócio Goat Bar").trim();

  // 9. Items
  const normalizedItems: NormalizedControladoriaExpenseItem[] = (draft.items || []).map((it) => ({
    product_name: (it.product_name || "Item").trim(),
    quantity: Number(it.quantity) || 1,
    unit: it.unit?.trim() || "un",
    unit_price: normalizeCurrencyBRL(it.unit_price),
    total_price: normalizeCurrencyBRL(it.total_price) || Math.round((Number(it.quantity || 1) * normalizeCurrencyBRL(it.unit_price)) * 100) / 100,
    suggested_category: it.suggested_category || category,
  }));

  // 10. Description
  let description = (draft.description || "").trim();
  const isLabor =
    category === "Equipe" &&
    (`${draft.category || ""} ${draft.description || ""} ${draft.supplier_name || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes("mao de obra") ||
      /\bmo\b/i.test(`${draft.category || ""} ${draft.description || ""} ${draft.supplier_name || ""}`));

  if (resolvedModality === "Steakhouse" && isLabor) {
    description = "Mão de Obra Semanal";
  } else if (!description) {
    if (normalizedItems.length > 0) {
      const itemsSummary = normalizedItems.map((i) => `${i.quantity}x ${i.product_name}`).slice(0, 3).join(", ");
      description = `Compra de ${supplierName !== "Fornecedor não identificado" ? supplierName : category} (${itemsSummary})`;
    } else {
      const dParts = parsedDate.split("-");
      const fmtDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : parsedDate;
      description = `Despesa via notinha - ${supplierName} - ${fmtDate}`;
    }
  }

  // 11. Operation ID (deterministic or generated)
  const operationId = draft.operation_id || `op_exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // 12. Review Status determination
  let reviewStatus: ControladoriaReviewStatus = "Lido automaticamente";
  const confidence = Number(draft.confidence) || (autoFilledFields.length >= 3 ? 0.85 : 0.5);

  if (missingFields.length > 0 || unreadableFields.length > 0 || errors.length > 0) {
    if (amount <= 0 && !draft.supplier_name && normalizedItems.length === 0) {
      reviewStatus = "Erro na leitura";
    } else {
      reviewStatus = "Precisa revisar";
    }
  } else if (manuallyEditedFields.length > 0 || confidence < 0.75) {
    reviewStatus = "Precisa revisar";
  }

  const isValid = missingFields.length === 0 && amount > 0 && errors.length === 0;

  const normalized: NormalizedControladoriaExpense = {
    operation_id: operationId,
    supplier_name: supplierName,
    supplier_cnpj: supplierCnpj,
    amount,
    date: parsedDate,
    due_date: draft.due_date ? normalizeControladoriaDate(draft.due_date) : undefined,
    modality: resolvedModality,
    category,
    description,
    payment_method: paymentMethod,
    status: draft.status === "Pago" ? "Pago" : "Pendente",
    classification: draft.classification === "Indireto" ? "Indireto" : "Direto",
    event_id: draft.event_id || undefined,
    responsible,
    items: normalizedItems,
    invoice_url: draft.invoice_url,
    receipt_url: draft.receipt_url,
    ocr_raw_text: draft.ocr_raw_text,
    review_status: reviewStatus,
    confidence,
    auto_filled_fields: autoFilledFields,
    manually_edited_fields: manuallyEditedFields,
    unreadable_fields: unreadableFields,
    source_message_id: draft.source_message_id,
    source_media_id: draft.source_media_id,
  };

  return {
    isValid,
    normalized,
    missingFields,
    warnings,
    errors,
    reviewStatus,
  };
}

/**
 * Formata prévia amigável para confirmação no WhatsApp.
 */
export function formatControladoriaExpenseWhatsAppPreview(
  expense: NormalizedControladoriaExpense,
  warnings: string[] = []
): string {
  const dParts = expense.date.split("-");
  const formattedDate = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : expense.date;
  const formattedAmount = `R$ ${expense.amount.toFixed(2).replace(".", ",")}`;

  const modalityDisplay =
    expense.modality === "Steakhouse"
      ? "7 Steakhouse"
      : expense.modality === "Goatbotequim"
        ? "Goat Botequim"
        : expense.modality;

  const paymentDisplay =
    expense.payment_method === "Cartao"
      ? "Cartão"
      : expense.payment_method === "Transferencia"
        ? "Transferência"
        : expense.payment_method;

  const isSteakLabor =
    expense.modality === "Steakhouse" &&
    (expense.description === "Mão de Obra Semanal" ||
      expense.description.toLowerCase().includes("mão de obra") ||
      expense.description.toLowerCase().includes("mao de obra"));

  const categoryDisplay = isSteakLabor ? "Mão de Obra Semanal" : expense.category;

  const lines: string[] = [
    `🧾 *Lançamento de Gasto na Controladoria*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 *Unidade/Destino:* ${modalityDisplay}`,
    `🏷️ *Categoria/Campo:* ${categoryDisplay}`,
    `🏪 *Fornecedor:* ${expense.supplier_name}`,
  ];

  if (expense.supplier_cnpj) {
    lines.push(`📄 *CNPJ:* ${expense.supplier_cnpj}`);
  }

  lines.push(
    `📅 *Data:* ${formattedDate}`,
    `💰 *Valor Total:* *${formattedAmount}*`,
    `💳 *Forma de Pagamento:* ${paymentDisplay}`,
    `📝 *Descrição:* ${expense.description}`
  );

  if (expense.items && expense.items.length > 0) {
    lines.push(``);
    lines.push(`📦 *Itens Identificados (${expense.items.length}):*`);
    expense.items.slice(0, 8).forEach((item) => {
      const unitStr = item.unit ? ` ${item.unit}` : "";
      const priceStr = item.total_price > 0 ? ` = R$ ${item.total_price.toFixed(2).replace(".", ",")}` : "";
      lines.push(`• ${item.quantity}${unitStr} ${item.product_name}${priceStr}`);
    });
    if (expense.items.length > 8) {
      lines.push(`• ... e mais ${expense.items.length - 8} itens`);
    }
  }

  if (warnings.length > 0) {
    lines.push(``);
    warnings.forEach((w) => lines.push(`⚠️ _${w}_`));
  }

  lines.push(
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `Posso confirmar o lançamento desse gasto na Controladoria? *(Responda 'sim' para lançar ou 'cancela' para descartar)*`
  );

  return lines.join("\n");
}
