export interface DatabaseEvent {
  id: string;
  client_name: string;
  groom_name?: string | null;
  bride_name?: string | null;
  event_name?: string | null;
  date: string;
  event_location?: string | null;
  city?: string | null;
  guests?: number | null;
}

export interface EventMatchCandidate {
  eventId: string;
  eventName: string;
  date: string;
  clientName: string;
  confidence: number;
  reason: string;
}

export function normalizeStr(str?: string | null): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function extractWords(str?: string | null): string[] {
  return normalizeStr(str)
    .split(/[\s,–—\-_/&]+/)
    .filter((w) => w.length > 2);
}

export function matchEventCandidates(
  events: DatabaseEvent[],
  query: string
): EventMatchCandidate[] {
  if (!events || events.length === 0 || !query.trim()) {
    return [];
  }

  const queryWords = new Set(extractWords(query));
  const candidates: EventMatchCandidate[] = [];

  for (const ev of events) {
    let score = 0;
    const reasons: string[] = [];

    const evClientWords = extractWords(ev.client_name);
    const evGroomWords = extractWords(ev.groom_name);
    const evBrideWords = extractWords(ev.bride_name);
    const evNameWords = extractWords(ev.event_name);
    const evLocationWords = extractWords(ev.event_location);

    const hasBrideMatch = evBrideWords.some((w) => queryWords.has(w));
    const hasGroomMatch = evGroomWords.some((w) => queryWords.has(w));

    if (hasBrideMatch && hasGroomMatch) {
      score += 0.85;
      reasons.push("Nome dos noivos coincidentes");
    } else if (hasBrideMatch || hasGroomMatch) {
      score += 0.60;
      reasons.push("Nome de um dos noivos");
    }

    const clientMatches = evClientWords.filter((w) => queryWords.has(w));
    if (clientMatches.length >= 2) {
      score += 0.70;
      reasons.push(`Nome do cliente (${clientMatches.join(" ")})`);
    } else if (clientMatches.length === 1 && !hasBrideMatch && !hasGroomMatch) {
      score += 0.45;
      reasons.push(`Primeiro nome do cliente (${clientMatches[0]})`);
    }

    const nameMatches = evNameWords.filter((w) => queryWords.has(w));
    if (nameMatches.length >= 1) {
      score += 0.30;
      reasons.push("Palavra-chave no título");
    }

    const locMatches = evLocationWords.filter((w) => queryWords.has(w));
    if (locMatches.length >= 1) {
      score += 0.20;
      reasons.push("Local coincidente");
    }

    // Check direct substring
    const normName = normalizeStr(ev.event_name || ev.client_name);
    const normQuery = normalizeStr(query);
    if (normName.includes(normQuery) || normQuery.includes(normName)) {
      score += 0.35;
    }

    const finalConfidence = Math.min(1, Math.round(score * 100) / 100);

    if (finalConfidence >= 0.35) {
      const displayName = ev.event_name || (ev.groom_name && ev.bride_name ? `Casamento ${ev.bride_name} e ${ev.groom_name}` : ev.client_name);
      candidates.push({
        eventId: ev.id,
        eventName: displayName,
        date: ev.date,
        clientName: ev.client_name,
        confidence: finalConfidence,
        reason: reasons.join(", ") || "Correspondência de texto",
      });
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}
