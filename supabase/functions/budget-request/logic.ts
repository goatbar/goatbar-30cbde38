export const DEFAULT_LINK_TTL_DAYS = 14;
export const ALLOWED_EVENT_TYPES = [
  "Casamento",
  "Corporativo",
  "Aniversário",
  "Confraternização",
] as const;
export const ALLOWED_LEAD_SOURCES = [
  "",
  "Instagram",
  "Google",
  "WhatsApp",
  "Indicação",
  "Site",
] as const;

export type LinkState = "ACTIVE" | "INVALID" | "EXPIRED" | "USED" | "CANCELLED";

export interface PublicBudgetPayload {
  client_name: string;
  event_name?: string;
  phone: string;
  email?: string;
  date: string;
  event_time?: string;
  event_location?: string;
  city?: string;
  event_type: string;
  guests: number;
  lead_source?: string;
  referral_name?: string;
  notes?: string;
}

const KEYS = new Set([
  "client_name",
  "event_name",
  "phone",
  "email",
  "date",
  "event_time",
  "event_location",
  "city",
  "event_type",
  "guests",
  "lead_source",
  "referral_name",
  "notes",
]);

const clean = (value: unknown, max: number) =>
  typeof value === "string"
    ? value
        .trim()
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .slice(0, max)
    : "";

export function generateSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getLinkState(link: any, now = new Date()): LinkState {
  if (!link) return "INVALID";
  if (link.status === "USED" || link.used_at || link.event_id) return "USED";
  if (link.status === "CANCELLED" || link.cancelled_at) return "CANCELLED";
  if (link.status === "EXPIRED" || (link.expires_at && new Date(link.expires_at) <= now))
    return "EXPIRED";
  return link.status === "ACTIVE" ? "ACTIVE" : "INVALID";
}

export function validatePublicBudgetPayload(input: unknown): PublicBudgetPayload {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Payload inválido.");
  const raw = input as Record<string, unknown>;
  const extras = Object.keys(raw).filter((key) => !KEYS.has(key));
  if (extras.length) throw new Error(`Campos não permitidos: ${extras.join(", ")}.`);

  const payload: PublicBudgetPayload = {
    client_name: clean(raw.client_name, 120),
    event_name: clean(raw.event_name, 160),
    phone: clean(raw.phone, 24),
    email: clean(raw.email, 160).toLowerCase(),
    date: clean(raw.date, 10),
    event_time: clean(raw.event_time, 8),
    event_location: clean(raw.event_location, 200),
    city: clean(raw.city, 100),
    event_type: clean(raw.event_type, 60),
    guests: Number(raw.guests),
    lead_source: clean(raw.lead_source, 40),
    referral_name: clean(raw.referral_name, 120),
    notes: clean(raw.notes, 1500),
  };
  if (!payload.client_name) throw new Error("Nome do solicitante é obrigatório.");
  if (!/^\+?[0-9 ()-]{8,24}$/.test(payload.phone) || payload.phone.replace(/\D/g, "").length < 10)
    throw new Error("Telefone inválido.");
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
    throw new Error("E-mail inválido.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    Number.isNaN(Date.parse(`${payload.date}T12:00:00Z`))
  )
    throw new Error("Data do evento inválida.");
  if (payload.event_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.event_time))
    throw new Error("Horário inválido.");
  if (!ALLOWED_EVENT_TYPES.includes(payload.event_type as any))
    throw new Error("Tipo de evento inválido.");
  if (!Number.isInteger(payload.guests) || payload.guests < 1 || payload.guests > 10000)
    throw new Error("Quantidade de convidados inválida.");
  if (!ALLOWED_LEAD_SOURCES.includes((payload.lead_source || "") as any))
    throw new Error("Canal de origem inválido.");
  return payload;
}

export function buildNotificationMessage(payload: PublicBudgetPayload, eventUrl?: string): string {
  const date = payload.date.split("-").reverse().join("/");
  const optional = (label: string, value?: string | number) =>
    value === undefined || value === null || String(value).trim() === ""
      ? []
      : [`${label}: ${value}`];
  return [
    "🐐 *Novo orçamento solicitado*",
    "",
    `Cliente: ${payload.client_name}`,
    ...optional("Evento", payload.event_name),
    ...optional("Tipo", payload.event_type),
    `Data: ${date}`,
    ...optional("Horário", payload.event_time),
    `Convidados: ${payload.guests}`,
    ...optional("Local", payload.event_location),
    ...optional("Cidade", payload.city),
    "",
    "O orçamento já foi criado no sistema.",
    ...(eventUrl ? ["", "Abrir orçamento:", eventUrl] : []),
  ].join("\n");
}
