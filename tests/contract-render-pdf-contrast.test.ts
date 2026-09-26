import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sanitizeAndPrepareContractHtml } from "../supabase/functions/contract-render-pdf/sanitize";

describe("contract PDF text contrast", () => {
  it("removes DOCX styles that can make PDF text faint or invisible", () => {
    const dirty = [
      '<p style="color:#fff !important; opacity:0.08; -webkit-text-fill-color:#f8fafc; filter:opacity(10%); font-family:Cambria">',
      '<font color="#ffffff">Texto contratual legível</font>',
      '</p>',
    ].join("");

    const clean = sanitizeAndPrepareContractHtml(dirty);

    expect(clean).toContain("Texto contratual legível");
    expect(clean).toContain("font-family:Cambria");
    expect(clean).not.toMatch(/(?:^|;)\s*color\s*:/i);
    expect(clean).not.toMatch(/-webkit-text-fill-color\s*:/i);
    expect(clean).not.toMatch(/opacity\s*:/i);
    expect(clean).not.toMatch(/filter\s*:/i);
    expect(clean).not.toMatch(/<font\b[^>]*\bcolor\s*=/i);
  });

  it("keeps editor and Edge renderer protected against dark-theme/color drift", () => {
    const frontendStyles = readFileSync(
      resolve(process.cwd(), "src/lib/contract-document-styles.ts"),
      "utf8",
    );
    const edgeStyles = readFileSync(
      resolve(process.cwd(), "supabase/functions/contract-render-pdf/styles.ts"),
      "utf8",
    );

    for (const source of [frontendStyles, edgeStyles]) {
      expect(source).toContain("#contract-root font");
      expect(source).toContain("-webkit-text-fill-color: #0f172a !important");
      expect(source).toContain("opacity: 1 !important");
      expect(source).toContain("forced-color-adjust: none");
      expect(source).toContain("color-scheme: light");
    }
  });
});
