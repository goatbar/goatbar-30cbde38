import fs from 'fs';
import path from 'path';
import { ProposalPdfRenderer } from '../src/lib/pdf-engine/renderer.ts';
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from '../src/templates/proposals/goatbar-commercial-v1/template.ts';
import { resolveCanonicalProposalData } from '../src/lib/proposal-field-resolver.ts';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractTextPositions(data) {
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfJsDoc = await loadingTask.promise;
  const pages = [];
  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items.map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    })).filter(it => it.str && it.str.trim());
    pages.push({ pageNumber: i, items });
  }
  return pages;
}

async function main() {
  console.log('=== CALIBRATION & RENDER VALIDATION ===\n');

  // Exact data from reference "Sidney & Lúcia"
  const context = {
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

  const canonicalData = resolveCanonicalProposalData(context);
  console.log('Canonical data resolved:');
  console.log('  Nome evento:', canonicalData.nomeEvento);
  console.log('  Data orcamento:', canonicalData.dataOrcamento);
  console.log('  Data evento:', canonicalData.dataEvento);
  console.log('  Iniciais:', canonicalData.inicialNoivo, '&', canonicalData.inicialNoiva);
  console.log('  Convidados:', canonicalData.quantidadePessoasFormatted);
  console.log('  Investimento:', canonicalData.valorInvestimentoFormatted);
  console.log('  Data final pagamento:', canonicalData.dataFinalPagamento);
  console.log('  Drinks count:', canonicalData.drinks.length);
  console.log('  Bebidas count:', canonicalData.bebidas.length);

  // Render via ProposalPdfRenderer
  const renderResult = await ProposalPdfRenderer.render(
    GOATBAR_COMMERCIAL_V1_TEMPLATE,
    canonicalData
  );

  const outDir = path.resolve('scratch');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'generated-sidney-lucia-test.pdf');
  fs.writeFileSync(outPath, renderResult.pdfBytes);
  console.log(`\nGenerated PDF saved to: ${outPath} (${(renderResult.pdfBytes.length / 1024).toFixed(1)} KB)`);

  // Load and compare with reference Canva PDF
  const refPath = path.resolve('Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf');
  const refData = new Uint8Array(fs.readFileSync(refPath));
  
  const refPages = await extractTextPositions(refData);
  const genPages = await extractTextPositions(renderResult.pdfBytes);

  console.log(`\n--- PAGE BY PAGE COMPARISON ---`);
  console.log(`Reference Pages: ${refPages.length} | Generated Pages: ${genPages.length}`);

  for (let i = 0; i < Math.min(refPages.length, genPages.length); i++) {
    const pRef = refPages[i];
    const pGen = genPages[i];

    console.log(`\nPAGE ${i + 1}:`);
    console.log(`  Reference items: ${pRef.items.length} | Generated items: ${pGen.items.length}`);

    // Print items on dynamic pages (1, 6, 7)
    if ([1, 6, 7].includes(i + 1)) {
      console.log(`  [Generated Items on Page ${i + 1}]:`);
      for (const it of pGen.items.slice(0, 15)) {
        console.log(`    [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}, w=${it.width.toFixed(1)}] "${it.str}"`);
      }
    }
  }

  console.log('\n=== CALIBRATION COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error);
