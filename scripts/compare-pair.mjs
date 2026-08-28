import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractPages(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfJsDoc = await loadingTask.promise;
  
  const pages = [];
  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    
    const items = textContent.items.map(item => ({
      str: item.str,
      fontName: item.fontName,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    })).filter(it => it.str && it.str.trim());

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      items,
    });
  }
  return pages;
}

async function comparePair(name, prontoPath, limpaPath) {
  console.log(`\n======================================================`);
  console.log(`COMPARING PAIR: ${name}`);
  console.log(`PRONTO: ${prontoPath}`);
  console.log(`LIMPA:  ${limpaPath}`);
  console.log(`======================================================`);

  const prontoPages = await extractPages(prontoPath);
  const limpaPages = await extractPages(limpaPath);

  console.log(`Pages count: Pronto = ${prontoPages.length}, Limpa = ${limpaPages.length}`);

  for (let i = 0; i < Math.max(prontoPages.length, limpaPages.length); i++) {
    const pPronto = prontoPages[i];
    const pLimpa = limpaPages[i];

    console.log(`\n--- PAGE ${i + 1} ---`);
    if (!pPronto || !pLimpa) {
      console.log(`Page mismatch! Pronto exists: ${Boolean(pPronto)}, Limpa exists: ${Boolean(pLimpa)}`);
      continue;
    }

    const limpaTexts = new Set(pLimpa.items.map(it => it.str.trim()));
    const prontoTexts = new Set(pPronto.items.map(it => it.str.trim()));

    // Elements in pronto that are NOT in limpa -> DYNAMIC CANDIDATES
    const dynamicItems = pPronto.items.filter(it => !limpaTexts.has(it.str.trim()));
    
    // Elements in limpa that are NOT in pronto -> PLACEHOLDERS/LABELS IN LIMPA
    const missingInPronto = pLimpa.items.filter(it => !prontoTexts.has(it.str.trim()));

    console.log(`[Static elements in both]: ${pPronto.items.length - dynamicItems.length}`);
    
    console.log(`[DYNAMIC / VARIABLE ITEMS in PRONTO] (${dynamicItems.length} items):`);
    for (const it of dynamicItems) {
      console.log(`  -> [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, w=${it.width.toFixed(1)}, h=${it.height.toFixed(1)}, font=${it.fontName}] "${it.str}"`);
    }

    if (missingInPronto.length > 0) {
      console.log(`[ITEMS ONLY IN LIMPA] (${missingInPronto.length} items):`);
      for (const it of missingInPronto) {
        console.log(`  -> [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, w=${it.width.toFixed(1)}, h=${it.height.toFixed(1)}, font=${it.fontName}] "${it.str}"`);
      }
    }
  }
}

async function main() {
  await comparePair(
    "Sidney & Lúcia",
    "Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf",
    "Proposta limpa/Cópia de Proposta Comercial - Sidney & Lúcia.pdf"
  );

  await comparePair(
    "Juliana",
    "Proposta PDF pronto/Proposta Comercial - Juliana.pdf",
    "Proposta limpa/Cópia de Proposta Comercial - Juliana.pdf"
  );
}

main().catch(console.error);
