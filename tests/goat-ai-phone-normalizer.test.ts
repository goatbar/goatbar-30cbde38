import { describe, it, expect } from "vitest";
import {
  normalizePhoneNumber,
  arePhoneNumbersEqual,
  getPhoneLookupCandidates,
  sanitizeDigits,
} from "../supabase/functions/_shared/goat-ai/phone-normalizer";

describe("Goat AI - Brazilian & International Phone Normalizer", () => {
  it("sanitizes digits by removing whitespace, hyphens, pluses, parentheses", () => {
    expect(sanitizeDigits("+55 (31) 99876-1967")).toBe("5531998761967");
    expect(sanitizeDigits("+55 37 99998-5192")).toBe("5537999985192");
    expect(sanitizeDigits("553198761967")).toBe("553198761967");
    expect(sanitizeDigits("")).toBe("");
    expect(sanitizeDigits(null)).toBe("");
  });

  it("correctly normalizes standard 13-digit Brazilian mobile numbers", () => {
    const norm = normalizePhoneNumber("+5531998761967");
    expect(norm.isBrazil).toBe(true);
    expect(norm.ddd).toBe("31");
    expect(norm.canonicalE164).toBe("+5531998761967");
    expect(norm.canonicalPlain).toBe("5531998761967");
    expect(norm.variations).toContain("+5531998761967");
    expect(norm.variations).toContain("5531998761967");
    expect(norm.variations).toContain("+553198761967");
    expect(norm.variations).toContain("553198761967");
  });

  it("correctly normalizes 12-digit Brazilian numbers (Meta legacy wa_id without 9th digit)", () => {
    const norm = normalizePhoneNumber("553198761967");
    expect(norm.isBrazil).toBe(true);
    expect(norm.ddd).toBe("31");
    expect(norm.canonicalE164).toBe("+5531998761967");
    expect(norm.canonicalPlain).toBe("5531998761967");
    expect(norm.variations).toContain("+5531998761967");
    expect(norm.variations).toContain("553198761967");
  });

  it("correctly normalizes formatted national numbers with DDD", () => {
    const norm = normalizePhoneNumber("(31) 99876-1967");
    expect(norm.isBrazil).toBe(true);
    expect(norm.ddd).toBe("31");
    expect(norm.canonicalE164).toBe("+5531998761967");
    expect(norm.canonicalPlain).toBe("5531998761967");
  });

  it("handles non-Brazilian international numbers", () => {
    const norm = normalizePhoneNumber("+14155552671");
    expect(norm.isBrazil).toBe(false);
    expect(norm.canonicalE164).toBe("+14155552671");
    expect(norm.canonicalPlain).toBe("14155552671");
  });

  describe("arePhoneNumbersEqual - Strict Brazilian 9th Digit Equivalence", () => {
    it("matches all 4 authorized Goat Bar partners regardless of 9th digit and formatting", () => {
      // 1. Mariana Campos (+5537999985192)
      expect(arePhoneNumbersEqual("+5537999985192", "5537999985192")).toBe(true);
      expect(arePhoneNumbersEqual("+5537999985192", "553799985192")).toBe(true);
      expect(arePhoneNumbersEqual("+55 37 99998-5192", "553799985192")).toBe(true);
      expect(arePhoneNumbersEqual("+5537999985192", "+55 (37) 9998-5192")).toBe(true);

      // 2. Gustavo Avelar (+5531996970935)
      expect(arePhoneNumbersEqual("+5531996970935", "5531996970935")).toBe(true);
      expect(arePhoneNumbersEqual("+5531996970935", "553196970935")).toBe(true);
      expect(arePhoneNumbersEqual("+55 31 99697-0935", "553196970935")).toBe(true);

      // 3. Romulo Chaves (+5531998761967)
      expect(arePhoneNumbersEqual("+5531998761967", "5531998761967")).toBe(true);
      expect(arePhoneNumbersEqual("+5531998761967", "553198761967")).toBe(true);
      expect(arePhoneNumbersEqual("+55 31 99876-1967", "553198761967")).toBe(true);
      expect(arePhoneNumbersEqual("55 (31) 99876-1967", "+553198761967")).toBe(true);

      // 4. Mateus Chaves (+5531986790981)
      expect(arePhoneNumbersEqual("+5531986790981", "5531986790981")).toBe(true);
      expect(arePhoneNumbersEqual("+5531986790981", "553186790981")).toBe(true);
      expect(arePhoneNumbersEqual("+55 31 98679-0981", "553186790981")).toBe(true);
    });

    it("strictly rejects numbers with different DDDs (no false positives)", () => {
      // DDD 31 vs DDD 37
      expect(arePhoneNumbersEqual("+5531998761967", "+5537998761967")).toBe(false);
      expect(arePhoneNumbersEqual("553198761967", "553798761967")).toBe(false);
      // DDD 31 vs DDD 11
      expect(arePhoneNumbersEqual("+5531998761967", "+5511998761967")).toBe(false);
    });

    it("strictly rejects numbers with different digits (no loose endsWith matching)", () => {
      expect(arePhoneNumbersEqual("+5531998761967", "+5531998761968")).toBe(false);
      expect(arePhoneNumbersEqual("+5531998761967", "+5531998761960")).toBe(false);
      expect(arePhoneNumbersEqual("+5531998761967", "+553188761967")).toBe(false);
      expect(arePhoneNumbersEqual("+5531998761967", "98761967")).toBe(false);
    });

    it("returns false for null, empty or invalid inputs", () => {
      expect(arePhoneNumbersEqual("", "+5531998761967")).toBe(false);
      expect(arePhoneNumbersEqual("+5531998761967", "")).toBe(false);
      expect(arePhoneNumbersEqual(null, "+5531998761967")).toBe(false);
      expect(arePhoneNumbersEqual(undefined, undefined)).toBe(false);
    });
  });

  describe("getPhoneLookupCandidates", () => {
    it("generates comprehensive query candidates for database lookup", () => {
      const candidates = getPhoneLookupCandidates("+5531998761967");
      expect(candidates).toContain("+5531998761967");
      expect(candidates).toContain("5531998761967");
      expect(candidates).toContain("+553198761967");
      expect(candidates).toContain("553198761967");
      expect(candidates).toContain("+55 31 99876-1967");
      expect(candidates).toContain("+55 (31) 99876-1967");
      expect(candidates).toContain("(31) 99876-1967");
    });
  });
});
