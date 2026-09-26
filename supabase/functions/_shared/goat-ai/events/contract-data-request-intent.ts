export interface ContractDataRequestLinkIntent {
  matched: boolean;
  dateHint?: string;
}

function normalize(message: string) {
  return String(message || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeDateHint(message: string): string | undefined {
  const iso = message.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const br = message.match(/\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-](\d{2}|20\d{2})\b/);
  if (!br) return undefined;
  const year = br[3].length === 2 ? `20${br[3]}` : br[3];
  return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
}

export function resolveContractDataRequestLinkIntent(
  message: string,
): ContractDataRequestLinkIntent {
  const normalized = normalize(message);

  const asksLinkOrForm =
    /\b(link|formulario)\b/.test(normalized) &&
    /\b(gerar|gera|gere|criar|cria|crie|manda|mandar|envia|enviar|preciso|quero|consegue)\b/.test(normalized);

  const contractContext = /\bcontrato|contratual|contratuais\b/.test(normalized);
  const dataContext = /\b(dados|cadastro|contratante|preencher|coleta|solicitacao)\b/.test(normalized);

  if (!asksLinkOrForm || !contractContext || !dataContext) {
    return { matched: false };
  }

  const dateHint = normalizeDateHint(message);
  return { matched: true, ...(dateHint ? { dateHint } : {}) };
}
