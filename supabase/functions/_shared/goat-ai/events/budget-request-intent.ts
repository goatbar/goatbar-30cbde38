export function resolveBudgetRequestLinkIntent(message: string): {
  matched: boolean;
  customerNameHint?: string;
} {
  const normalized = message
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const asksLink = /(?:ger[ea]|cri[ae]|manda|envia|preciso|quero).{0,35}\blink\b/.test(normalized);
  const budgetContext = /orcamento|cliente preencher|solicitacao/.test(normalized);
  if (!asksLink || !budgetContext) return { matched: false };
  const hint = message
    .match(/\bpara\s+([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][\p{L}' -]{1,80})\s*[,!.]?$/u)?.[1]
    ?.trim();
  return { matched: true, ...(hint ? { customerNameHint: hint } : {}) };
}
