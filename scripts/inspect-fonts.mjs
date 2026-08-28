import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractFontDetails(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfJsDoc = await loadingTask.promise;

  console.log(`\n=== FONT & COLOR INSPECTION: ${path.basename(filePath)} ===`);

  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const commonObjs = page.commonObjs;

    console.log(`\nPage ${i}:`);
    const styles = textContent.styles;
    for (const [fontKey, style] of Object.entries(styles)) {
      console.log(`  FontKey: ${fontKey} -> fontFamily: "${style.fontFamily}", descent: ${style.descent}`);
    }

    // Inspect unique items with fonts
    const uniqueFonts = new Set();
    for (const item of textContent.items) {
      if (item.str && item.str.trim()) {
        const style = styles[item.fontName];
        const fontName = style ? style.fontFamily : item.fontName;
        const key = `${item.fontName} (${fontName}) [size=${item.transform[0].toFixed(1)}]`;
        if (!uniqueFonts.has(key)) {
          uniqueFonts.add(key);
          console.log(`    Sample text: "${item.str}" | ${key}`);
        }
      }
    }
  }
}

async function main() {
  await extractFontDetails("Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf");
}

main().catch(console.error);
