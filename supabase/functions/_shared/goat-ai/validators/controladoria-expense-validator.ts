export type ControladoriaModality = "Evento" | "Goat Botequim" | "7 Steak House" | "Degustação" | "Ativo";
export type ControladoriaCategory = "Fornecedor" | "Equipe" | "Insumos" | "Operacional" | "Outros";
export type ControladoriaPaymentMethod = "Cartão de crédito Goat" | "PIX Goat" | "Pessoal" | "Interno/Estoque" | "Não informado";
export type ControladoriaEntryType = "Despesa" | "Receita" | "Alocação Interna";
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
  payment_payer_name?: string;
  entry_type?: string;
  tasting_id?: string;
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
  payment_payer_name?: string;
  entry_type: ControladoriaEntryType;
  tasting_id?: string;
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
    return { normalized: "Ativo", displayName: "Ativo", matched: false };
  }

  const clean = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (clean.includes("degust")) return { normalized: "Degustação", displayName: "Degustação", matched: true };
  if (clean.includes("steak") || clean.includes("7steak")) return { normalized: "7 Steak House", displayName: "7 Steak House", matched: true };
  if (clean.includes("botequim")) return { normalized: "Goat Botequim", displayName: "Goat Botequim", matched: true };
  if (clean.includes("evento")) return { normalized: "Evento", displayName: "Evento", matched: true };
  if (clean.includes("ativo") || clean.includes("estoque") || clean.includes("geral") || clean.includes("matriz")) {
    return { normalized: "Ativo", displayName: "Ativo", matched: true };
  }

  return { normalized: "Ativo", displayName: val.trim(), matched: false };
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
export function inferControladoriaPaymentStatusFromText(
  text?: string | null,
): ControladoriaStatus | undefined {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return undefined;

  // Negative / open-payment language must win before any generic "pago" match.
  if (
    /\b(ainda\s+nao\s+(?:foi\s+)?pag[oa]|nao\s+(?:foi\s+)?pag[oa]|nao\s+paguei|nao\s+pagamos|em\s+aberto|pendente|a\s+pagar|falta\s+pagar|aguardando\s+pagamento|sera\s+pag[oa]|vai\s+ser\s+pag[oa])\b/.test(
      normalized,
    )
  ) {
    return "Pendente";
  }

  if (
    /\b(ja\s+(?:foi\s+)?pag[oa]|ja\s+paguei|ja\s+pagamos|pagamento\s+(?:feito|realizado|confirmado)|quitad[oa]|valor\s+pago|pix\s+(?:feito|realizado|pago)|(?:cartao|debito|credito)\s+(?:aprovado|pago|realizado))\b/.test(
      normalized,
    )
  ) {
    return "Pago";
  }

  // Bare "pago/paga" is accepted only after the negative cases above were excluded.
  if (/\bpag[oa]\b/.test(normalized)) return "Pago";

  return undefined;
}

export function normalizeControladoriaPaymentMethod(val?: string | null): ControladoriaPaymentMethod {
  if (!val || typeof val !== "string") return "Não informado";
  const clean = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (clean.includes("pessoal") || clean.includes("proprio") || clean.includes("próprio")) return "Pessoal";
  if (clean.includes("estoque") || clean.includes("intern")) return "Interno/Estoque";
  if (clean.includes("cartao") || clean.includes("credito") || clean.includes("card")) return "Cartão de crédito Goat";
  if (clean.includes("pix")) return "PIX Goat";
  if (clean.includes("nao informado") || clean.includes("não informado") || clean.includes("desconhecido")) return "Não informado";
  return "Não informado";
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

  const isReceiptPurchase = Boolean(
    draft.source_media_id || draft.invoice_url || draft.receipt_url,
  );
  const itemTotalFromDraft = (draft.items || []).reduce((sum, item) => {
    const explicitTotal = normalizeCurrencyBRL(item.total_price);
    if (explicitTotal > 0) return sum + explicitTotal;
    const quantity = Number(item.quantity) || 1;
    const unitPrice = normalizeCurrencyBRL(item.unit_price);
    return sum + quantity * unitPrice;
  }, 0);

  // 1. Amount: on receipt/photo flows derive it from item totals when the
  // document total was not separately readable.
  let amount = normalizeCurrencyBRL(draft.amount);
  if (amount <= 0 && isReceiptPurchase && itemTotalFromDraft > 0) {
    amount = Math.round(itemTotalFromDraft * 100) / 100;
  }
  if (amount <= 0) {
    missingFields.push("amount");
    errors.push("Valor da despesa não identificado ou inválido.");
  } else if (!autoFilledFields.includes("amount") && !manuallyEditedFields.includes("amount")) {
    autoFilledFields.push("amount");
  }

  // 2. Date: for a photo purchase, if the fiscal date is unreadable we use
  // the ingestion date instead of interrogating the user about another field.
  let parsedDate = "";
  if (!draft.date && isReceiptPurchase) {
    parsedDate = new Date().toISOString().slice(0, 10);
  } else if (!draft.date) {
    missingFields.push("date");
  } else {
    parsedDate = normalizeControladoriaDate(draft.date, options?.defaultYear || 2026);
    if (!parsedDate) {
      if (isReceiptPurchase) {
        parsedDate = new Date().toISOString().slice(0, 10);
      } else {
        missingFields.push("date");
      }
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

  // 6. Category: infer primarily from what was purchased, not from supplier.
  const itemNamesHint = (draft.items || []).map((item) => item.product_name || "").join(" ");
  const category = normalizeControladoriaCategory(
    draft.category,
    `${itemNamesHint} ${draft.description || ""} ${supplierName}`,
  );

  // 7. Entry type & payment
  const entryType: ControladoriaEntryType =
    draft.entry_type === "Receita" ? "Receita" :
    draft.entry_type === "Alocação Interna" ? "Alocação Interna" : "Despesa";
  const explicitStatus =
    draft.status === "Pendente" || draft.status === "Pago"
      ? (draft.status as ControladoriaStatus)
      : undefined;
  const status: ControladoriaStatus =
    entryType === "Receita" || entryType === "Alocação Interna"
      ? "Pago"
      : explicitStatus || "Pago";

  const hasExplicitPaymentMethod =
    typeof draft.payment_method === "string" && draft.payment_method.trim().length > 0;
  const paymentMethod = entryType === "Alocação Interna"
    ? "Interno/Estoque"
    : normalizeControladoriaPaymentMethod(draft.payment_method);
  const paymentPayerName = (draft.payment_payer_name || "").trim() || undefined;

  // Despesa em aberto ainda não tem meio de pagamento realizado; não pergunte
  // PIX/cartão/pagador antes de ela ser efetivamente paga.
  if (
    entryType === "Despesa" &&
    status === "Pago" &&
    !hasExplicitPaymentMethod &&
    !isReceiptPurchase
  ) {
    missingFields.push("payment_method");
  }
  if (
    entryType === "Despesa" &&
    status === "Pago" &&
    paymentMethod === "Pessoal" &&
    !paymentPayerName
  ) {
    missingFields.push("payment_payer_name");
  }
  if ((resolvedModality === "Evento" || resolvedModality === "Degustação") && !draft.event_id) {
    missingFields.push("event_id");
  }

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

  if (resolvedModality === "7 Steak House" && isLabor) {
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
    payment_payer_name: paymentPayerName,
    entry_type: entryType,
    tasting_id: draft.tasting_id || undefined,
    status,
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
      ? "7 Steak House"
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

  const isPurchase =
    expense.entry_type === "Despesa" &&
    (Boolean(expense.invoice_url) ||
      expense.items.length > 0 ||
      expense.description.toLowerCase().includes("compra"));

  const lines: string[] = [
    isPurchase ? `🧾 *Compra na Controladoria*` : `🧾 *Lançamento de Gasto na Controladoria*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📍 *Unidade/Destino:* ${modalityDisplay}`,
    `🏷️ *Categoria/Campo:* ${categoryDisplay}`,
  ];

  if (expense.supplier_name && expense.supplier_name !== "Fornecedor não identificado") {
    lines.push(`🏪 *Fornecedor:* ${expense.supplier_name}`);
  }
  if (expense.supplier_cnpj) {
    lines.push(`📄 *CNPJ:* ${expense.supplier_cnpj}`);
  }

  lines.push(
    `📅 *Data:* ${formattedDate}`,
    `💰 *Valor Total:* *${formattedAmount}*`,
  );
  lines.push(
    expense.status === "Pago"
      ? "✅ *Status:* Pago"
      : "🟠 *Status:* Em aberto (Pendente)",
  );
  if (expense.payment_method !== "Não informado" && expense.status === "Pago") {
    lines.push(`💳 *Forma de Pagamento:* ${paymentDisplay}`);
  }
  lines.push(`📝 *Descrição:* ${expense.description}`);

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
    isPurchase
      ? `Posso confirmar esta compra na Controladoria? *(Responda 'sim' para lançar ou 'cancela' para descartar)*`
      : `Posso confirmar o lançamento desse gasto na Controladoria? *(Responda 'sim' para lançar ou 'cancela' para descartar)*`
  );

  return lines.join("\n");
}
