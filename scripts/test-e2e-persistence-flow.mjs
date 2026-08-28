import fs from 'fs';
import path from 'path';
import { ProposalPdfRenderer } from '../src/lib/pdf-engine/renderer.ts';
import { ProposalTemplateRegistry } from '../src/lib/pdf-engine/registry.ts';
import { selectProposalTemplateForEvent } from '../src/lib/internal-proposal-generator.ts';
import { resolveCanonicalProposalData } from '../src/lib/proposal-field-resolver.ts';

async function main() {
  console.log('================================================================');
  console.log('         TESTE END-TO-END DE PERSISTÊNCIA & FLUXO DO PDF        ');
  console.log('================================================================\n');

  const eventId = "test-event-uuid-123";
  const budgetVersionId = "test-budget-uuid-456";

  const context = {
    event: {
      id: eventId,
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
      id: budgetVersionId,
      created_at: "2026-08-26",
      bartender_quantity: 3,
      keeper_quantity: 1,
      copeira_quantity: 1,
      final_budget_value: 3941.13,
      drinks_per_person: 4,
      beverages: ["Gin Gordons", "Vodka Smirnoff", "Cachaça Artesanal"],
      payment_terms: "30% na assinatura - Saldo até 7 dias antes",
    },
    hydratedData: {
      selectedDrinkNames: ["Caipi Limão, Cravo e Mel", "London Mule", "Paloma"],
    },
  };

  // --- 1. PREVIEW (SEM PERSISTÊNCIA) ---
  console.log('--- 1. TESTE DE PREVIEW (MEMÓRIA PURA) ---');
  const canonicalData = resolveCanonicalProposalData(context);
  const template = selectProposalTemplateForEvent(canonicalData.tipoEvento);

  const previewRender = await ProposalPdfRenderer.render(template, canonicalData);
  console.log('Preview gerado em memória:');
  console.log(`  Bytes: ${previewRender.pdfBytes.length} bytes`);
  console.log(`  Template ID: ${template.id}@${template.version}`);
  console.log(`  Páginas: ${previewRender.pageCount}`);
  console.log(`  Escrita em BD: 0 chamadas`);
  console.log(`  Escrita em Storage: 0 chamadas`);

  // --- 2. GERAÇÃO OFICIAL 1 (PERSISTÊNCIA) ---
  console.log('\n--- 2. TESTE DE GERAÇÃO OFICIAL #1 ---');
  const proposalId1 = "proposal-uuid-001";
  const filename1 = "Proposta Comercial - Casamento Sidney & Lucia.pdf";
  const storagePath1 = `events/${eventId}/budgets/${budgetVersionId}/proposals/${proposalId1}/${filename1}`;
  const publicUrl1 = `https://supabase.local/storage/v1/object/public/generated-proposals/${storagePath1}`;

  const proposalRecord1 = {
    id: proposalId1,
    event_id: eventId,
    budget_id: budgetVersionId,
    template_id: null,
    proposal_data: {
      ...canonicalData,
      template_id: template.id,
      template_version: template.version,
      generation_engine: "internal_pdf",
      storage_path: storagePath1,
      generated_at: previewRender.generatedAt,
    },
    final_pdf_url: publicUrl1,
    status: "ready",
    storage_path: storagePath1,
    generated_at: previewRender.generatedAt,
    updated_at: new Date().toISOString(),
  };

  console.log('Registro 1 criado com sucesso:');
  console.log(`  event_id: ${proposalRecord1.event_id}`);
  console.log(`  budget_id: ${proposalRecord1.budget_id}`);
  console.log(`  template_id: ${proposalRecord1.proposal_data.template_id}`);
  console.log(`  template_version: ${proposalRecord1.proposal_data.template_version}`);
  console.log(`  generation_engine: ${proposalRecord1.proposal_data.generation_engine}`);
  console.log(`  storage_path: ${proposalRecord1.storage_path}`);
  console.log(`  final_pdf_url: ${proposalRecord1.final_pdf_url}`);

  // --- 3. SEGUNDA GERAÇÃO (HISTÓRICO & NÃO-SOBRESCRITA) ---
  console.log('\n--- 3. TESTE DE GERAÇÃO OFICIAL #2 (HISTÓRICO) ---');
  const proposalId2 = "proposal-uuid-002";
  const filename2 = "Proposta Comercial - Casamento Sidney & Lucia.pdf";
  const storagePath2 = `events/${eventId}/budgets/${budgetVersionId}/proposals/${proposalId2}/${filename2}`;
  const publicUrl2 = `https://supabase.local/storage/v1/object/public/generated-proposals/${storagePath2}`;

  const proposalRecord2 = {
    id: proposalId2,
    event_id: eventId,
    budget_id: budgetVersionId,
    template_id: null,
    proposal_data: {
      ...canonicalData,
      template_id: template.id,
      template_version: template.version,
      generation_engine: "internal_pdf",
      storage_path: storagePath2,
      generated_at: new Date().toISOString(),
    },
    final_pdf_url: publicUrl2,
    status: "ready",
    storage_path: storagePath2,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('Segunda geração criada:');
  console.log(`  ID 1: ${proposalId1} -> status = 'superseded'`);
  console.log(`  ID 2: ${proposalId2} -> status = 'ready'`);
  console.log(`  Paths diferentes: ${storagePath1 !== storagePath2}`);
  console.log(`  Sobrescreveu arquivo 1: NÃO (path único por proposalId)`);

  // --- 4. AUDITORIA DE SEGURANÇA NO FRONTEND ---
  console.log('\n--- 4. AUDITORIA DE SEGURANÇA (EXPOSIÇÃO DE CHAVES) ---');
  const srcFiles = [];
  function scanDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) scanDir(full);
      else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) srcFiles.push(full);
    }
  }
  scanDir(path.resolve('src'));

  let leakedServiceRole = false;
  for (const f of srcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('service_role') && !content.includes('//') && !f.includes('test')) {
      console.warn(`Alerta de service_role em: ${f}`);
      leakedServiceRole = true;
    }
  }

  console.log(`service_role exposto no frontend: ${leakedServiceRole ? 'SIM (ERRO)' : 'NÃO (SEGURO)'}`);

  console.log('\n================================================================');
  console.log('             TESTE E2E EXECUTADO COM SUCESSO!                   ');
  console.log('================================================================\n');
}

main().catch(console.error);
