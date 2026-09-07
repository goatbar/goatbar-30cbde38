import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  CANONICAL_FONT_FAMILY,
  CANONICAL_FONT_REGULAR_BASE64,
  CANONICAL_FONT_BOLD_BASE64,
} from "./canonical-contract-font";

describe("canonical contract font determinism and anti-drift", () => {
  const edgeFunctionFontPath = path.resolve(
    __dirname,
    "../../supabase/functions/contract-render-pdf/font.ts",
  );

  it("ensures Edge Function font file exists", () => {
    expect(fs.existsSync(edgeFunctionFontPath)).toBe(true);
  });

  it("ensures preview font and Edge Function font have byte-for-byte identical Base64 binaries", () => {
    const edgeFunctionContent = fs.readFileSync(edgeFunctionFontPath, "utf-8");

    // Extrai constantes do arquivo da Edge Function
    const edgeRegMatch = edgeFunctionContent.match(/CANONICAL_FONT_REGULAR_BASE64\s*=\s*["']([^"']+)["']/);
    const edgeBoldMatch = edgeFunctionContent.match(/CANONICAL_FONT_BOLD_BASE64\s*=\s*["']([^"']+)["']/);
    const edgeFamilyMatch = edgeFunctionContent.match(/CANONICAL_FONT_FAMILY\s*=\s*["']([^"']+)["']/);

    expect(edgeRegMatch).not.toBeNull();
    expect(edgeBoldMatch).not.toBeNull();
    expect(edgeFamilyMatch).not.toBeNull();

    const edgeRegB64 = edgeRegMatch![1];
    const edgeBoldB64 = edgeBoldMatch![1];
    const edgeFamily = edgeFamilyMatch![1];

    // Verifica identidade estrita
    expect(edgeFamily).toBe(CANONICAL_FONT_FAMILY);
    expect(edgeRegB64).toBe(CANONICAL_FONT_REGULAR_BASE64);
    expect(edgeBoldB64).toBe(CANONICAL_FONT_BOLD_BASE64);

    // Compara hashes criptográficos dos binários
    const frontendHash = createHash("sha256")
      .update(CANONICAL_FONT_REGULAR_BASE64 + CANONICAL_FONT_BOLD_BASE64)
      .digest("hex");

    const edgeHash = createHash("sha256")
      .update(edgeRegB64 + edgeBoldB64)
      .digest("hex");

    expect(edgeHash).toBe(frontendHash);
  });

  it("ensures embedded fonts are valid WOFF2 binaries", () => {
    const regBuffer = Buffer.from(CANONICAL_FONT_REGULAR_BASE64, "base64");
    const boldBuffer = Buffer.from(CANONICAL_FONT_BOLD_BASE64, "base64");

    // WOFF2 magic number é 'wOF2' (0x77, 0x4F, 0x46, 0x32)
    expect(regBuffer.slice(0, 4).toString("ascii")).toBe("wOF2");
    expect(boldBuffer.slice(0, 4).toString("ascii")).toBe("wOF2");

    // Tamanhos mínimos de fonte completa (ao menos 20KB cada)
    expect(regBuffer.length).toBeGreaterThan(20000);
    expect(boldBuffer.length).toBeGreaterThan(20000);
  });
});
