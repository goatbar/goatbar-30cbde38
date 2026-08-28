import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function inspectDoc(dir, filename) {
  const filePath = path.join(dir, filename);
  const data = new Uint8Array(fs.readFileSync(filePath));
  
  // 1. pdf-lib info
  const pdfDoc = await PDFDocument.load(data);
  const pageCount = pdfDoc.getPageCount();
  const pagesInfo = pdfDoc.getPages().map((p, i) => {
    const size = p.getSize();
    return { page: i + 1, width: size.width, height: size.height };
  });

  // 2. pdfjs text extraction
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfJsDoc = await loadingTask.promise;
  
  const pagesContent = [];
  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    
    const items = textContent.items.map(item => ({
      str: item.str,
      fontName: item.fontName,
      transform: item.transform, // [scaleX, skewY, skewX, scaleY, x, y]
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    })).filter(it => it.str && it.str.trim());

    pagesContent.push({
      pageNumber: i,
      viewport: { width: viewport.width, height: viewport.height },
      itemsCount: items.length,
      items,
    });
  }

  return {
    filename,
    pageCount,
    pagesInfo,
    pagesContent,
  };
}

async function main() {
  const prontoDir = path.resolve('Proposta PDF pronto');
  const limpaDir = path.resolve('Proposta limpa');

  const prontoFiles = fs.readdirSync(prontoDir).filter(f => f.endsWith('.pdf'));
  const limpaFiles = fs.readdirSync(limpaDir).filter(f => f.endsWith('.pdf'));

  console.log('=== INSPECTION REPORT ===\n');

  console.log('--- PROPOSTA PDF PRONTO ---');
  for (const f of prontoFiles) {
    const info = await inspectDoc(prontoDir, f);
    console.log(`\n========================================`);
    console.log(`FILE: ${f} | Pages: ${info.pageCount}`);
    console.log(`========================================`);
    for (const p of info.pagesContent) {
      console.log(`\n  --- PAGE ${p.pageNumber} (${p.viewport.width}x${p.viewport.height}) [${p.itemsCount} items] ---`);
      for (const it of p.items) {
        console.log(`    [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, w=${it.width.toFixed(1)}, h=${it.height.toFixed(1)}, font=${it.fontName}] "${it.str}"`);
      }
    }
  }

  console.log('\n\n--- PROPOSTA LIMPA ---');
  for (const f of limpaFiles) {
    const info = await inspectDoc(limpaDir, f);
    console.log(`\n========================================`);
    console.log(`FILE: ${f} | Pages: ${info.pageCount}`);
    console.log(`========================================`);
    for (const p of info.pagesContent) {
      console.log(`\n  --- PAGE ${p.pageNumber} (${p.viewport.width}x${p.viewport.height}) [${p.itemsCount} items] ---`);
      for (const it of p.items) {
        console.log(`    [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, w=${it.width.toFixed(1)}, h=${it.height.toFixed(1)}, font=${it.fontName}] "${it.str}"`);
      }
    }
  }
}

main().catch(console.error);
