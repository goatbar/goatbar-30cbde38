/**
 * Brazilian & International Phone Normalization Utility for Goat AI WhatsApp Channel
 *
 * Rules:
 * - Strips whitespace, hyphens, parentheses, dots, pluses, and non-numeric characters.
 * - Handles country code +55 (Brazil) and local DDD (2 digits).
 * - Handles Brazilian 9th digit variations safely (13 digits: 55 + DDD + 9 digits vs 12 digits: 55 + DDD + 8 digits).
 * - Generates all canonical and formatted query candidate variations for indexed SQL lookups.
 * - Avoids insecure loose matching (e.g. endsWith). Requires exact DDD match and strict mobile prefix equivalence.
 */

export interface NormalizedPhone {
  raw: string;
  digits: string;
  isBrazil: boolean;
  ddd?: string;
  localDigits?: string;
  canonicalE164: string;
  canonicalPlain: string;
  variations: string[];
}

export const VALID_BR_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

/**
 * Strips all non-digit characters from a phone string.
 */
export function sanitizeDigits(input?: string | null): string {
  if (!input) return "";
  return input.replace(/\D/g, "");
}

/**
 * Normalizes any phone number into canonical formats and lookup variations.
 */
export function normalizePhoneNumber(input?: string | null): NormalizedPhone {
  const raw = (input || "").trim();
  const digits = sanitizeDigits(raw);

  if (!digits) {
    return {
      raw,
      digits: "",
      isBrazil: false,
      canonicalE164: "",
      canonicalPlain: "",
      variations: [],
    };
  }

  let isBrazil = false;
  let ddd: string | undefined;
  let localDigits: string | undefined;
  const variationsSet = new Set<string>();

  // If raw input exists, include it
  if (raw) {
    variationsSet.add(raw);
  }

  // 1. Check Brazilian number with country code 55 (12 or 13 digits)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const candidateDdd = digits.slice(2, 4);
    if (VALID_BR_DDDS.has(candidateDdd)) {
      isBrazil = true;
      ddd = candidateDdd;
      localDigits = digits.slice(4);
    }
  }

  // 2. Check Brazilian national format without 55 (10 or 11 digits, not explicitly starting with other country code)
  if (!isBrazil && !raw.startsWith("+") && (digits.length === 10 || digits.length === 11)) {
    const candidateDdd = digits.slice(0, 2);
    if (VALID_BR_DDDS.has(candidateDdd)) {
      if (digits.length === 11 && digits[2] === "9") {
        isBrazil = true;
        ddd = candidateDdd;
        localDigits = digits.slice(2);
      } else if (digits.length === 10 && digits[2] >= "2") {
        isBrazil = true;
        ddd = candidateDdd;
        localDigits = digits.slice(2);
      }
    }
  }

  if (isBrazil && ddd && localDigits) {
    let mobile9: string | undefined;
    let mobile8: string | undefined;

    if (localDigits.length === 9) {
      mobile9 = localDigits;
      if (localDigits.startsWith("9")) {
        mobile8 = localDigits.slice(1);
      }
    } else if (localDigits.length === 8) {
      mobile8 = localDigits;
      mobile9 = `9${localDigits}`;
    }

    const canonicalPlain = mobile9 ? `55${ddd}${mobile9}` : `55${ddd}${localDigits}`;
    const canonicalE164 = `+${canonicalPlain}`;

    // Add variations for query candidates (both plain and formatted)
    if (mobile9) {
      const part1 = mobile9.slice(0, 5);
      const part2 = mobile9.slice(5);

      variationsSet.add(`+55${ddd}${mobile9}`);
      variationsSet.add(`55${ddd}${mobile9}`);
      variationsSet.add(`${ddd}${mobile9}`);
      variationsSet.add(`+55 ${ddd} ${part1}-${part2}`);
      variationsSet.add(`+55 (${ddd}) ${part1}-${part2}`);
      variationsSet.add(`+55 ${ddd} ${mobile9}`);
      variationsSet.add(`55 (${ddd}) ${part1}-${part2}`);
      variationsSet.add(`(${ddd}) ${part1}-${part2}`);
      variationsSet.add(`(${ddd}) ${mobile9}`);
      variationsSet.add(`${ddd} ${part1}-${part2}`);
    }

    if (mobile8) {
      const part1 = mobile8.slice(0, 4);
      const part2 = mobile8.slice(4);

      variationsSet.add(`+55${ddd}${mobile8}`);
      variationsSet.add(`55${ddd}${mobile8}`);
      variationsSet.add(`${ddd}${mobile8}`);
      variationsSet.add(`+55 ${ddd} ${part1}-${part2}`);
      variationsSet.add(`+55 (${ddd}) ${part1}-${part2}`);
      variationsSet.add(`+55 ${ddd} ${mobile8}`);
      variationsSet.add(`55 (${ddd}) ${part1}-${part2}`);
      variationsSet.add(`(${ddd}) ${part1}-${part2}`);
      variationsSet.add(`(${ddd}) ${mobile8}`);
      variationsSet.add(`${ddd} ${part1}-${part2}`);
    }

    if (localDigits) {
      variationsSet.add(`+55${ddd}${localDigits}`);
      variationsSet.add(`55${ddd}${localDigits}`);
      variationsSet.add(`${ddd}${localDigits}`);
    }

    // Also include raw sanitized digits
    variationsSet.add(digits);
    variationsSet.add(`+${digits}`);

    return {
      raw,
      digits,
      isBrazil: true,
      ddd,
      localDigits,
      canonicalE164,
      canonicalPlain,
      variations: Array.from(variationsSet),
    };
  }

  // Non-Brazil international number
  const canonicalPlain = digits;
  const canonicalE164 = `+${digits}`;
  variationsSet.add(canonicalE164);
  variationsSet.add(canonicalPlain);

  return {
    raw,
    digits,
    isBrazil: false,
    canonicalE164,
    canonicalPlain,
    variations: Array.from(variationsSet),
  };
}

/**
 * Returns candidate string representations to query against user_messaging_accounts.phone_number or external_user_id.
 */
export function getPhoneLookupCandidates(phone?: string | null): string[] {
  if (!phone) return [];
  const normalized = normalizePhoneNumber(phone);
  return normalized.variations;
}

/**
 * Checks whether two phone representations refer to the exact same phone number,
 * respecting Brazilian 9th-digit equivalences while strictly preventing false positives.
 */
export function arePhoneNumbersEqual(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;

  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);

  if (!normA.digits || !normB.digits) return false;

  // Direct canonical match
  if (normA.canonicalPlain === normB.canonicalPlain) return true;

  // Both are Brazilian numbers: check DDD and 8/9 digit compatibility
  if (normA.isBrazil && normB.isBrazil) {
    if (normA.ddd !== normB.ddd) {
      return false; // Different DDD -> never equal!
    }
    // Check intersection of variations
    const setB = new Set(normB.variations);
    return normA.variations.some((v) => setB.has(v));
  }

  // Non-Brazilian or mixed: must match sanitized digits exactly
  return normA.digits === normB.digits;
}
