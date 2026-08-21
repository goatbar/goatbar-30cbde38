import { EventReference, EventMatchResult } from "./types.ts";

export interface DatabaseEvent {
  id: string;
  client_name: string;
  groom_name?: string | null;
  bride_name?: string | null;
  event_name?: string | null;
  date: string;
  event_location?: string | null;
  city?: string | null;
}

export function normalizeStr(str?: string | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractWords(str?: string | null): string[] {
  return normalizeStr(str)
    .split(/[\s,–—\-_/&]+/)
    .filter((w) => w.length > 2);
}

export function matchEventDeterministically(
  events: DatabaseEvent[],
  ref: EventReference,
  rawText = ""
): EventMatchResult {
  if (!events || events.length === 0) {
    return {
      event_id: null,
      confidence: 0,
      reason: "Nenhum evento cadastrado no sistema para correspondência",
    };
  }

  const queryWords = new Set([
    ...extractWords(ref.client_name),
    ...extractWords(ref.groom_name),
    ...extractWords(ref.bride_name),
    ...extractWords(ref.event_name),
    ...extractWords(ref.location),
  ]);

  const rawWords = new Set(extractWords(rawText));

  let bestMatch: DatabaseEvent | null = null;
  let bestScore = 0;
  let bestReason = "Sem correspondência confiável";

  for (const ev of events) {
    let score = 0;
    const reasons: string[] = [];

    const evClientWords = extractWords(ev.client_name);
    const evGroomWords = extractWords(ev.groom_name);
    const evBrideWords = extractWords(ev.bride_name);
    const evNameWords = extractWords(ev.event_name);

    // 1. Check Bride / Groom direct matches
    const hasBrideMatch = evBrideWords.some((w) => queryWords.has(w) || rawWords.has(w));
    const hasGroomMatch = evGroomWords.some((w) => queryWords.has(w) || rawWords.has(w));

    if (hasBrideMatch && hasGroomMatch) {
      score += 0.85;
      reasons.push("Nome dos noivos coincidentes");
    } else if (hasBrideMatch || hasGroomMatch) {
      score += 0.55;
      reasons.push("Nome de um dos noivos coincidente");
    }

    // 2. Check Client Name matches
    const clientMatches = evClientWords.filter((w) => queryWords.has(w) || rawWords.has(w));
    if (clientMatches.length >= 2) {
      score += 0.65;
      reasons.push(`Nome do cliente (${clientMatches.join(" ")})`);
    } else if (clientMatches.length === 1 && !hasBrideMatch && !hasGroomMatch) {
      score += 0.40;
      reasons.push(`Nome aproximado (${clientMatches[0]})`);
    }

    // 3. Check Event Title matches
    const nameMatches = evNameWords.filter((w) => queryWords.has(w) || rawWords.has(w));
    if (nameMatches.length >= 2) {
      score += 0.35;
      reasons.push("Título do evento coincidente");
    }

    // 4. Date Proximity Check
    if (ref.event_date && ev.date) {
      if (ref.event_date === ev.date) {
        score += 0.25;
        reasons.push("Data exata coincidente");
      } else {
        const d1 = new Date(ref.event_date).getTime();
        const d2 = new Date(ev.date).getTime();
        const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) {
          score += 0.15;
          reasons.push("Data próxima (dentro de 7 dias)");
        }
      }
    }

    // Cap score at 0.99
    const finalScore = Math.min(0.99, Number(score.toFixed(2)));
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = ev;
      bestReason = reasons.join(" + ") || "Correspondência semântica";
    }
  }

  // Minimum deterministic threshold for auto-matching (strict production threshold)
  const threshold = AUTO_MATCH_THRESHOLD;

  if (bestMatch && bestScore >= threshold) {
    const displayName = bestMatch.event_name || bestMatch.client_name || "Evento";
    return {
      event_id: bestMatch.id,
      confidence: bestScore,
      reason: bestReason,
      matched_event_name: displayName,
    };
  }

  if (bestMatch && bestScore > 0) {
    return {
      event_id: null,
      confidence: bestScore,
      reason: `Sugestão com confiança moderada/baixa (${(bestScore * 100).toFixed(0)}% < ${(threshold * 100).toFixed(0)}%). Requer revisão e seleção manual.`,
      matched_event_name: bestMatch.event_name || bestMatch.client_name,
    };
  }

  return {
    event_id: null,
    confidence: 0,
    reason: "Nenhum evento correspondente identificado no texto",
  };
}

export const AUTO_MATCH_THRESHOLD = 0.85;
