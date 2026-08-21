import { normalizeStr, extractWords } from "./event-matcher.ts";

export interface UserCandidate {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  confidence: number;
}

export function matchUserByName(
  users: Array<{ id: string; display_name?: string | null; email?: string | null }>,
  query: string
): UserCandidate | null {
  if (!users || users.length === 0 || !query.trim()) return null;

  const queryWords = extractWords(query);
  let bestCandidate: UserCandidate | null = null;
  let bestScore = 0;

  for (const u of users) {
    const name = u.display_name || u.email?.split("@")[0] || "";
    const userWords = extractWords(name);

    let score = 0;
    const matches = userWords.filter((w) => queryWords.includes(w));

    if (matches.length >= 2) {
      score = 0.95;
    } else if (matches.length === 1) {
      score = 0.85;
    } else if (normalizeStr(name).includes(normalizeStr(query)) || normalizeStr(query).includes(normalizeStr(name))) {
      score = 0.75;
    }

    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestCandidate = {
        userId: u.id,
        name,
        email: u.email || undefined,
        confidence: score,
      };
    }
  }

  return bestCandidate;
}
