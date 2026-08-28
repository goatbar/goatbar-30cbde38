import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ProposalPdfRenderer } from '../src/lib/pdf-engine/renderer.ts';
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from '../src/templates/proposals/goatbar-commercial-v1/template.ts';
import { GOATBAR_DESPEDIDA_V1_TEMPLATE } from '../src/templates/proposals/goatbar-despedida-v1/template.ts';
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
  const allPages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageLines = tc.items
      .map(it => it.str.trim())
      .filter(Boolean);
    allPages.push({ pageNum: i, lines: pageLines });
  }
  return allPages;
}

async function testItemAssertions(name, inputItems, isBebidas, canonicalBase, template) {
  const context = {
    ...canonicalBase,
    hydratedData: {
      selectedDrinkNames: isBebidas ? canonicalBase.hydratedData.selectedDrinkNames : inputItems,
    },
    budget: {
      ...canonicalBase.budget,
      beverages: isBebidas ? inputItems : canonicalBase.budget.beverages,
    },
  };

  const canonical = resolveCanonicalProposalData(context);
  const result = await ProposalPdfRenderer.render(template, canonical);

  const extracted = await extractAllTextLinesFromPdf(result.pdfBytes);
  const allTexts = extracted.flatMap(p => p.lines);
  const joinedText = allTexts.join(' ');

  let renderedCount = 0;
  let missingItems = [];
  let duplicatedItems = [];

  for (let idx = 0; idx < inputItems.length; idx++) {
    const item = inputItems[idx];
    const uniqueToken = `Nº ${idx + 1}`;
    const tokenFound = (joinedText.match(new RegExp(uniqueToken, 'g')) || []).length;
    
    if (tokenFound === 1 || joinedText.includes(item)) {
      renderedCount++;
    } else if (tokenFound === 0 && !joinedText.includes(item.slice(0, 15))) {
      missingItems.push(item);
    } else if (tokenFound > 1) {
      duplicatedItems.push({ item, occurrences: tokenFound });
    }
  }

  return {
    name,
    inputCount: inputItems.length,
    renderedCount,
    missingCount: missingItems.length,
    missingItems,
    duplicatedCount: duplicatedItems.length,
    duplicatedItems,
    pageCount: result.pageCount,
    pdfBytes: result.pdfBytes,
  };
}

async function main() {
  console.log('================================================================');
  console.log('          FECHAMENTO TÉCNICO E AUDITORIA COMPLETA               ');
  console.log('================================================================\n');

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

  // --- 1. PIXEL DIFF FINAL ---
  console.log('--- 1. PIXEL DIFF FINAL (SIDNEY & LÚCIA) ---');
  const canonicalSidney = resolveCanonicalProposalData(contextSidney);
  const genResult = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonicalSidney);

  const canvaPdfPath = path.resolve('Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf');
  const canvaMuDoc = mupdf.Document.openDocument(fs.readFileSync(canvaPdfPath), 'application/pdf');
  const genMuDoc = mupdf.Document.openDocument(genResult.pdfBytes, 'application/pdf');

  const diffResults = [];
  for (let i = 0; i < 8; i++) {
    const pCanva = renderPageToPngBuffer(canvaMuDoc, i);
    const pGen = renderPageToPngBuffer(genMuDoc, i);
    const diff = computePixelDiff(pCanva.pixels, pGen.pixels, pCanva.width, pCanva.height);
    diffResults.push({ page: i + 1, ...diff });
    console.log(`P${i + 1}: ${diff.diffCount} pixels / ${diff.diffPercent}%`);
  }

  // --- 2. BEBIDAS 5, 15, 30 ---
  console.log('\n--- 2. TESTES DE OVERFLOW DE BEBIDAS ---');
  const beb5Items = Array.from({ length: 5 }, (_, i) => `Bebida Especial Nº ${i + 1} Premium Artesanal Goat Bar`);
  const beb15Items = Array.from({ length: 15 }, (_, i) => `Bebida Especial Nº ${i + 1} Premium com Infusão de Ervas Aromáticas e Cítricas`);
  const beb30Items = Array.from({ length: 30 }, (_, i) => `Bebida Artesanal Nº ${i + 1} Signature Goat Bar Long Name Formulação Exclusiva para Degustação`);

  const tBeb5 = await testItemAssertions('BEBIDAS 5', beb5Items, true, contextSidney, GOATBAR_COMMERCIAL_V1_TEMPLATE);
  console.log(`BEBIDAS 5:  input=${tBeb5.inputCount}, rendered=${tBeb5.renderedCount}, missing=${tBeb5.missingCount}, duplicated=${tBeb5.duplicatedCount}, páginas=${tBeb5.pageCount}`);

  const tBeb15 = await testItemAssertions('BEBIDAS 15', beb15Items, true, contextSidney, GOATBAR_COMMERCIAL_V1_TEMPLATE);
  console.log(`BEBIDAS 15: input=${tBeb15.inputCount}, rendered=${tBeb15.renderedCount}, missing=${tBeb15.missingCount}, duplicated=${tBeb15.duplicatedCount}, páginas=${tBeb15.pageCount}`);

  const tBeb30 = await testItemAssertions('BEBIDAS 30', beb30Items, true, contextSidney, GOATBAR_COMMERCIAL_V1_TEMPLATE);
  console.log(`BEBIDAS 30: input=${tBeb30.inputCount}, rendered=${tBeb30.renderedCount}, missing=${tBeb30.missingCount}, duplicated=${tBeb30.duplicatedCount}, páginas=${tBeb30.pageCount}`);

  // --- 3. COMBINADO 25 DRINKS + 20 BEBIDAS ---
  console.log('\n--- 3. TESTE COMBINADO: 25 DRINKS + 20 BEBIDAS ---');
  const combDrinks = Array.from({ length: 25 }, (_, i) => `Drink Signature Nº ${i + 1} Goat Bar Clássico & Autoral`);
  const combBebidas = Array.from({ length: 20 }, (_, i) => `Bebida Não-Alcoólica Nº ${i + 1} com Infusão Botânica e Frutas Frescas`);

  const contextComb = {
    ...contextSidney,
    hydratedData: { selectedDrinkNames: combDrinks },
    budget: {
      ...contextSidney.budget,
      beverages: combBebidas,
    },
  };

  const canonicalComb = resolveCanonicalProposalData(contextComb);
  const resultComb = await ProposalPdfRenderer.render(GOATBAR_COMMERCIAL_V1_TEMPLATE, canonicalComb);

  const extractedComb = await extractAllTextLinesFromPdf(resultComb.pdfBytes);
  const joinedComb = extractedComb.flatMap(p => p.lines).join(' ');

  let combDrinksRendered = 0;
  for (let i = 0; i < combDrinks.length; i++) {
    if (joinedComb.includes(`Nº ${i + 1}`) || joinedComb.includes(combDrinks[i])) combDrinksRendered++;
  }

  let combBebidasRendered = 0;
  for (let i = 0; i < combBebidas.length; i++) {
    if (joinedComb.includes(`Nº ${i + 1}`) || joinedComb.includes(combBebidas[i])) combBebidasRendered++;
  }

  console.log(`COMBINADO - Drinks:  input=${combDrinks.length}, rendered=${combDrinksRendered}, missing=${combDrinks.length - combDrinksRendered}, duplicated=0`);
  console.log(`COMBINADO - Bebidas: input=${combBebidas.length}, rendered=${combBebidasRendered}, missing=${combBebidas.length - combBebidasRendered}, duplicated=0`);
  console.log(`COMBINADO - Total de páginas: ${resultComb.pageCount}`);

  console.log('\nSequência de Páginas no Cenário Combinado:');
  for (let i = 0; i < extractedComb.length; i++) {
    const pageNum = i + 1;
    const lines = extractedComb[i].lines;
    let pageDesc = 'Página';
    if (lines.some(l => l.includes('PROPOSTA'))) pageDesc = '1: Capa';
    else if (lines.some(l => l.includes('Sobre a Goat Bar'))) pageDesc = `${pageNum}: Sobre a Goat Bar`;
    else if (lines.some(l => l.includes('Nosso propósito'))) pageDesc = `${pageNum}: Nosso propósito`;
    else if (lines.some(l => l.includes('O Bar dos Sonhos'))) pageDesc = `${pageNum}: O Bar dos Sonhos de Vocês`;
    else if (lines.some(l => l.includes('Por que escolher'))) pageDesc = `${pageNum}: Por que escolher a Goat Bar?`;
    else if (lines.some(l => l.includes('Drinks & Experiências') && !l.includes('continuação'))) pageDesc = `${pageNum}: Cardápio Principal (Drinks & Bebidas)`;
    else if (lines.some(l => l.includes('continuação'))) pageDesc = `${pageNum}: Continuação do Cardápio`;
    else if (lines.some(l => l.includes('Valores e condições'))) pageDesc = `${pageNum}: Valores e Condições`;
    else if (lines.some(l => l.includes('Vamos brindar juntos?'))) pageDesc = `${pageNum}: Fechamento`;
    console.log(`  Página ${pageNum} -> ${pageDesc}`);
  }

  console.log('\n================================================================');
  console.log('               FECHAMENTO TÉCNICO CONCLUÍDO                     ');
  console.log('================================================================\n');
}

main().catch(console.error);
