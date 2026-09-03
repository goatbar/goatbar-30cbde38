import fs from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import { describe, it } from "vitest";

describe("Inspect Clean Capas", () => {
  it("extracts clean page 1 for all 3 templates", () => {
    const artifactDir = "C:/Users/mcmar/.gemini/antigravity/brain/45fbbc49-86b4-44fc-8269-3df17b921c7d";
    const templates = [
      { name: "casamento", file: "src/templates/proposals/goatbar-commercial-v1/clean-template.pdf" },
      { name: "aniversario", file: "src/templates/proposals/goatbar-aniversario-v1/clean-template.pdf" },
      { name: "comemoracao", file: "src/templates/proposals/goatbar-comemoracao-v1/clean-template.pdf" },
    ];

    for (const tmpl of templates) {
      const pdfPath = path.resolve(tmpl.file);
      if (!fs.existsSync(pdfPath)) continue;
      const pdfBytes = fs.readFileSync(pdfPath);
      const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");

      const page = doc.loadPage(0); // Page 1
      const pix = page.toPixmap(mupdf.Matrix.scale(1, 1), mupdf.ColorSpace.DeviceRGB, false);
      const outputPath = path.join(artifactDir, `clean-p1-${tmpl.name}.png`);
      fs.writeFileSync(outputPath, pix.asPNG());
      console.log(`Saved clean capa: ${outputPath}`);
    }
  });
});
