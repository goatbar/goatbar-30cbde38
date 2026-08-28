import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

async function main() {
  console.log('=== CRIANDO PDF BASE LIMPO CORRIGIDO ===');

  const limpoPath = path.resolve('Proposta limpa/Cópia de Proposta Comercial - Sidney & Lúcia.pdf');
  const prontoPath = path.resolve('Proposta PDF pronto/Proposta Comercial - Sidney & Lúcia.pdf');

  const limpoBytes = fs.readFileSync(limpoPath);
  const prontoBytes = fs.readFileSync(prontoPath);

  const docLimpo = await PDFDocument.load(limpoBytes);
  const docPronto = await PDFDocument.load(prontoBytes);

  const correctedDoc = await PDFDocument.create();

  // P1 -> Limpo
  const [p1] = await correctedDoc.copyPages(docLimpo, [0]);
  correctedDoc.addPage(p1);

  // P2 -> Limpo
  const [p2] = await correctedDoc.copyPages(docLimpo, [1]);
  correctedDoc.addPage(p2);

  // P3 -> Limpo
  const [p3] = await correctedDoc.copyPages(docLimpo, [2]);
  correctedDoc.addPage(p3);

  // P4 -> Pronto (versão correta sem texto corrompido)
  const [p4] = await correctedDoc.copyPages(docPronto, [3]);
  correctedDoc.addPage(p4);

  // P5 -> Limpo
  const [p5] = await correctedDoc.copyPages(docLimpo, [4]);
  correctedDoc.addPage(p5);

  // P6 -> Limpo
  const [p6] = await correctedDoc.copyPages(docLimpo, [5]);
  correctedDoc.addPage(p6);

  // P7 -> Limpo
  const [p7] = await correctedDoc.copyPages(docLimpo, [6]);
  correctedDoc.addPage(p7);

  // P8 -> Pronto (versão correta sem linha repetida)
  const [p8] = await correctedDoc.copyPages(docPronto, [7]);
  correctedDoc.addPage(p8);

  const targetDir = path.resolve('src/templates/proposals/goatbar-commercial-v1');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, 'clean-template.pdf');
  const correctedBytes = await correctedDoc.save();
  fs.writeFileSync(targetPath, correctedBytes);

  console.log(`Base PDF corrigido criado em: ${targetPath} (${(correctedBytes.length / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
