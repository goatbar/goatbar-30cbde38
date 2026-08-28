import fs from 'fs';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

async function checkFontObjects(filePath) {
  const data = fs.readFileSync(filePath);
  const doc = await PDFDocument.load(data);
  
  console.log('=== PDF FONT OBJECTS in', filePath, '===');
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const resources = page.node.Resources();
    if (resources && resources.has(PDFName.of('Font'))) {
      const fonts = resources.get(PDFName.of('Font'));
      if (fonts instanceof PDFDict) {
        const fontKeys = fonts.keys();
        for (const k of fontKeys) {
          const fontObj = fonts.get(k);
          if (fontObj instanceof PDFDict) {
            const baseFont = fontObj.get(PDFName.of('BaseFont'));
            const subtype = fontObj.get(PDFName.of('Subtype'));
            console.log(`Page ${i + 1} Font [${k.asString()}]: BaseFont = ${baseFont?.toString()}, Subtype = ${subtype?.toString()}`);
          }
        }
      }
    }
  }
}

async function main() {
  await checkFontObjects("Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf");
}

main().catch(console.error);
