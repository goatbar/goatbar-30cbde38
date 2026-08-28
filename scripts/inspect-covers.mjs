import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

async function inspectPdf(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log(`\n======================================================`);
  console.log(`FILE: ${path.basename(pdfPath)} | Pages: ${doc.numPages}`);
  console.log(`======================================================`);

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const tc = await page.getTextContent();
    const items = tc.items.map(it => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      h: it.height,
      font: it.fontName,
    })).filter(it => it.str && it.str.trim());

    console.log(`\n--- PAGE ${i} (${viewport.width}x${viewport.height}) [${items.length} items] ---`);
    for (const it of items) {
      console.log(`  [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, w=${it.w.toFixed(1)}, h=${it.h.toFixed(1)}, font=${it.font}] "${it.str}"`);
    }
  }
}

async function main() {
  const prontoDir = path.resolve('Proposta PDF pronto');
  const files = [
    'Proposta Comercial - Sidney & Lúcia.pdf',
    'Proposta Comercial - Juliana.pdf',
    'Cópia de Cópia de Cópia de Proposta Comercial - Despedida de Solteira.pdf',
  ];

  for (const f of files) {
    const fullPath = path.join(prontoDir, f);
    if (fs.existsSync(fullPath)) {
      await inspectPdf(fullPath);
    }
  }
}

main().catch(console.error);
