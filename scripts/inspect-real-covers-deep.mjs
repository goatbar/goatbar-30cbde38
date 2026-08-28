import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

async function inspectPage1(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  console.log(`\n======================================================`);
  console.log(`PAGE 1 of: ${path.basename(pdfPath)}`);
  console.log(`======================================================`);
  for (const it of tc.items) {
    if (it.str && it.str.trim()) {
      console.log(`  [x=${it.transform[4].toFixed(1)}, y=${it.transform[5].toFixed(1)}, w=${it.width.toFixed(1)}, h=${it.height.toFixed(1)}, font=${it.fontName}] "${it.str}"`);
    }
  }
}

async function main() {
  await inspectPage1('Proposta PDF pronto/Proposta Comercial - Juliana.pdf');
  await inspectPage1('Proposta PDF pronto/Cópia de Cópia de Cópia de Proposta Comercial - Despedida de Solteira.pdf');
  await inspectPage1('Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf');
}

main().catch(console.error);
