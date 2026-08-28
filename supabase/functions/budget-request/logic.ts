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
  groom_name?: string;
  bride_name?: string;
  duration_hours: number;
  requested_drink_ids?: string[];
}

export interface PublicDrink {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  ingredients: string[];
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
  "groom_name",
  "bride_name",
  "duration_hours",
  "requested_drink_ids",
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
  if (
    raw.requested_drink_ids !== undefined &&
    (!Array.isArray(raw.requested_drink_ids) ||
      raw.requested_drink_ids.some((id) => typeof id !== "string" || !id.trim()))
  )
    throw new Error("IDs de drinks inválidos.");

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
    groom_name: clean(raw.groom_name, 120),
    bride_name: clean(raw.bride_name, 120),
    duration_hours: Number(raw.duration_hours),
    requested_drink_ids: Array.isArray(raw.requested_drink_ids)
      ? [...new Set(raw.requested_drink_ids.map((id) => clean(id, 120)).filter(Boolean))]
      : [],
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
  if (
    !Number.isInteger(payload.duration_hours) ||
    payload.duration_hours < 1 ||
    payload.duration_hours > 24
  )
    throw new Error("Duração do evento inválida.");
  if ((payload.requested_drink_ids?.length || 0) > 50)
    throw new Error("Quantidade de drinks selecionados inválida.");
  if (payload.event_type === "Casamento") {
    if (!payload.groom_name || !payload.bride_name)
      throw new Error("Nome do noivo e nome da noiva são obrigatórios para casamento.");
    payload.event_name = `${payload.bride_name} & ${payload.groom_name}`;
  } else {
    payload.groom_name = "";
    payload.bride_name = "";
  }
  return payload;
}

export function sanitizePublicDrinks(rows: any[]): PublicDrink[] {
  return rows
    .filter(
      (drink) =>
        drink.show_in_public_menu === true && drink.modality_config?.evento?.active === true,
    )
    .map((drink) => ({
      id: String(drink.id),
      name: String(drink.nome),
      description: drink.descricao ? String(drink.descricao) : null,
      image: drink.imagem ? String(drink.imagem) : null,
      ingredients: Array.isArray(drink.insumos)
        ? drink.insumos.map((item: any) => String(item?.nome || "").trim()).filter(Boolean)
        : [],
    }));
}

export function buildNotificationMessage(payload: PublicBudgetPayload, eventUrl?: string): string {
  const date = payload.date.split("-").reverse().join("/");
  return [
    "🐐 *Novo orçamento solicitado*",
    "",
    `Cliente: ${payload.client_name}`,
    `Evento: ${payload.event_type}`,
    `Data: ${date}`,
    `Convidados: ${payload.guests}`,
    `Local: ${payload.event_location || "A definir"}`,
    "",
    "O orçamento já foi criado no sistema.",
    ...(eventUrl ? ["", "Abrir orçamento:", eventUrl] : []),
  ].join("\n");
}
