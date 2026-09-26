import { extractEventDateHint } from "./document-command-intent.ts";

export type EventReadField =
  | "drinks"
  | "budget"
  | "team_budget"
  | "location"
  | "guests"
  | "date_time"
  | "full_summary";

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

  if (
    /\b(informacoes? completas?|detalhes? completos?|resumo completo|tudo do evento|dados completos?)\b/.test(
      normalized,
    )
  ) {
    fields.push("full_summary");
  }

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

  if (
    /\b(equipe|staff|bartenders?|copeir[ao]s?|coopeir[ao]s?|keepers?|bar\s*keepers?|mao\s+de\s+obra)\b/.test(
      normalized,
    )
  ) {
    fields.push("team_budget");
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


function appendTeamBudget(lines: string[], budget: any) {
  const bartenderQty = Number(budget?.bartender_quantity || 0);
  const keeperQty = Number(budget?.keeper_quantity || 0);
  const copeiraQty = Number(budget?.copeira_quantity || 0);

  lines.push("");
  lines.push("*Equipe orçada:*");

  if (bartenderQty > 0) {
    const unit = budget?.bartender_unit_value != null ? brl(budget.bartender_unit_value) : "";
    lines.push(
      unit
        ? `• ${bartenderQty} Bartender${bartenderQty === 1 ? "" : "s"} — ${unit} cada`
        : `• ${bartenderQty} Bartender${bartenderQty === 1 ? "" : "s"}`,
    );
  }

  if (keeperQty > 0) {
    const unit = budget?.keeper_unit_value != null ? brl(budget.keeper_unit_value) : "";
    lines.push(
      unit
        ? `• ${keeperQty} Keeper${keeperQty === 1 ? "" : "s"} — ${unit} cada`
        : `• ${keeperQty} Keeper${keeperQty === 1 ? "" : "s"}`,
    );
  }

  if (copeiraQty > 0) {
    const unit = budget?.copeira_unit_value != null ? brl(budget.copeira_unit_value) : "";
    lines.push(
      unit
        ? `• ${copeiraQty} Copeira${copeiraQty === 1 ? "" : "s"} — ${unit} cada`
        : `• ${copeiraQty} Copeira${copeiraQty === 1 ? "" : "s"}`,
    );
  }

  if (bartenderQty === 0 && keeperQty === 0 && copeiraQty === 0) {
    lines.push("• Nenhuma equipe foi incluída no orçamento atual.");
  }

  if (budget?.team_total_value != null) {
    lines.push(`• Total da equipe: *${brl(budget.team_total_value)}*`);
  }
}

function appendCommercialSummary(lines: string[], event: any, budget: any, payload: any) {
  lines.push("");
  lines.push("*Dados do evento:*");
  if (event.client_name) lines.push(`• Contratante: ${event.client_name}`);
  if (event.event_type) lines.push(`• Tipo: ${event.event_type}`);
  if (event.status) lines.push(`• Status: ${event.status}`);
  if (event.date) lines.push(`• Data: ${dateBr(event.date)}`);
  if (event.event_time) lines.push(`• Horário: ${event.event_time}`);
  if (event.event_location) lines.push(`• Local: ${event.event_location}`);
  if (event.city) lines.push(`• Cidade: ${event.city}`);
  const guests = budget?.guest_count ?? event.guests;
  if (guests != null) lines.push(`• Convidados: ${guests}`);

  lines.push("");
  lines.push("*Orçamento atual:*");
  const total = budget?.final_budget_value ?? event.current_budget_value ?? payload?.current_budget_value;
  if (total != null) lines.push(`• Total: *${brl(total)}*`);
  if (budget?.average_value_per_person != null) {
    lines.push(`• Valor médio por pessoa: ${brl(budget.average_value_per_person)}`);
  }
  if (budget?.drinks_per_person != null) {
    lines.push(`• Drinks por pessoa: ${budget.drinks_per_person}`);
  }
  if (budget?.paid_value != null) lines.push(`• Valor pago: ${brl(budget.paid_value)}`);
  if (budget?.pending_value != null) lines.push(`• Valor pendente: ${brl(budget.pending_value)}`);

  appendTeamBudget(lines, budget);

  if (
    budget?.ice_packages_quantity != null ||
    budget?.ice_total_value != null ||
    budget?.fuel_value != null
  ) {
    lines.push("");
    lines.push("*Gelo e logística:*");
    if (budget?.ice_packages_quantity != null) {
      const unit =
        budget?.ice_package_unit_value != null ? ` — ${brl(budget.ice_package_unit_value)} cada` : "";
      lines.push(`• Gelo: ${budget.ice_packages_quantity} pacote(s)${unit}`);
    }
    if (budget?.ice_total_value != null) {
      lines.push(`• Total gelo: ${brl(budget.ice_total_value)}`);
    }
    if (budget?.fuel_value != null) {
      lines.push(`• Deslocamento/logística: ${brl(budget.fuel_value)}`);
    }
  }

  if (Array.isArray(budget?.beverages) && budget.beverages.length > 0) {
    lines.push("");
    lines.push("*Bebidas base:*");
    for (const beverage of budget.beverages) lines.push(`• ${beverage}`);
  }

  if (Array.isArray(budget?.miscellaneous_items) && budget.miscellaneous_items.length > 0) {
    lines.push("");
    lines.push("*Adicionais:*");
    for (const item of budget.miscellaneous_items) {
      const description = item?.descricao || item?.description || "Item";
      const value = item?.valor ?? item?.value;
      lines.push(value != null ? `• ${description}: ${brl(value)}` : `• ${description}`);
    }
  }

  const drinks = Array.isArray(event.drinks)
    ? event.drinks
    : Array.isArray(payload?.drinks)
      ? payload.drinks
      : [];
  if (drinks.length > 0) {
    lines.push("");
    lines.push("*Drinks:*");
    for (const drink of drinks) {
      const name = typeof drink === "string" ? drink : drink?.name || drink?.nome || drink?.id;
      if (name) lines.push(`• ${name}`);
    }
  }
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

  if (intent.fields.includes("full_summary")) {
    appendCommercialSummary(lines, event, budget, payload);
    return lines.join("\n").trim();
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

  if (intent.fields.includes("team_budget")) {
    appendTeamBudget(lines, budget);
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
