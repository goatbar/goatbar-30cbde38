/**
 * normalize-editor-html.test.ts
 *
 * Suíte de testes automatizados cobrindo os 10 cenários obrigatórios da Etapa 8.
 */

import { normalizeEditorHtml } from "./normalize-editor-html";
import { validateExportHtml } from "./validate-export-html";
import { renderContractTemplate, replaceContractVariables } from "../services/contract-service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
}

function runTests() {
  console.log("🧪 Iniciando Execução da Suíte de Testes Automatizados...\n");

  // 8.1 Chip Simples
  console.log("Testando 8.1: Chip Simples");
  const input81 = `<span class="docx-field-chip" data-field-key="cliente.nome" contenteditable="false">{{cliente.nome}}<button class="docx-chip-del">×</button></span>`;
  const normalized81 = normalizeEditorHtml(input81);
  assert(normalized81.includes("{{cliente.nome}}"), "Chip deve virar {{cliente.nome}}");
  assert(!normalized81.includes("×"), "Botão × deve ser removido");
  assert(!normalized81.includes("docx-field-chip"), "Classe docx-field-chip deve ser removida");
  assert(!normalized81.includes("contenteditable"), "Atributo contenteditable deve ser removido");

  const merged81 = replaceContractVariables(normalized81, { "cliente.nome": "Jhansen Silva Santos" });
  assert(merged81 === "Jhansen Silva Santos", `Merge esperado 'Jhansen Silva Santos', obtido: '${merged81}'`);
  console.log("  ✓ 8.1 Chip Simples passou!");

  // 8.2 Chip com Label Diferente
  console.log("Testando 8.2: Chip com Label Diferente");
  const input82 = `<span class="docx-field-chip" data-field-key="cliente.nome">Nome do Cliente<button class="docx-chip-del">×</button></span>`;
  const normalized82 = normalizeEditorHtml(input82);
  assert(normalized82.includes("{{cliente.nome}}"), "Deve priorizar data-field-key 'cliente.nome'");
  assert(!normalized82.includes("Nome do Cliente"), "Não deve usar o label visual como placeholder");
  console.log("  ✓ 8.2 Chip com Label Diferente passou!");

  // 8.3 Campo Repetido
  console.log("Testando 8.3: Campo Repetido");
  const input83 = `<p>{{cliente.nome}}</p><p>Contratante: {{cliente.nome}}</p>`;
  const merged83 = replaceContractVariables(input83, { "cliente.nome": "Jhansen Silva Santos" });
  assert(merged83.includes("<p>Jhansen Silva Santos</p>"), "Primeira ocorrência deve ser substituída");
  assert(merged83.includes("<p>Contratante: Jhansen Silva Santos</p>"), "Segunda ocorrência deve ser substituída");
  console.log("  ✓ 8.3 Campo Repetido passou!");

  // 8.4 Caracteres Especiais
  console.log("Testando 8.4: Caracteres Especiais");
  const input84 = `<p>Cliente: {{cliente.nome}}</p>`;
  const merged84 = replaceContractVariables(input84, { "cliente.nome": "João & Maria <Eventos>" });
  assert(merged84.includes("João &amp; Maria &lt;Eventos&gt;"), "Caracteres & e < devem ser escapados com segurança");
  console.log("  ✓ 8.4 Caracteres Especiais passou!");

  // 8.5 Preservação de Tabelas
  console.log("Testando 8.5: Preservação de Tabelas");
  const input85 = `<table class="minha-tabela" style="width: 100%; border: 1px solid red;"><tr class="linha-header"><th colspan="2" style="padding: 10px;">Título</th></tr><tr><td rowspan="2">Cel 1</td><td>Cel 2</td></tr></table>`;
  const normalized85 = normalizeEditorHtml(input85);
  assert(normalized85.includes(`colspan="2"`), "colspan deve ser mantido");
  assert(normalized85.includes(`rowspan="2"`), "rowspan deve ser mantido");
  assert(normalized85.includes(`style="width: 100%; border: 1px solid red;"`), "Estilo inline da tabela deve ser mantido");
  assert(normalized85.includes(`class="minha-tabela"`), "Classe da tabela deve ser mantida");
  console.log("  ✓ 8.5 Preservação de Tabelas passou!");

  // 8.6 Preservação de Listas
  console.log("Testando 8.6: Preservação de Listas");
  const input86 = `<ol style="margin-left: 20px;"><li>Item 1</li><li><ul><li>Sub-item A</li></ul></li></ol>`;
  const normalized86 = normalizeEditorHtml(input86);
  assert(normalized86.includes(`<ol style="margin-left: 20px;">`), "Estrutura <ol> e estilos mantidos");
  assert(normalized86.includes(`<li>Sub-item A</li>`), "Listas aninhadas mantidas");
  console.log("  ✓ 8.6 Preservação de Listas passou!");

  // 8.7 Quebra de Página
  console.log("Testando 8.7: Quebra de Página");
  const input87 = `<p>Página 1</p><div style="page-break-after:always;">--- QUEBRA DE PÁGINA ---</div><p>Página 2</p>`;
  const normalized87 = normalizeEditorHtml(input87);
  assert(normalized87.includes(`class="docx-page-break"`), "Deve converter em classe docx-page-break");
  assert(!normalized87.includes("--- QUEBRA DE PÁGINA ---"), "Texto visual do editor deve ser removido");
  console.log("  ✓ 8.7 Quebra de Página passou!");

  // 8.8 Preservação Seletiva de Atributos do Editor vs Genéricos
  console.log("Testando 8.8: Atributos do Editor");
  const input88 = `<p contenteditable="true" data-editor="true" data-document-id="123" style="margin-left: 20px;">Texto</p>`;
  const normalized88 = normalizeEditorHtml(input88);
  assert(!normalized88.includes("contenteditable"), "contenteditable deve ser removido");
  assert(!normalized88.includes("data-editor"), "data-editor deve ser removido");
  assert(normalized88.includes('data-document-id="123"'), "data-document-id genérico deve ser preservado");
  assert(normalized88.includes('style="margin-left: 20px;"'), "estilo de recuo mantido");
  console.log("  ✓ 8.8 Atributos do Editor passou!");

  // 8.9 Placeholder Não Resolvido
  console.log("Testando 8.9: Placeholder Não Resolvido");
  const htmlComPendencia = `<p>Cliente: Jhansen Santos</p><p>Horário: {{evento.hora_fim}}</p>`;
  const valResult = validateExportHtml(htmlComPendencia);
  assert(!valResult.valid, "Validação deve falhar devido a placeholder pendente");
  assert(valResult.unresolvedFields.includes("{{evento.hora_fim}}"), "Lista de não resolvidos deve incluir {{evento.hora_fim}}");
  console.log("  ✓ 8.9 Placeholder Não Resolvido passou!");

  // 8.10 Idempotência
  console.log("Testando 8.10: Idempotência");
  const input810 = `<div style="padding: 10px;"><p class="titulo">Contrato</p><span class="docx-field-chip" data-field-key="cliente.nome">{{cliente.nome}}<button class="docx-chip-del">×</button></span></div>`;
  const pass1 = normalizeEditorHtml(input810);
  const pass2 = normalizeEditorHtml(pass1);
  assert(pass1 === pass2, `Normalização deve ser idêntica. Pass1: '${pass1}', Pass2: '${pass2}'`);
  console.log("  ✓ 8.10 Idempotência passou!");

  console.log("\n🎉 TODOS OS 10 TESTES AUTOMATIZADOS FORAM EXECUTADOS COM SUCESSO!");
}

runTests();
