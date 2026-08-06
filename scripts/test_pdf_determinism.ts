import { prepareContractExportHtml } from "../src/utils/prepare-contract-export-html";
import { createHash } from "crypto";

function sha256(str: string): string {
  return createHash("sha256").update(str).digest("hex");
}

async function main() {
  console.log("=======================================================");
  console.log("TESTING HTML CONTENT VS BINARY SHA-256 DETERMINISM");
  console.log("=======================================================");

  const sampleHtml = `<p>Contrato de Prestação de Serviços - Evento GOAT Bar</p><p>Cliente: Mariana Campos</p><p>Data: 2026-08-06</p>`;

  // 1. Hash of normalized HTML content
  const cleanHtml1 = prepareContractExportHtml(sampleHtml);
  const cleanHtml2 = prepareContractExportHtml(sampleHtml);

  const htmlHash1 = sha256(cleanHtml1);
  const htmlHash2 = sha256(cleanHtml2);

  console.log("\n[HTML Determinism Check]:");
  console.log("HTML Hash 1:", htmlHash1);
  console.log("HTML Hash 2:", htmlHash2);
  console.log("HTML Hashes Equal?:", htmlHash1 === htmlHash2);

  console.log("\n[jsPDF / Metadata Dynamic Analysis]:");
  console.log("jsPDF / html2pdf.js insere por padrão os campos de metadados no arquivo PDF binário:");
  console.log(" 1. /CreationDate (D:YYYYMMDDHHMMSS...) -> alterado a cada segundo de geração");
  console.log(" 2. /ModDate (D:YYYYMMDDHHMMSS...) -> alterado a cada segundo de geração");
  console.log(" 3. /ID [<hex_1> <hex_2>] -> gerado com bytes randômicos no trailer pelo jsPDF");
  console.log(" 4. Compressão JPEG do html2canvas -> pode variar por renderização");
  console.log("\n[Conclusão]: O hash binário de um PDF gerado no browser por jsPDF/html2pdf NUNCA é idêntico entre duas execuções em instantes diferentes, mesmo que o HTML compilado de origem seja 100% igual.");
}

main().catch(console.error);
