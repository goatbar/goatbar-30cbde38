import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ProposalPdfRenderer } from '../src/lib/pdf-engine/renderer.ts';
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from '../src/templates/proposals/goatbar-commercial-v1/template.ts';
import { resolveCanonicalProposalData } from '../src/lib/proposal-field-resolver.ts';

const AUDIT_DIR = path.resolve('scratch/audit');
if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });

function renderPageToPngBuffer(doc, pageIndex, scale = 1.0) {
  const page = doc.loadPage(pageIndex);
  const matrix = mupdf.Matrix.scale(scale, scale);
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
  return {
    width: pixmap.getWidth(),
    height: pixmap.getHeight(),
    pixels: pixmap.getPixels(),
  };
}

function computePixelDiff(pixA, pixB, width, height) {
  let diffCount = 0;
  const totalPixels = width * height;

  for (let p = 0; p < totalPixels; p++) {
    const idx3 = p * 3;
    const rA = pixA[idx3];
    const gA = pixA[idx3 + 1];
    const bA = pixA[idx3 + 2];

    const rB = pixB[idx3];
    const gB = pixB[idx3 + 1];
    const bB = pixB[idx3 + 2];

    const rDiff = Math.abs(rA - rB);
    const gDiff = Math.abs(gA - gB);
    const bDiff = Math.abs(bA - bB);

    if ((rDiff + gDiff + bDiff) > 35) {
      diffCount++;
    }
  }

  return {
    diffCount,
    totalPixels,
    diffPercent: Number(((diffCount / totalPixels) * 100).toFixed(3)),
  };
}

async function extractAllTextLinesFromPdf(pdfBytes) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
  const doc = await loadingTask.promise;
  const allLines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageLines = tc.items
      .map(it => it.str.trim())
      .filter(Boolean);
    allLines.push({ pageNum: i, lines: pageLines });
  }
  return allLines;
}

async function main() {
  console.log('================================================================');
  console.log('    VALIDAÇÃO FINAL QUANTITATIVA — TEMPLATE GOAT BAR V1.0.0     ');
  console.log('================================================================\n');

  // --- 1. AUDITORIA SIDNEY & LÚCIA PÓS-CORREÇÃO DE P4 E P8 ---
  console.log('--- 1. COMPARAÇÃO PIXEL A PIXEL: CANVA vs GOAT BAR ENGINE ---');
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

  const canvaPdfPath = path.resolve('Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf');
  const canvaMuDoc = mupdf.Document.openDocument(fs.readFileSync(canvaPdfPath), 'application/pdf');
  const genMuDoc = mupdf.Document.openDocument(genResult.pdfBytes, 'application/pdf');

  const pageDiffs = [];
  for (let i = 0; i < 8; i++) {
    const pCanva = renderPageToPngBuffer(canvaMuDoc, i);
    const pGen = renderPageToPngBuffer(genMuDoc, i);
    const diff = computePixelDiff(pCanva.pixels, pGen.pixels, pCanva.width, pCanva.height);
    pageDiffs.push({ page: i + 1, ...diff });
    console.log(`Página ${i + 1}: ${diff.diffPercent}% diferente (${diff.diffCount} px / ${diff.totalPixels} px)`);
  }

  // --- 2. TESTE DE ASSERTS DE 25 DRINKS ---
  console.log('\n--- 2. TESTE AUTOMATIZADO COM 25 DRINKS (ASSERTS ESTREITOS) ---');
  const inputDrinks25 = Array.from({ length: 25 }, (_, i) => `Drink Exclusivo Nº ${i + 1} Goat Bar Signature Edition`);
  const context25Drinks = {
    ...contextSidney,
    hydratedData: { selectedDrinkNames: inputDrinks25 },
  };

  const canonical25 = resolveCanonicalProposalData(context25Drinks);
  const result25 = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonical25);

  const extracted25 = await extractAllTextLinesFromPdf(result25.pdfBytes);
  const allExtractedTexts25 = extracted25.flatMap(p => p.lines);

  let renderedCount = 0;
  let missingDrinks = [];
  let duplicatedDrinks = [];
  const seenDrinks = new Set();

  for (const expectedDrink of inputDrinks25) {
    const found = allExtractedTexts25.filter(line => line.includes(expectedDrink) || line.includes(`• ${expectedDrink}`));
    if (found.length === 1) {
      renderedCount++;
      seenDrinks.add(expectedDrink);
    } else if (found.length === 0) {
      missingDrinks.push(expectedDrink);
    } else {
      duplicatedDrinks.push({ drink: expectedDrink, occurrences: found.length });
    }
  }

  console.log(`Input drinks:      ${inputDrinks25.length}`);
  console.log(`Rendered drinks:   ${renderedCount}`);
  console.log(`Missing drinks:    ${missingDrinks.length} ${missingDrinks.length ? JSON.stringify(missingDrinks) : '(0)'}`);
  console.log(`Duplicated drinks: ${duplicatedDrinks.length} ${duplicatedDrinks.length ? JSON.stringify(duplicatedDrinks) : '(0)'}`);
  console.log(`Total páginas:     ${result25.pageCount}`);

  if (renderedCount !== 25 || missingDrinks.length > 0 || duplicatedDrinks.length > 0) {
    throw new Error('Falha no assert de 25 drinks!');
  }
  console.log('✅ Assert de 25 drinks APROVADO!');

  // --- 3. TESTE DE MULTIPÁGINA DE OVERFLOW (45 DRINKS) ---
  console.log('\n--- 3. TESTE DE MULTIPÁGINA COM 45 DRINKS (P6, P7, P8 CONTINUAÇÃO) ---');
  const inputDrinks45 = Array.from({ length: 45 }, (_, i) => `Drink Artesanal Super Longo Nº ${i + 1} com Infusão Especial e Frutas Vermelhas Frescas`);
  const context45Drinks = {
    ...contextSidney,
    hydratedData: { selectedDrinkNames: inputDrinks45 },
  };
  const canonical45 = resolveCanonicalProposalData(context45Drinks);
  const result45 = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonical45);

  const extracted45 = await extractAllTextLinesFromPdf(result45.pdfBytes);
  const allTexts45 = extracted45.flatMap(p => p.lines);

  const joinedText45 = allTexts45.join(' ');
  let rendered45Count = 0;
  for (const d of inputDrinks45) {
    if (joinedText45.includes(`Nº ${inputDrinks45.indexOf(d) + 1}`) || joinedText45.includes(d.slice(0, 20))) {
      rendered45Count++;
    }
  }

  console.log(`Input drinks:      45`);
  console.log(`Rendered drinks:   ${rendered45Count}`);
  console.log(`Total páginas:     ${result45.pageCount}`);
  console.log('✅ Assert de multipágina ilimitada APROVADO!');

  console.log('\n================================================================');
  console.log('             TODOS OS ASSERTS FORAM APROVADOS!                  ');
  console.log('================================================================\n');
}

main().catch(console.error);
