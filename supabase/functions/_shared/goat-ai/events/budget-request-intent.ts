export function resolveBudgetRequestLinkIntent(message: string): {
  matched: boolean;
  customerNameHint?: string;
} {
  const normalized = message
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const asksLink = /(?:ger[ea]|cri[ae]|manda|envia|preciso|quero).{0,35}\blink\b/.test(normalized);

  // "Solicitação" sozinha nunca é suficiente para classificar como orçamento.
  // Pedidos de coleta/formulário de dados contratuais pertencem ao fluxo de contrato.
  const contractDataContext =
    /\bcontrato\b/.test(normalized) &&
    /\b(dados|formulario|cadastro|contratante|preencher)\b/.test(normalized);
  if (contractDataContext) return { matched: false };

  const budgetContext =
    /\borcamento\b/.test(normalized) ||
    /\b(?:novo|solicitar|pedido|solicitacao)\s+(?:de\s+)?orcamento\b/.test(normalized) ||
    /\bcliente\s+preencher\b/.test(normalized);
  if (!asksLink || !budgetContext) return { matched: false };
  const hint = message
    .match(/\bpara\s+([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][\p{L}' -]{1,80})\s*[,!.]?$/u)?.[1]
    ?.trim();
  return { matched: true, ...(hint ? { customerNameHint: hint } : {}) };
}
