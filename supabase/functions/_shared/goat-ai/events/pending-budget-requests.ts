export interface PendingBudgetRequestsIntent {
  matched: boolean;
}

/** Detects only an explicit request in the current message. */
export function resolvePendingBudgetRequestsIntent(message: string): PendingBudgetRequestsIntent {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const mentionsBudgetRequest =
    /\b(?:solicitacoes?|pedidos?)\s+(?:de\s+)?orcamento\b/.test(normalized) ||
    /\borcamentos?\b/.test(normalized);
  const asksPending = /\b(?:abert[oa]s?|pendent(?:e|es)|nov[oa]s?|chegaram|sem\s+orcamento)\b/.test(normalized);
  return { matched: mentionsBudgetRequest && asksPending };
}

function formatDate(date?: string | null): string {
  if (!date) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function formatPendingBudgetRequestsReply(requests: any[]): string {
  if (requests.length === 0) return "Não há solicitações de orçamento em aberto no momento.";
  const rows = requests.map((request) => {
    const title = request.event_name || request.event_type || "Evento";
    const details = [
      `• ${request.client_name || "Cliente não informado"}`,
      `  ${title} — ${formatDate(request.date)}`,
      `  ${request.guests ?? "Quantidade não informada"} convidados`,
      `  WhatsApp: ${request.phone || "não informado"}`,
    ];
    if (request.event_url) details.push(`  ${request.event_url}`);
    return details.join("\n");
  });
  return `📋 *Solicitações de orçamento em aberto: ${requests.length}*\n\n${rows.join("\n\n")}`;
}
