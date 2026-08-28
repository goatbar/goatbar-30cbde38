import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFRef } from 'pdf-lib';

async function scanAllFonts(filePath) {
  const data = fs.readFileSync(filePath);
  const doc = await PDFDocument.load(data);
  const context = doc.context;
  
  console.log('=== SCANNING ALL OBJECTS in', filePath, '===');
  const enumerated = context.enumerateIndirectObjects();
  const fontNames = new Set();

  for (const [ref, obj] of enumerated) {
    if (obj instanceof PDFDict) {
      const type = obj.get(PDFName.of('Type'));
      if (type && type.toString() === '/Font') {
        const baseFont = obj.get(PDFName.of('BaseFont'));
        const name = obj.get(PDFName.of('Name'));
        const subtype = obj.get(PDFName.of('Subtype'));
        const fontDesc = obj.get(PDFName.of('FontDescriptor'));
        let descFontName = null;
        if (fontDesc instanceof PDFRef) {
          const descObj = context.lookup(fontDesc);
          if (descObj instanceof PDFDict) {
            descFontName = descObj.get(PDFName.of('FontName'))?.toString();
          }
        }
        fontNames.add(`BaseFont: ${baseFont?.toString()} | DescFontName: ${descFontName} | Subtype: ${subtype?.toString()}`);
      }
    }
  }

  for (const f of fontNames) {
    console.log('Found Font ->', f);
  }
}

scanAllFonts("Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf").catch(console.error);
