import { matchUnitName } from "../matchers/unit-matcher.ts";

export interface RawSalesSessionData {
  unit_name?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  responsible?: string;
  total_amount?: number | string;
  dinheiro?: number | string;
  pix?: number | string;
  debito?: number | string;
  credito?: number | string;
  outros_meios?: number | string;
  taxas?: number | string;
  descontos?: number | string;
  items?: Array<{
    name: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    unit_cost?: number;
  }>;
  labor_value?: number | string;
  notes?: string;
}

export interface NormalizedSalesSession {
  unit_name: string;
  modality: "Goat Botequim" | "7Steakhouse";
  start_date: string;
  end_date?: string;
  responsible: string;
  total_amount: number;
  dinheiro: number;
  pix: number;
  debito: number;
  credito: number;
  outros_meios: number;
  taxas: number;
  descontos: number;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    unit_cost: number;
  }>;
  labor_value: number;
  notes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  normalized?: NormalizedSalesSession;
  warnings: string[];
  missingFields: string[];
  errors: string[];
}

/**
 * Parses numeric strings like "R$ 1.234,56", "1.234,56", "1234.56" to a float number.
 */
export function normalizeCurrency(val: unknown): number {
  if (typeof val === "number") {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  if (!val || typeof val !== "string") return 0;

  const cleaned = val
    .replace(/r\$\s*/gi, "")
    .replace(/\s+/g, "")
    .trim();

  // If format is like 1.234,56 (BR format)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const withoutDots = cleaned.replace(/\./g, "");
    const withDotDecimal = withoutDots.replace(",", ".");
    const num = parseFloat(withDotDecimal);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  // If format is like 1234,56
  if (cleaned.includes(",")) {
    const withDot = cleaned.replace(",", ".");
    const num = parseFloat(withDot);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Normalizes dates to YYYY-MM-DD format.
 */
export function normalizeDate(dateStr?: string, defaultYear = 2026): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    return `${dmyMatch[3]}-${month}-${day}`;
  }

  // DD/MM
  const dmMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    return `${defaultYear}-${month}-${day}`;
  }

  return trimmed;
}

/**
 * Validates extracted fields deterministically in TypeScript code.
 */
export function validateSalesSessionData(raw: RawSalesSessionData): ValidationResult {
  const missingFields: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate Unit
  if (!raw.unit_name) {
    missingFields.push("unit_name");
  }

  const unitInfo = raw.unit_name ? matchUnitName(raw.unit_name) : { unitName: "Unidade não identificada", modality: "Goatbotequim" };
  const dbModality: "Goat Botequim" | "7Steakhouse" =
    unitInfo.modality === "Steakhouse" ? "7Steakhouse" : "Goat Botequim";

  // 2. Validate Date
  const rawDate = raw.start_date || raw.date;
  const normalizedDate = normalizeDate(rawDate);
  if (!normalizedDate) {
    missingFields.push("start_date");
  }

  // 3. Validate Responsible
  const responsible = raw.responsible?.trim() || "";
  if (!responsible) {
    missingFields.push("responsible");
  }

  // 4. Validate Amount
  const totalAmount = normalizeCurrency(raw.total_amount);
  if (totalAmount <= 0) {
    if (raw.total_amount == null) {
      missingFields.push("total_amount");
    } else {
      errors.push("O faturamento total informado deve ser maior que zero.");
    }
  }

  // 5. Normalise Payments Breakdown
  const dinheiro = normalizeCurrency(raw.dinheiro);
  const pix = normalizeCurrency(raw.pix);
  const debito = normalizeCurrency(raw.debito);
  const credito = normalizeCurrency(raw.credito);
  const outrosMeios = normalizeCurrency(raw.outros_meios);
  const taxas = normalizeCurrency(raw.taxas);
  const descontos = normalizeCurrency(raw.descontos);
  const laborValue = normalizeCurrency(raw.labor_value);

  // 6. Mathematical Consistency Check
  const sumPayments = Math.round((dinheiro + pix + debito + credito + outrosMeios) * 100) / 100;
  if (sumPayments > 0 && totalAmount > 0) {
    const diff = Math.round(Math.abs(sumPayments - totalAmount) * 100) / 100;
    if (diff > 1.0) {
      const diffFormatted = diff.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      warnings.push(`A soma das formas de pagamento (R$ ${sumPayments.toFixed(2)}) difere do faturamento total (R$ ${totalAmount.toFixed(2)}) em R$ ${diffFormatted}.`);
    }
  }

  // 7. Normalise Items
  const items = (raw.items || []).map((it) => {
    const qty = Number(it.quantity) || 1;
    const unitPrice = normalizeCurrency(it.unit_price);
    const totalPrice = normalizeCurrency(it.total_price) || Math.round(qty * unitPrice * 100) / 100;
    const unitCost = normalizeCurrency(it.unit_cost);
    return {
      name: it.name || "Item",
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
      unit_cost: unitCost,
    };
  });

  const isValid = missingFields.length === 0 && errors.length === 0;

  const normalized: NormalizedSalesSession = {
    unit_name: unitInfo.unitName,
    modality: dbModality,
    start_date: normalizedDate,
    end_date: raw.end_date ? normalizeDate(raw.end_date) : undefined,
    responsible,
    total_amount: totalAmount,
    dinheiro,
    pix,
    debito,
    credito,
    outros_meios: outrosMeios,
    taxas,
    descontos,
    items,
    labor_value: laborValue,
    notes: raw.notes,
  };

  return {
    isValid,
    normalized: isValid ? normalized : undefined,
    warnings,
    missingFields,
    errors,
  };
}

/**
 * Checks in Supabase database if a session for this modality & date already exists.
 */
export async function checkDuplicateSalesSession(
  supabaseAdmin: any,
  modality: string,
  date: string
): Promise<{ isDuplicate: boolean; existingSessionId?: string; existingTotal?: number }> {
  try {
    const { data: existing, error } = await supabaseAdmin
      .from("financial_sessions")
      .select("id, date, modality, labor_names, financial_session_items(quantity, unit_price)")
      .eq("modality", modality)
      .eq("date", date)
      .limit(1)
      .maybeSingle();

    if (error || !existing) {
      return { isDuplicate: false };
    }

    const items = existing.financial_session_items || [];
    const total = items.reduce(
      (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );

    return {
      isDuplicate: true,
      existingSessionId: existing.id,
      existingTotal: total,
    };
  } catch {
    return { isDuplicate: false };
  }
}

/**
 * Formats a clean, professional preview message for WhatsApp.
 */
export function formatSalesSessionWhatsAppPreview(
  session: NormalizedSalesSession,
  warnings: string[] = [],
  isDuplicate = false
): string {
  const formatBRL = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const dateFormatted = session.start_date.split("-").reverse().join("/");

  const lines: string[] = [];
  lines.push("📋 *Sessão de vendas identificada*");
  lines.push("");
  lines.push(`• *Unidade:* ${session.unit_name}`);
  lines.push(`• *Data:* ${dateFormatted}`);
  lines.push(`• *Faturamento:* ${formatBRL(session.total_amount)}`);
  lines.push(`• *Responsável:* ${session.responsible}`);

  if (session.dinheiro > 0) lines.push(`• *Dinheiro:* ${formatBRL(session.dinheiro)}`);
  if (session.pix > 0) lines.push(`• *Pix:* ${formatBRL(session.pix)}`);
  if (session.debito > 0 || session.credito > 0) {
    const totalCards = session.debito + session.credito;
    lines.push(`• *Cartões:* ${formatBRL(totalCards)} (Déb: ${formatBRL(session.debito)} / Créd: ${formatBRL(session.credito)})`);
  }
  if (session.outros_meios > 0) lines.push(`• *Outros:* ${formatBRL(session.outros_meios)}`);
  if (session.labor_value > 0) lines.push(`• *Mão de Obra:* ${formatBRL(session.labor_value)}`);

  if (session.items.length > 0) {
    lines.push("");
    lines.push(`📦 *Itens listados (${session.items.length}):*`);
    session.items.slice(0, 5).forEach((it) => {
      lines.push(`  - ${it.quantity}x ${it.name} (${formatBRL(it.unit_price || it.total_price / it.quantity)})`);
    });
    if (session.items.length > 5) {
      lines.push(`  - ... e mais ${session.items.length - 5} item(ns)`);
    }
  }

  if (isDuplicate) {
    lines.push("");
    lines.push("⚠️ *Atenção:* Já existe um lançamento registrado para esta mesma unidade e data no sistema.");
  }

  if (warnings.length > 0) {
    lines.push("");
    warnings.forEach((w) => lines.push(`⚠️ ${w}`));
  }

  lines.push("");
  lines.push(isDuplicate ? "*Deseja confirmar e lançar mesmo assim?*" : "*Posso realizar esse lançamento?*");

  return lines.join("\n");
}
