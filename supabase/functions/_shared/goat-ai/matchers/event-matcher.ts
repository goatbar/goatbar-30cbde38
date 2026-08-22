import { ContextualEvent, RecentEntitiesContext } from "../types.ts";

export interface DatabaseEvent {
  id: string;
  client_name: string;
  groom_name?: string | null;
  bride_name?: string | null;
  event_name?: string | null;
  date: string;
  event_time?: string | null;
  event_location?: string | null;
  city?: string | null;
  event_type?: string | null;
  guests?: number | null;
  status?: string | null;
  current_budget_value?: number | null;
  drinks?: string[] | null;
}

export interface EventMatchCandidate {
  eventId: string;
  eventName: string;
  date: string;
  clientName: string;
  confidence: number;
  reason: string;
  status?: string | null;
  city?: string | null;
  location?: string | null;
  guests?: number | null;
  currentBudgetValue?: number | null;
  drinks?: string[] | null;
}

export interface ContextualEventMatchResult {
  matched: boolean;
  eventId?: string | null;
  event?: ContextualEvent | null;
  matchType?:
    | "explicit_id"
    | "ordinal"
    | "exact_name"
    | "exact_couple"
    | "partial_name"
    | "location_date"
    | "anaphoric_focus"
    | "none";
  confidence: number;
  reason?: string;
  ambiguous?: boolean;
  candidates?: ContextualEvent[];
  disambiguationMessage?: string;
}

export function normalizeStr(str?: string | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "para", "com", "por", "sobre",
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "evento", "eventos", "casamento", "casamentos", "aniversario", "festa", "formatura",
  "drinks", "drink", "bebidas", "bebida", "cardapio", "menu", "lista",
  "orcamento", "orcamentos", "valor", "valores", "custo", "custos", "financeiro",
  "despesa", "despesas", "compra", "compras", "contrato", "dados", "detalhes",
  "informacoes", "informacao", "local", "cidade", "data", "convidados", "status",
  "me", "manda", "mostra", "ve", "veja", "qual", "quais", "quanto", "quantos",
  "tem", "temos", "ver", "saber", "passa", "envia", "diga", "fale", "quero"
]);

export function extractWords(str?: string | null): string[] {
  return normalizeStr(str)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

export function extractMeaningfulWords(str?: string | null): string[] {
  return extractWords(str).filter((w) => !STOP_WORDS.has(w) && w.length >= 2);
}

// Map textual ordinals to 0-based array index
const ORDINAL_MAP: Record<string, number> = {
  "primeiro": 0, "primeira": 0, "1o": 0, "1a": 0, "1º": 0, "1ª": 0, "1°": 0, "1": 0,
  "segundo": 1, "segunda": 1, "2o": 1, "2a": 1, "2º": 1, "2ª": 1, "2°": 1, "2": 1,
  "terceiro": 2, "terceira": 2, "3o": 2, "3a": 2, "3º": 2, "3ª": 2, "3°": 2, "3": 2,
  "quarto": 3, "quarta": 3, "4o": 3, "4a": 3, "4º": 3, "4ª": 3, "4°": 3, "4": 3,
  "quinto": 4, "quinta": 4, "5o": 4, "5a": 4, "5º": 4, "5ª": 4, "5°": 4, "5": 4,
  "sexto": 5, "sexta": 5, "6o": 5, "6a": 5, "6º": 5, "6ª": 5, "6°": 5, "6": 5,
  "setimo": 6, "setima": 6, "7o": 6, "7a": 6, "7º": 6, "7ª": 6, "7°": 6, "7": 6,
  "oitavo": 7, "oitava": 7, "8o": 7, "8a": 7, "8º": 7, "8ª": 7, "8°": 7, "8": 7,
  "nono": 8, "nona": 8, "9o": 8, "9a": 8, "9º": 8, "9ª": 8, "9°": 8, "9": 8,
  "decimo": 9, "decima": 9, "10o": 9, "10a": 9, "10º": 9, "10ª": 9, "10°": 9, "10": 9,
};

export function extractOrdinalIndex(text: string): { index: number; isLast: boolean } | null {
  const norm = normalizeStr(text);

  if (/\b(?:o\s+)?ultimo\b|\b(?:a\s+)?ultima\b/.test(norm)) {
    return { index: -1, isLast: true };
  }

  const patterns = [
    /\b(?:do|da|o|a|no|na|de|em|item|numero|opcao|evento|casamento)\s+(primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|quint[oa]|sext[oa]|setim[oa]|oitav[oa]|non[oa]|decim[oa]|[1-9]|10|[1-9]º|[1-9]ª|[1-9]o|[1-9]a)\b/i,
    /\b(primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|quint[oa]|sext[oa]|setim[oa]|oitav[oa]|non[oa]|decim[oa]|[1-9]º|[1-9]ª|[1-9]o|[1-9]a)\b/i,
  ];

  for (const pat of patterns) {
    const match = norm.match(pat);
    if (match) {
      const token = match[1].toLowerCase().replace(/[ºª°]/g, "o");
      if (ORDINAL_MAP[token] !== undefined) {
        return { index: ORDINAL_MAP[token], isLast: false };
      }
    }
  }

  return null;
}

export function isAnaphoricReference(text: string): boolean {
  const norm = normalizeStr(text);

  const anaphoricPatterns = [
    /\b(?:dela|dele|deles|delas|ela|ele)\b/i,
    /\b(?:desse|deste|nesse|neste|esse|este|aquele|daquele)\s+(?:evento|casamento|orcamento|projeto)\b/i,
    /\b(?:o|do|no)\s+(?:evento|casamento)\b/i,
    /\b(?:e\s+o|e\s+os|e\s+a|e\s+as)\s+(?:drinks|orcamento|valor|local|gastos|despesas|compras|convidados)\b/i,
    /\b(?:qual|quais|quanto|quantos)\s+(?:o|os|a|as)?\s*(?:local|cidade|data|convidados|drinks|orcamento|valor|ficou)\b/i,
    /\b(?:me\s+)?(?:mostra|manda|envia|ve|passa)\s+(?:os\s+drinks|o\s+orcamento|as\s+despesas|os\s+detalhes)\b/i,
    /\b(?:orcamento|drinks|bebidas|cardapio|local|data|convidados|financeiro|despesas)\s*(?:dele|dela|desse|deste)?\b/i,
  ];

  return anaphoricPatterns.some((pat) => pat.test(norm));
}

export function cleanQueryKeywords(text: string): string {
  let norm = normalizeStr(text);

  const prefixes = [
    /^(?:me\s+)?(?:manda|mostra|envia|passa|ve|veja|fala|diga|informe)\s+(?:a\s+lista\s+de\s+|os\s+|o\s+|as\s+|a\s+)?/i,
    /^(?:quero\s+saber\s+|gostaria\s+de\s+ver\s+|preciso\s+de\s+|como\s+esta\s+o\s+|qual\s+o\s+|quais\s+os\s+)/i,
    /^(?:e\s+o\s+do|e\s+o\s+da|e\s+o\s+de|e\s+o|e\s+a\s+do|e\s+a\s+da|e\s+a\s+de|e\s+a|e\s+do|e\s+da|e\s+de)\s+/i,
    /^(?:drinks\s+do|drinks\s+da|drinks\s+de|bebidas\s+do|bebidas\s+da|cardapio\s+do|cardapio\s+da)\s+/i,
    /^(?:casamento\s+do|casamento\s+da|casamento\s+de|evento\s+do|evento\s+da|evento\s+de)\s+/i,
    /^(?:orcamento\s+do|orcamento\s+da|orcamento\s+de|despesas\s+do|despesas\s+da)\s+/i,
  ];

  for (const pref of prefixes) {
    norm = norm.replace(pref, "").trim();
  }

  norm = norm.replace(/\s+(?:drinks|bebidas|cardapio|orcamento|despesas|compras|contrato|local|data)$/i, "").trim();

  return norm;
}

export function formatDisambiguationMessage(entityName: string, candidates: ContextualEvent[]): string {
  const lines: string[] = [];
  const cleanName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
  lines.push(`Encontrei ${candidates.length} eventos para "${cleanName}":`);
  candidates.forEach((c, idx) => {
    const title = c.eventName || c.clientName || "Evento";
    const dateStr = c.date ? ` em ${c.date.split("-").reverse().join("/")}` : "";
    const cityStr = c.city || c.location ? ` (${c.city || c.location})` : "";
    lines.push(`${idx + 1}. ${title}${dateStr}${cityStr}`);
  });
  lines.push(`Qual deles você gostaria de consultar?`);
  return lines.join("\n");
}

export function matchContextualEventReference(
  text: string,
  context?: RecentEntitiesContext | null
): ContextualEventMatchResult {
  if (!text || !text.trim() || !context) {
    return { matched: false, confidence: 0, matchType: "none" };
  }

  const events = context.events || [];
  if (events.length === 0 && !context.lastFocusedEventId) {
    return { matched: false, confidence: 0, matchType: "none" };
  }

  const eventMap = new Map<string, ContextualEvent>();
  events.forEach((e) => eventMap.set(e.eventId, e));

  const normText = normalizeStr(text);

  // 1. Explicit UUID / event_id match
  const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    const rawId = uuidMatch[0];
    const ev = eventMap.get(rawId) || events.find((e) => e.eventId.toLowerCase() === rawId.toLowerCase());
    if (ev) {
      return {
        matched: true,
        eventId: ev.eventId,
        event: ev,
        matchType: "explicit_id",
        confidence: 1.0,
        reason: "UUID explícito correspondente no contexto",
      };
    }
  }

  // 2. Ordinal of last presented list
  const ordinal = extractOrdinalIndex(text);
  if (ordinal) {
    const presentedIds = context.lastPresentedEventIds || events.map((e) => e.eventId);
    if (presentedIds.length > 0) {
      let targetId: string | undefined;
      if (ordinal.isLast) {
        targetId = presentedIds[presentedIds.length - 1];
      } else if (ordinal.index >= 0 && ordinal.index < presentedIds.length) {
        targetId = presentedIds[ordinal.index];
      }

      if (targetId) {
        const ev = eventMap.get(targetId) || events.find((e) => e.eventId === targetId);
        if (ev) {
          return {
            matched: true,
            eventId: ev.eventId,
            event: ev,
            matchType: "ordinal",
            confidence: 0.98,
            reason: `Ordinal correspondente à posição ${ordinal.isLast ? "última" : ordinal.index + 1} da lista apresentada`,
          };
        }
      }
    }
  }

  // 3 & 4. Name, Couple, Partial Name Matching
  const cleanKeywords = cleanQueryKeywords(text);
  const meaningfulWords = extractMeaningfulWords(cleanKeywords);

  if (meaningfulWords.length > 0 || cleanKeywords.length >= 3) {
    const scoredCandidates: Array<{ event: ContextualEvent; score: number; reason: string }> = [];

    for (const ev of events) {
      let score = 0;
      const reasons: string[] = [];

      const normClient = normalizeStr(ev.clientName);
      const normEvent = normalizeStr(ev.eventName);
      const normBride = normalizeStr(ev.brideName);
      const normGroom = normalizeStr(ev.groomName);
      const normCity = normalizeStr(ev.city);
      const normLocation = normalizeStr(ev.location);

      const clientWords = extractWords(ev.clientName);

      // Check couple match: "Lucia e Sidney"
      if (normGroom && normBride) {
        const hasBride = meaningfulWords.some((w) => normBride.includes(w) || w.includes(normBride));
        const hasGroom = meaningfulWords.some((w) => normGroom.includes(w) || w.includes(normGroom));
        if (hasBride && hasGroom) {
          score += 0.95;
          reasons.push("Nome dos noivos coincidentes");
        } else if (hasBride || hasGroom) {
          score += 0.70;
          reasons.push("Nome de um dos noivos");
        }
      }

      // Check exact full client name
      if (normClient && normClient === cleanKeywords) {
        score += 1.0;
        reasons.push("Nome completo exato do cliente");
      } else if (normClient && (normClient.startsWith(cleanKeywords) || cleanKeywords.startsWith(normClient))) {
        score += 0.90;
        reasons.push("Prefixo exato do cliente");
      }

      // Check first + second name: "lucia helena" against "lucia helena de azevedo ribeiro"
      if (clientWords.length >= 2 && meaningfulWords.length >= 2) {
        const matchesClientLeading =
          meaningfulWords[0] === clientWords[0] &&
          meaningfulWords[1] === clientWords[1];
        if (matchesClientLeading) {
          score += 0.90;
          reasons.push(`Primeiro e segundo nome coincidentes (${meaningfulWords[0]} ${meaningfulWords[1]})`);
        }
      }

      // Check individual words matching client words
      const clientMatchedWords = clientWords.filter((cw) => meaningfulWords.some((mw) => mw === cw || (mw.length >= 4 && cw.startsWith(mw))));
      if (clientMatchedWords.length >= 2) {
        score += Math.max(0.80, clientMatchedWords.length * 0.40);
        reasons.push(`Palavras do cliente coincidentes (${clientMatchedWords.join(" ")})`);
      } else if (clientMatchedWords.length === 1) {
        score += 0.65;
        reasons.push(`Nome do cliente coincidente (${clientMatchedWords[0]})`);
      }

      // Check event name / title words
      if (normEvent && normEvent.includes(cleanKeywords)) {
        score += 0.85;
        reasons.push("Título do evento correspondente");
      }

      // Check location / city
      if (normCity && meaningfulWords.some((w) => normCity.includes(w) || w.includes(normCity))) {
        score += 0.50;
        reasons.push("Cidade/Local coincidente");
      }
      if (normLocation && meaningfulWords.some((w) => normLocation.includes(w) || w.includes(normLocation))) {
        score += 0.45;
        reasons.push("Local coincidente");
      }

      // Check date match (e.g. "10/10" or "10/10/2026" or "2026-10-10")
      if (ev.date) {
        const dParts = ev.date.split("-");
        if (dParts.length === 3) {
          const dmy = `${dParts[2]}/${dParts[1]}`;
          const dmyFull = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
          if (normText.includes(dmy) || normText.includes(dmyFull) || normText.includes(ev.date)) {
            score += 0.60;
            reasons.push(`Data coincidente (${ev.date})`);
          }
        }
      }

      if (score >= 0.60) {
        scoredCandidates.push({
          event: ev,
          score: Math.min(1.0, score),
          reason: reasons.join(" + "),
        });
      }
    }

    if (scoredCandidates.length > 0) {
      scoredCandidates.sort((a, b) => b.score - a.score);

      const top = scoredCandidates[0];
      const threshold = 0.60;

      // Check for ambiguity if 2+ candidates score closely
      const closeCandidates = scoredCandidates.filter((c) => c.score >= 0.65 && Math.abs(c.score - top.score) <= 0.15);
      if (closeCandidates.length > 1) {
        const distinctEventCandidates = Array.from(
          new Map(closeCandidates.map((c) => [c.event.eventId, c.event])).values()
        );

        if (distinctEventCandidates.length > 1) {
          const ambigQuery = meaningfulWords.join(" ") || cleanKeywords;
          return {
            matched: false,
            ambiguous: true,
            candidates: distinctEventCandidates,
            disambiguationMessage: formatDisambiguationMessage(ambigQuery, distinctEventCandidates),
            confidence: top.score,
            reason: `Múltiplos eventos compatíveis com '${ambigQuery}' no contexto`,
          };
        }
      }

      if (top.score >= threshold) {
        return {
          matched: true,
          eventId: top.event.eventId,
          event: top.event,
          matchType: top.score >= 0.90 ? "exact_name" : "partial_name",
          confidence: top.score,
          reason: top.reason,
        };
      }
    }
  }

  // 6. Anaphoric / pronoun / demonstrative resolution (lastFocusedEventId or single recent event)
  if (isAnaphoricReference(text)) {
    let focusedEvent: ContextualEvent | undefined;

    if (context.lastFocusedEventId) {
      focusedEvent = eventMap.get(context.lastFocusedEventId) || events.find((e) => e.eventId === context.lastFocusedEventId);
    } else if (events.length === 1) {
      focusedEvent = events[0];
    }

    if (focusedEvent) {
      return {
        matched: true,
        eventId: focusedEvent.eventId,
        event: focusedEvent,
        matchType: "anaphoric_focus",
        confidence: 0.92,
        reason: `Referência anafórica resolvida para o evento atualmente em foco (${focusedEvent.eventName || focusedEvent.clientName})`,
      };
    }
  }

  return {
    matched: false,
    confidence: 0,
    matchType: "none",
  };
}

export function matchEventCandidates(
  events: DatabaseEvent[],
  query: string
): EventMatchCandidate[] {
  if (!events || events.length === 0 || !query || !query.trim()) {
    return [];
  }

  const cleanKeywords = cleanQueryKeywords(query);
  const meaningfulWords = extractMeaningfulWords(cleanKeywords);
  const queryWords = extractWords(query);

  const candidates: EventMatchCandidate[] = [];

  for (const ev of events) {
    let score = 0;
    const reasons: string[] = [];

    const normClient = normalizeStr(ev.client_name);
    const normEvent = normalizeStr(ev.event_name);
    const normGroom = normalizeStr(ev.groom_name);
    const normBride = normalizeStr(ev.bride_name);
    const normCity = normalizeStr(ev.city);
    const normLocation = normalizeStr(ev.event_location);

    const clientWords = extractWords(ev.client_name);
    const brideWords = extractWords(ev.bride_name);
    const groomWords = extractWords(ev.groom_name);
    const eventWords = extractWords(ev.event_name);
    const locationWords = extractWords(ev.event_location);

    // 1. Bride & Groom couple match
    if (normBride || normGroom) {
      const hasBride = brideWords.some((bw) => meaningfulWords.some((mw) => mw === bw || bw.startsWith(mw)));
      const hasGroom = groomWords.some((gw) => meaningfulWords.some((mw) => mw === gw || gw.startsWith(mw)));
      if (hasBride && hasGroom) {
        score += 0.95;
        reasons.push("Nome dos noivos coincidentes");
      } else if (hasBride || hasGroom) {
        score += 0.65;
        reasons.push("Nome de um dos noivos");
      }
    }

    // 2. Full exact client name
    if (normClient && normClient === cleanKeywords) {
      score += 1.0;
      reasons.push("Nome completo exato");
    } else if (normClient && (normClient.startsWith(cleanKeywords) || cleanKeywords.startsWith(normClient))) {
      score += 0.90;
      reasons.push("Prefixo do nome do cliente");
    }

    // 3. First + second name match
    if (clientWords.length >= 2 && meaningfulWords.length >= 2) {
      if (clientWords[0] === meaningfulWords[0] && clientWords[1] === meaningfulWords[1]) {
        score += 0.90;
        reasons.push(`Primeiro e segundo nome (${meaningfulWords[0]} ${meaningfulWords[1]})`);
      }
    }

    // 4. Client word overlap
    const clientMatches = clientWords.filter((cw) =>
      meaningfulWords.some((mw) => mw === cw || (mw.length >= 4 && (cw.startsWith(mw) || mw.startsWith(cw))))
    );
    if (clientMatches.length >= 2) {
      score += Math.max(0.75, clientMatches.length * 0.35);
      reasons.push(`Nome do cliente (${clientMatches.join(" ")})`);
    } else if (clientMatches.length === 1 && score < 0.60) {
      score += 0.60;
      reasons.push(`Primeiro nome do cliente (${clientMatches[0]})`);
    }

    // 5. Title / Event Name match
    if (normEvent && normEvent.includes(cleanKeywords)) {
      score += 0.80;
      reasons.push("Título do evento coincidente");
    } else {
      const nameMatches = eventWords.filter((ew) => meaningfulWords.some((mw) => mw === ew));
      if (nameMatches.length >= 1) {
        score += 0.30;
        reasons.push("Palavra-chave no título");
      }
    }

    // 6. Location / City match
    if (normCity && meaningfulWords.some((mw) => normCity.includes(mw) || mw.includes(normCity))) {
      score += 0.35;
      reasons.push("Cidade coincidente");
    }
    const locMatches = locationWords.filter((lw) => meaningfulWords.some((mw) => mw === lw));
    if (locMatches.length >= 1) {
      score += 0.25;
      reasons.push("Local coincidente");
    }

    // 7. Status match if requested (e.g. "confirmado")
    if (ev.status && queryWords.includes(normalizeStr(ev.status))) {
      score += 0.15;
    }

    const finalConfidence = Math.min(1.0, Math.round(score * 100) / 100);

    // Strict threshold: only return matches with confidence >= 0.40
    if (finalConfidence >= 0.40) {
      const displayName = ev.event_name || (ev.groom_name && ev.bride_name ? `Casamento ${ev.bride_name} e ${ev.groom_name}` : ev.client_name);
      candidates.push({
        eventId: ev.id,
        eventName: displayName,
        date: ev.date,
        clientName: ev.client_name,
        confidence: finalConfidence,
        reason: reasons.join(" + ") || "Correspondência semântica",
        status: ev.status,
        city: ev.city,
        location: ev.event_location,
        guests: ev.guests,
        currentBudgetValue: ev.current_budget_value,
        drinks: ev.drinks,
      });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

