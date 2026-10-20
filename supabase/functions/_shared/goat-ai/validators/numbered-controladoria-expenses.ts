/**
 * Reconhece listas numeradas de gastos da Controladoria antes do roteamento de drinks.
 * Não deduz datas, modalidade ou forma de pagamento não explicitadas.
 */
import { normalizeCurrencyBRL } from "./controladoria-expense-validator.ts";

export type NumberedControladoriaExpense = {
  number: number;
  date?: string;
  description: string;
  category: "Equipe" | "Insumos" | "Operacional" | "Outros";
  amount?: number;
  status?: "Pago" | "Pendente";
  payment_method?: string;
  payment_payer_name?: string;
  payment_hint?: string;
  staff_name?: string;
  items: Array<{product_name: string; quantity: number; unit: string; total_price: number}>;
  open_items: [];
};

function validIsoDate(raw: string): string | undefined {
  const match = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3].length === 2 ? "20" + match[3] : match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return [String(year), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function categoryFromDescription(description: string): NumberedControladoriaExpense["category"] {
  const normalized = description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/mao\s+de\s+obra|equipe|freelancer|diaria|bartender|barman|copeira|garcom/.test(normalized)) return "Equipe";
  if (/insumo|xarope|fruta|bebida|monin|routin|gelo|vodka|gin/.test(normalized)) return "Insumos";
  return "Outros";
}

function parsePayment(raw: string, expense: NumberedControladoriaExpense): void {
  const value = raw.replace(/^["']|["']$/g, "").trim();
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bpessoal\b|\bproprio\b/.test(normalized)) {
    expense.payment_method = "Pessoal";
    const payer = value.match(/\(([^)]+)\)/) || value.match(/pessoal\s*[-–:]?\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]+)$/i);
    if (payer?.[1]) expense.payment_payer_name = payer[1].trim();
  } else if (/\bpix\b/.test(normalized)) {
    expense.payment_method = "PIX Goat";
  } else if (/\bcartao\b|\bcredito\b/.test(normalized)) {
    expense.payment_method = "Cartão de crédito Goat";
  } else {
    // "Goat" é conta/pagador, não identifica se foi PIX ou cartão.
    expense.payment_hint = value;
  }
}

export function parseNumberedControladoriaEntries(text: string): NumberedControladoriaExpense[] {
  const lines = String(text || "").split(/\r?\n/);
  const entries: NumberedControladoriaExpense[] = [];
  let current: NumberedControladoriaExpense | null = null;
  for (const original of lines) {
    const line = original.trim().replace(/^\*+\s*/, "").replace(/\*+\s*$/, "");
    const heading = line.match(/^lan[cç]amento\s+(\d+)\s*[-–—:]\s*(.+)$/i);
    if (heading) {
      const title = heading[2].trim().replace(/:\s*$/, "");
      const date = validIsoDate(title);
      const description = title.replace(/\s*\(\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\s*\)\s*$/, "").trim();
      const category = categoryFromDescription(description);
      const staffName = category === "Equipe"
        ? description.match(/^m[aã]o\s+de\s+obra\s+(.+)$/i)?.[1]?.trim()
        : undefined;
      current = {
        number: Number(heading[1]),
        description, date, category,
        ...(staffName ? { staff_name: staffName } : {}),
        items: [], open_items: [],
      };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    const amount = line.match(/^(?:[-•*]\s*)?valor\s*:\s*(?:R\$\s*)?([\d.,]+)/i);
    if (amount) {
      const value = normalizeCurrencyBRL(amount[1]);
      if (value > 0) current.amount = value;
      continue;
    }
    const status = line.match(/^(?:[-•*]\s*)?status\s*:\s*(.+)$/i);
    if (status) {
      const normalized = status[1].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (/em\s+aberto|pendente|nao\s+pag/.test(normalized)) current.status = "Pendente";
      else if (/\bpag[oa]\b/.test(normalized)) current.status = "Pago";
      continue;
    }
    const payment = line.match(/^(?:[-•*]\s*)?pagamento\s*:\s*(.+)$/i);
    if (payment) parsePayment(payment[1], current);
  }
  if (!entries.length) return [];
  for (const entry of entries) {
    if (entry.amount && entry.category !== "Equipe") {
      entry.items = [{product_name: entry.description, quantity: 1, unit: "un", total_price: entry.amount}];
    }
  }
  return entries;
}

export function numberedExpenseMissingFields(entries: NumberedControladoriaExpense[], modality?: string): string[] {
  const missing: string[] = [];
  if (!modality) missing.push("modality");
  for (const entry of entries) {
    if (!entry.date) missing.push(`date:${entry.number}`);
    if (!entry.amount) missing.push(`amount:${entry.number}`);
    if (!entry.status) missing.push(`status:${entry.number}`);
    if (entry.status === "Pago" && !entry.payment_method) missing.push(`payment_method:${entry.number}`);
    if (entry.status === "Pago" && entry.payment_method === "Pessoal" && !entry.payment_payer_name) missing.push(`payment_payer_name:${entry.number}`);
  }
  return missing;
}

export function updateNumberedExpenseFromReply(entries: NumberedControladoriaExpense[], reply: string): NumberedControladoriaExpense[] {
  const result = entries.map(entry => ({...entry, items: [...entry.items], open_items: [] as []}));
  const norm = String(reply || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hasPix = /\bpix\b/.test(norm);
  const hasCard = /\bcartao\b|\bcredito\b/.test(norm);
  const scopedPayments = Array.from(reply.matchAll(
    /\b(\d{1,2})(?:\s*e\s*(\d{1,2}))?\s*(?:via|foram?|foi|:|-)?\s*(pix|cart[aã]o(?:\s+de\s+cr[eé]dito)?)/gi,
  ));
  for (const match of scopedPayments) {
    const payment = /pix/i.test(match[3]) ? "PIX Goat" : "Cartão de crédito Goat";
    const entryNumbers = [Number(match[1]), ...(match[2] ? [Number(match[2])] : [])];
    for (const entry of result) {
      if (entryNumbers.includes(entry.number) && entry.status === "Pago" && !entry.payment_method) {
        entry.payment_method = payment;
        delete entry.payment_hint;
      }
    }
  }
  // Resposta global "PIX" ou "todos no cartão" corrige os pendentes.
  // Se houver os dois meios na mesma frase sem destinatário inequívoco,
  // não atribuir arbitrariamente um deles aos lançamentos restantes.
  if (scopedPayments.length === 0 && hasPix !== hasCard) {
    const payment = hasPix ? "PIX Goat" : "Cartão de crédito Goat";
    for (const entry of result) {
      if (entry.status === "Pago" && !entry.payment_method) {
        entry.payment_method = payment;
        delete entry.payment_hint;
      }
    }
  }

  const numberedDates = Array.from(reply.matchAll(/lan[cç]amento\s+(\d+)[^\n]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/gi));
  for (const m of numberedDates) {
    const entry = result.find(e => e.number === Number(m[1]));
    const date = validIsoDate(m[2]);
    if (entry && date) entry.date = date;
  }
  const stillMissingDates = result.filter(e => !e.date);
  if (stillMissingDates.length === 1 && numberedDates.length === 0) {
    const date = validIsoDate(reply);
    if (date) stillMissingDates[0].date = date;
  }
  return result;
}

export function formatNumberedControladoriaPreview(entries: NumberedControladoriaExpense[], modality: string): string {
  const lines = [`🧾 *${entries.length} lançamentos na Controladoria*`, `📍 *Modalidade:* ${modality}`, ""];
  for (const entry of entries) {
    const date = entry.date ? entry.date.split("-").reverse().join("/") : "data não informada";
    const amount = entry.amount ? `R$ ${entry.amount.toFixed(2).replace(".", ",")}` : "valor não informado";
    lines.push(`*${entry.number}. ${entry.description}* — ${date} — ${amount}`);
    lines.push(`  ${entry.status === "Pago" ? "✅ Pago" : entry.status === "Pendente" ? "🟠 Em aberto" : "Status não informado"}${entry.status === "Pago" ? ` · ${entry.payment_method === "Pessoal" ? `Pessoal (${entry.payment_payer_name || "pagador não informado"})` : entry.payment_method || entry.payment_hint || "pagamento não informado"}` : ""}`);
    if (entry.staff_name) lines.push(`  👤 Profissional: ${entry.staff_name}`);
  }
  lines.push("", "Confirma estes lançamentos? Responda 'sim' para registrar ou 'cancela' para descartar.");
  return lines.join("\n");
}

export function numberedExpenseMissingQuestion(entries: NumberedControladoriaExpense[], modality?: string): string {
  const missing = numberedExpenseMissingFields(entries, modality);
  const lines = [`Identifiquei ${entries.length} gastos separados. Para preparar a confirmação, preciso apenas de:`];
  if (missing.includes("modality")) lines.push("• A qual modalidade pertencem esses gastos?");
  const missingDates = entries.filter(e => missing.includes(`date:${e.number}`)).map(e => e.number);
  if (missingDates.length) lines.push(`• Qual a data do(s) lançamento(s) ${missingDates.join(", ")}?`);
  const missingPayments = entries.filter(e => missing.includes(`payment_method:${e.number}`) && e.payment_hint?.toLowerCase() === "goat").map(e => e.number);
  if (missingPayments.length) lines.push(`• O pagamento "Goat" dos lançamentos ${missingPayments.join(", ")} foi via PIX Goat ou cartão de crédito Goat?`);
  const remaining = missing.filter(m => !["modality", ...missingDates.map(n => `date:${n}`), ...missingPayments.map(n => `payment_method:${n}`)].includes(m));
  if (remaining.length) lines.push(`• Informar: ${remaining.join(", ")}.`);
  return lines.join("\n");
}
