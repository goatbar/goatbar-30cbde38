import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname } from "node:path";
import { describe, expect, test } from "vitest";

const SOURCE_EXTENSIONS = new Set([
  ".tsx", ".ts", ".js", ".jsx", ".json", ".html", ".css", ".sql", ".md", ".txt", ".cjs", ".mjs", ".toml", ".yaml", ".yml",
]);

// Downloaded Assinafy documentation snapshots are external/generated reference artifacts.
// The normalization test intentionally contains a mojibake sample as a regression fixture.
const EXCLUDED_FIXTURES = new Set([
  "api-1.json",
  "api-summary.txt",
  "diff.txt",
  "diff_zapsign.txt",
  "test_sanitize.ts",
  "tsc-errors.txt",
  "src/utils/normalize-editor-html.test.ts",
  "src/mojibake-audit.test.ts",
]);

const MOJIBAKE_PATTERNS = [
  /\u00c3[\u0080-\u00bf]/u, // UTF-8 bytes rendered as Latin-1, e.g. "Orçamentos" when corrupted
  /\u00c2[\u0080-\u00bf]/u,
  /\u00e2\u20ac/u,
  /\u00ef\u00bf\u00bd/u,
  /\ufffd/u,
  /\ud83d[\u0080-\u00ff]/u, // corrupted emoji prefixes
];

describe("auditoria de encoding dos arquivos-fonte", () => {
  test("não contém padrões clássicos de mojibake", () => {
    const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
      encoding: "utf8",
    })
      .split("\n")
      .filter((file) => file && SOURCE_EXTENSIONS.has(extname(file)))
      .filter((file) => !EXCLUDED_FIXTURES.has(file));

    const violations = files.flatMap((file) => {
      const contents = readFileSync(file, "utf8");
      return MOJIBAKE_PATTERNS.some((pattern) => pattern.test(contents)) ? [file] : [];
    });

    expect(violations, `Mojibake encontrado em: ${violations.join(", ")}`).toEqual([]);
  });
});
