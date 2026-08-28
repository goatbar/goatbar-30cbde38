import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import { createCanvas } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ProposalPdfRenderer } from '../src/lib/pdf-engine/renderer.ts';
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from '../src/templates/proposals/goatbar-commercial-v1/template.ts';
import { resolveCanonicalProposalData } from '../src/lib/proposal-field-resolver.ts';

const AUDIT_DIR = path.resolve('scratch/audit');
if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });

// --- 1. Programmatic Text Layer Extraction ---
async function extractTextLayer(pdfBytes, pageNum) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent();
  return textContent.items
    .map(it => it.str)
    .filter(s => s && s.trim());
}

// --- 2. Rasterize Page using MuPDF (Fast, 100% native vector quality) ---
function renderPageToPngBuffer(doc, pageIndex, scale = 1.0) {
  const page = doc.loadPage(pageIndex);
  const matrix = mupdf.Matrix.scale(scale, scale);
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  const pngBuffer = pixmap.asPNG();
  const width = pixmap.getWidth();
  const height = pixmap.getHeight();
  const pixels = pixmap.getPixels(); // Uint8Array [R, G, B, R, G, B, ...]
  return { pngBuffer, width, height, pixels };
}

// --- 3. Pixel Diff & Bounding Box ---
function computePixelDiff(pixA, pixB, width, height) {
  const diffCanvas = createCanvas(width, height);
  const diffCtx = diffCanvas.getContext('2d');
  const diffImgData = diffCtx.createImageData(width, height);
  const diffData = diffImgData.data;

  let diffCount = 0;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  const totalPixels = width * height;

  // pixA e pixB são RGB (3 bytes por pixel)
  for (let p = 0; p < totalPixels; p++) {
    const idx3 = p * 3;
    const idx4 = p * 4;

    const rA = pixA[idx3];
    const gA = pixA[idx3 + 1];
    const bA = pixA[idx3 + 2];

    const rB = pixB[idx3];
    const gB = pixB[idx3 + 1];
    const bB = pixB[idx3 + 2];

    const rDiff = Math.abs(rA - rB);
    const gDiff = Math.abs(gA - gB);
    const bDiff = Math.abs(bA - bB);

    const isDifferent = (rDiff + gDiff + bDiff) > 35; // Threshold para anti-aliasing e compressão

    const px = p % width;
    const py = Math.floor(p / width);

    if (isDifferent) {
      diffCount++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      // Destaca em magenta vivo (RGB: 255, 0, 140)
      diffData[idx4] = 255;
      diffData[idx4 + 1] = 0;
      diffData[idx4 + 2] = 140;
      diffData[idx4 + 3] = 255;
    } else {
      // Fundo esmaecido em escala de cinza
      const gray = Math.round(0.299 * rA + 0.587 * gA + 0.114 * bA);
      diffData[idx4] = Math.min(255, gray + 40);
      diffData[idx4 + 1] = Math.min(255, gray + 40);
      diffData[idx4 + 2] = Math.min(255, gray + 40);
      diffData[idx4 + 3] = 255;
    }
  }

  diffCtx.putImageData(diffImgData, 0, 0);

  const diffPercent = (diffCount / totalPixels) * 100;
  const bbox = diffCount > 0 ? { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY } : null;

  return {
    diffCount,
    totalPixels,
    diffPercent,
    bbox,
    diffBuffer: diffCanvas.toBuffer('image/png'),
  };
}

async function main() {
  console.log('=====================================================');
  console.log('       AUDITORIA VISUAL REAL E QUANTITATIVA         ');
  console.log('=====================================================\n');

  // --- SEÇÃO 1: AUDITORIA DO TEXT LAYER DO PDF LIMPO ---
  console.log('--- 1. AUDITORIA DO PDF LIMPO (BASE) ---');
  const cleanPdfPath = path.resolve('Proposta limpa/Cópia de Proposta Comercial - Sidney & Lúcia.pdf');
  const cleanPdfBytes = fs.readFileSync(cleanPdfPath);

  for (const p of [1, 6, 7]) {
    const textLayer = await extractTextLayer(cleanPdfBytes, p);
    console.log(`\nPágina ${p} do PDF Limpo (${textLayer.length} strings encontradas):`);
    for (const str of textLayer) {
      console.log(`   "${str}"`);
    }
  }

  // --- SEÇÃO 2: GERAÇÃO DO PDF GOAT BAR (SIDNEY & LÚCIA) ---
  console.log('\n--- 2. RENDERIZANDO PDF GOAT BAR (SIDNEY & LÚCIA) ---');
  const contextSidney = {
    event: {
      id: "sidney-lucia-real",
      event_name: "Casamento Sidney & Lúcia",
      client_name: "Sidney & Lúcia",
      groom_name: "Sidney",
      bride_name: "Lúcia",
      guests: 70,
      date: "2026-10-10",
      duration_hours: 5,
      event_type: "casamento",
    },
    budget: {
      id: "budget-sidney-lucia",
      created_at: "2026-08-26",
      bartender_quantity: 3,
      keeper_quantity: 1,
      copeira_quantity: 1,
      final_budget_value: 3941.13,
      drinks_per_person: 4,
      beverages: [
        "Gin Gordons ou O'gin",
        "Vodka Smirnoff",
        "Cachaça Artesanal",
        "Whisky Red Label",
        "Tequila",
      ],
      payment_terms: "30% na assinatura do contrato - Restante até dia 03.10.2026",
    },
    hydratedData: {
      selectedDrinkNames: [
        "Caipi Limão, Cravo e Mel",
        "London Mule",
        "Stamping Passion",
        "Paloma",
        "Sex on The Beach",
        "Whisky Sour",
        "Bramble",
      ],
    },
  };

  const canonicalSidney = resolveCanonicalProposalData(contextSidney);
  const genResult = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonicalSidney);
  const genPdfPath = path.join(AUDIT_DIR, 'goatbar-sidney-lucia.pdf');
  fs.writeFileSync(genPdfPath, genResult.pdfBytes);

  // --- SEÇÃO 3: RASTERIZAÇÃO E COMPARAÇÃO VISUAL PÁGINA A PÁGINA COM MUPDF ---
  console.log('\n--- 3. RASTERIZAÇÃO E COMPARAÇÃO VISUAL PÁGINA A PÁGINA (MUPDF) ---');
  const canvaPdfPath = path.resolve('Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf');
  const canvaPdfBytes = fs.readFileSync(canvaPdfPath);

  const canvaMuDoc = mupdf.Document.openDocument(canvaPdfBytes, 'application/pdf');
  const genMuDoc = mupdf.Document.openDocument(genResult.pdfBytes, 'application/pdf');

  const pageResults = [];

  for (let i = 0; i < 8; i++) {
    const pageNum = i + 1;
    const canvaRender = renderPageToPngBuffer(canvaMuDoc, i, 1.0);
    const genRender = renderPageToPngBuffer(genMuDoc, i, 1.0);

    const diff = computePixelDiff(canvaRender.pixels, genRender.pixels, canvaRender.width, canvaRender.height);

    // Salva PNGs
    const canvaPngPath = path.join(AUDIT_DIR, `page-${pageNum}-canva.png`);
    const genPngPath = path.join(AUDIT_DIR, `page-${pageNum}-goatbar.png`);
    const diffPngPath = path.join(AUDIT_DIR, `page-${pageNum}-diff.png`);

    fs.writeFileSync(canvaPngPath, canvaRender.pngBuffer);
    fs.writeFileSync(genPngPath, genRender.pngBuffer);
    fs.writeFileSync(diffPngPath, diff.diffBuffer);

    const result = {
      page: pageNum,
      diffPixels: diff.diffCount,
      totalPixels: diff.totalPixels,
      diffPercent: Number(diff.diffPercent.toFixed(3)),
      bbox: diff.bbox,
      canvaPngPath,
      genPngPath,
      diffPngPath,
    };
    pageResults.push(result);

    console.log(`Página ${pageNum}: ${result.diffPercent}% diferente (${diff.diffCount} px / ${diff.totalPixels} px)`);
    if (diff.bbox) {
      console.log(`   Bounding Box da diferença: [x: ${diff.bbox.minX}..${diff.bbox.maxX}, y: ${diff.bbox.minY}..${diff.bbox.maxY}] (w=${diff.bbox.w}, h=${diff.bbox.h})`);
    } else {
      console.log(`   IDÊNTICA (0% diff)`);
    }
  }

  // --- SEÇÃO 4: TESTE COM OUTRO EVENTO (JULIANA) ---
  console.log('\n--- 4. TESTE COM OUTRO EVENTO REAL (JULIANA) ---');
  const contextJuliana = {
    event: {
      id: "juliana-real",
      event_name: "15 Anos Juliana",
      client_name: "Juliana",
      groom_name: null,
      bride_name: null,
      guests: 150,
      date: "2026-09-19",
      duration_hours: 6,
      event_type: "aniversario",
    },
    budget: {
      id: "budget-juliana",
      created_at: "2026-08-02",
      bartender_quantity: 4,
      keeper_quantity: 1,
      copeira_quantity: 1,
      final_budget_value: 5775.00,
      drinks_per_person: 5,
      beverages: [
        "Vodka: Smirnoff",
        "Cachaça artesanal",
        "Bacardi",
        "O´Gin/Gordons",
      ],
      payment_terms: "30% na assinatura - Restante até dia 12/09/2026",
    },
    hydratedData: {
      selectedDrinkNames: [
        "Caipi Limão, Cravo e Mel",
        "Caipi Morango",
        "Caipi Maracujá & Baunilha",
        "Moscow Mule",
        "Mojito",
        "Gin&Tônica",
      ],
    },
  };

  const canonicalJuliana = resolveCanonicalProposalData(contextJuliana);
  const genJuliana = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonicalJuliana);
  const julianaPdfPath = path.join(AUDIT_DIR, 'goatbar-juliana-test.pdf');
  fs.writeFileSync(julianaPdfPath, genJuliana.pdfBytes);

  // Renderiza páginas 1, 6, 7 do teste da Juliana para PNG
  const julianaMuDoc = mupdf.Document.openDocument(genJuliana.pdfBytes, 'application/pdf');
  fs.writeFileSync(path.join(AUDIT_DIR, 'juliana-page-1.png'), renderPageToPngBuffer(julianaMuDoc, 0).pngBuffer);
  fs.writeFileSync(path.join(AUDIT_DIR, 'juliana-page-6.png'), renderPageToPngBuffer(julianaMuDoc, 5).pngBuffer);
  fs.writeFileSync(path.join(AUDIT_DIR, 'juliana-page-7.png'), renderPageToPngBuffer(julianaMuDoc, 6).pngBuffer);
  console.log(`PDF Juliana gerado com sucesso: ${julianaPdfPath} (${genJuliana.pageCount} páginas)`);

  // --- SEÇÃO 5: TESTE DE OVERFLOW DE CARDÁPIO ---
  console.log('\n--- 5. TESTE DE OVERFLOW (CARDÁPIOS DE DIFERENTES TAMANHOS) ---');
  const overflowTestCases = [
    { name: 'poucos-drinks-3', count: 3, longNames: false },
    { name: 'normal-drinks-7', count: 7, longNames: false },
    { name: 'nomes-longos-8', count: 8, longNames: true },
    { name: 'overflow-16-drinks', count: 16, longNames: false },
    { name: 'overflow-25-drinks', count: 25, longNames: true },
  ];

  for (const tc of overflowTestCases) {
    const drinks = Array.from({ length: tc.count }, (_, i) => 
      tc.longNames 
        ? `Drink Artesanal Nº ${i + 1} Signature Goat Bar com Espuma Cítrica e Frutas Tropicais`
        : `Drink Clássico Nº ${i + 1}`
    );

    const contextOverflow = {
      ...contextSidney,
      hydratedData: { selectedDrinkNames: drinks },
    };
    const canonicalOv = resolveCanonicalProposalData(contextOverflow);
    const ovResult = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonicalOv);
    const ovPdfPath = path.join(AUDIT_DIR, `overflow-${tc.name}.pdf`);
    fs.writeFileSync(ovPdfPath, ovResult.pdfBytes);

    // Rasteriza a página extra se houver
    const ovMuDoc = mupdf.Document.openDocument(ovResult.pdfBytes, 'application/pdf');
    if (ovResult.pageCount > 8) {
      fs.writeFileSync(
        path.join(AUDIT_DIR, `overflow-${tc.name}-continuation-page.png`),
        renderPageToPngBuffer(ovMuDoc, 6).pngBuffer // Página 7 (continuação)
      );
    }

    console.log(`Caso [${tc.name}]: ${tc.count} drinks -> ${ovResult.pageCount} páginas (Overflow disparado: ${ovResult.pageCount > 8 ? 'SIM' : 'NÃO'})`);
  }

  // --- SEÇÃO 6: RESUMO JSON ---
  const summary = {
    auditTimestamp: new Date().toISOString(),
    cleanPdfPath,
    pageResults,
  };
  fs.writeFileSync(path.join(AUDIT_DIR, 'audit-summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=====================================================');
  console.log('         AUDITORIA VISUAL FINAL CONCLUÍDA            ');
  console.log(`Arquivos salvos em: ${AUDIT_DIR}`);
  console.log('=====================================================\n');
}

main().catch(console.error);
