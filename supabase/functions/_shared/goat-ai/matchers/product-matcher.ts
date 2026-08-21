import { normalizeStr, extractWords } from "./event-matcher.ts";

export interface ProductMatchResult {
  productId?: string;
  matchedName: string;
  confidence: number;
}

export function matchProductOrDrink(
  inventory: Array<{ id: string; name: string; category?: string }>,
  inputName: string
): ProductMatchResult {
  if (!inventory || inventory.length === 0 || !inputName.trim()) {
    return { matchedName: inputName.trim(), confidence: 0 };
  }

  const queryWords = extractWords(inputName);
  let best: { id: string; name: string } | null = null;
  let bestScore = 0;

  for (const item of inventory) {
    const itemWords = extractWords(item.name);
    let score = 0;

    const matches = itemWords.filter((w) => queryWords.includes(w));
    if (matches.length > 0) {
      score = matches.length / Math.max(itemWords.length, queryWords.length);
    }

    if (normalizeStr(item.name) === normalizeStr(inputName)) {
      score = 1.0;
    } else if (normalizeStr(item.name).includes(normalizeStr(inputName)) || normalizeStr(inputName).includes(normalizeStr(item.name))) {
      score = Math.max(score, 0.85);
    }

    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      best = item;
    }
  }

  if (best) {
    return {
      productId: best.id,
      matchedName: best.name,
      confidence: Math.round(bestScore * 100) / 100,
    };
  }

  return {
    matchedName: inputName.trim(),
    confidence: 0.2,
  };
}
