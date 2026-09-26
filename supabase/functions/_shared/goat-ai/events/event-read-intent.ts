import { extractEventDateHint } from "./document-command-intent.ts";

export type EventReadField =
  | "drinks"
  | "budget"
  | "location"
  | "guests"
  | "date_time";

export interface EventReadIntent {
  matched: boolean;
  fields: EventReadField[];
  dateHint?: string;
}

function normalize(value: string) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveEventReadIntent(message: string): EventReadIntent {
  const normalized = normalize(message);

  // Pedidos explícitos de artefato/documento são tratados por outro fluxo.
  const artifactCue = /\b(pdf|arquivo|documento|download)\b/.test(normalized);
  const proposalCue = /\bproposta(?:\s+comercial)?\b/.test(normalized);
  const contractAction =
    /\bcontrato\b/.test(normalized) &&
    /\b(assinatura|assinar|assinafy|dados|formulario)\b/.test(normalized);
  if (artifactCue || proposalCue || contractAction) {
    return { matched: false, fields: [] };
  }

  const fields: EventReadField[] = [];

  if (/\b(drinks?|bebidas?|cardapio|menu)\b/.test(normalized)) {
    fields.push("drinks");
  }

  if (
    /\b(orcamento|valor(?:\s+total)?|preco|quanto\s+(?:ficou|deu|custa|esta))\b/.test(
      normalized,
    )
  ) {
    fields.push("budget");
  }

  if (/\b(local|endereco|cidade|onde)\b/.test(normalized)) {
    fields.push("location");
  }

  if (/\b(convidados?|pessoas?)\b/.test(normalized)) {
    fields.push("guests");
  }

  if (/\b(horario|hora|data\s+do\s+evento|quando)\b/.test(normalized)) {
    fields.push("date_time");
  }

  const unique = Array.from(new Set(fields));
  if (unique.length === 0) return { matched: false, fields: [] };

  const dateHint = extractEventDateHint(message);
  return {
    matched: true,
    fields: unique,
    ...(dateHint ? { dateHint } : {}),
  };
}

function brl(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function dateBr(value: unknown) {
  const raw = String(value || "").slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

export function formatEventReadReply(
  intent: EventReadIntent,
  payload: any,
): string {
  const event = payload?.event || {};
  const budget = payload?.current_budget || {};
  const title = event.event_name || event.client_name || "Evento";
  const lines: string[] = [`*${title}*`];

  if (event.date) {
    lines[0] += ` — ${dateBr(event.date)}`;
  }

  if (intent.fields.includes("drinks")) {
    const drinks = Array.isArray(event.drinks)
      ? event.drinks
      : Array.isArray(payload?.drinks)
        ? payload.drinks
        : [];
    lines.push("");
    lines.push("*Drinks:*");
    if (drinks.length === 0) {
      lines.push("• Nenhum drink encontrado no orçamento atual.");
    } else {
      for (const drink of drinks) {
        if (typeof drink === "string") {
          lines.push(`• ${drink}`);
          continue;
        }
        const name = drink?.name || drink?.nome || drink?.id || "Drink";
        const description = String(drink?.description || drink?.descricao || "").trim();
        lines.push(description ? `• *${name}* — ${description}` : `• ${name}`);
      }
    }
  }

  if (intent.fields.includes("budget")) {
    const total =
      budget.final_budget_value ??
      event.current_budget_value ??
      payload?.current_budget_value;
    const perPerson = budget.average_value_per_person;
    const guests = budget.guest_count ?? event.guests;

    lines.push("");
    lines.push("*Orçamento atual:*");
    if (total != null && brl(total)) lines.push(`• Total: *${brl(total)}*`);
    if (perPerson != null && brl(perPerson)) {
      lines.push(`• Valor médio por pessoa: ${brl(perPerson)}`);
    }
    if (guests != null) lines.push(`• Convidados: ${guests}`);
    if (total == null) lines.push("• Não encontrei um valor de orçamento atual cadastrado.");
  }

  if (intent.fields.includes("location")) {
    lines.push("");
    lines.push("*Local:*");
    const location = event.event_location || event.location || "";
    const city = event.city || "";
    if (location) lines.push(`• ${location}`);
    if (city && !String(location).toLowerCase().includes(String(city).toLowerCase())) {
      lines.push(`• Cidade: ${city}`);
    }
    if (!location && !city) lines.push("• Local não informado no evento.");
  }

  if (intent.fields.includes("guests")) {
    const guests = budget.guest_count ?? event.guests;
    lines.push("");
    lines.push(
      guests != null
        ? `*Convidados:* ${guests}`
        : "*Convidados:* quantidade não informada.",
    );
  }

  if (intent.fields.includes("date_time")) {
    lines.push("");
    const date = event.date ? dateBr(event.date) : "não informada";
    const time = event.event_time || "não informado";
    lines.push(`*Data:* ${date}`);
    lines.push(`*Horário:* ${time}`);
  }

  return lines.join("\n").trim();
}
