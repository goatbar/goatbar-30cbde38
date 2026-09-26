export type EventDocumentCommand =
  | "generate_menu"
  | "generate_proposal"
  | "generate_contract_and_send";

export interface EventDocumentCommandIntent {
  matched: boolean;
  action?: EventDocumentCommand;
  dateHint?: string;
}

function normalize(value: string) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function saoPauloToday(offsetDays = 0): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value || 0);
  const month = Number(parts.find((p) => p.type === "month")?.value || 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || 1);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays, 12));
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function extractEventDateHint(message: string): string | undefined {
  const normalized = normalize(message);

  const iso = normalized.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const fullBr = normalized.match(/\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-](\d{2}|20\d{2})\b/);
  if (fullBr) {
    const year = fullBr[3].length === 2 ? `20${fullBr[3]}` : fullBr[3];
    return `${year}-${fullBr[2].padStart(2, "0")}-${fullBr[1].padStart(2, "0")}`;
  }

  const shortBr = normalized.match(/\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])\b/);
  if (shortBr) {
    const currentYear = saoPauloToday().slice(0, 4);
    return `${currentYear}-${shortBr[2].padStart(2, "0")}-${shortBr[1].padStart(2, "0")}`;
  }

  if (/\bamanha\b/.test(normalized)) return saoPauloToday(1);
  if (/\bhoje\b/.test(normalized)) return saoPauloToday(0);
  return undefined;
}

export function resolveEventDocumentCommandIntent(
  message: string,
): EventDocumentCommandIntent {
  const normalized = normalize(message);

  const actionVerb =
    /\b(gera|gerar|gere|cria|criar|crie|manda|mandar|envia|enviar|mande|envie|quero|preciso|consegue)\b/.test(
      normalized,
    );
  if (!actionVerb) return { matched: false };

  // Dados/formulário do contrato são tratados por um intent próprio e nunca
  // devem cair no envio para assinatura.
  const contractDataContext =
    /\bcontrato|contratual|contratuais\b/.test(normalized) &&
    /\b(dados|formulario|cadastro|contratante|preencher|coleta|solicitacao)\b/.test(normalized) &&
    /\b(link|formulario)\b/.test(normalized);
  if (contractDataContext) return { matched: false };

  const dateHint = extractEventDateHint(message);

  const explicitFileCue = /\b(pdf|arquivo|documento|download|link)\b/.test(normalized);

  // "Me manda os drinks/cardápio" é consulta e deve responder no chat.
  // Só gera artefato quando o usuário pede explicitamente PDF/arquivo/link.
  if (/\b(cardapio|menu)\b/.test(normalized) && explicitFileCue) {
    return { matched: true, action: "generate_menu", ...(dateHint ? { dateHint } : {}) };
  }

  if (/\bproposta(?:\s+comercial)?\b/.test(normalized)) {
    return { matched: true, action: "generate_proposal", ...(dateHint ? { dateHint } : {}) };
  }

  const contractContext = /\bcontrato\b/.test(normalized);
  const signatureContext = /\b(assinatura|assinar|assinafy)\b/.test(normalized);
  if (contractContext && signatureContext) {
    return {
      matched: true,
      action: "generate_contract_and_send",
      ...(dateHint ? { dateHint } : {}),
    };
  }

  return { matched: false };
}
