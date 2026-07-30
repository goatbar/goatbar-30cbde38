import { test } from 'vitest';
/**
 * normalize-editor-html.test.ts
 *
 * SuÃ­te de testes automatizados cobrindo os 10 cenÃ¡rios obrigatÃ³rios da Etapa 8.
 */

import { normalizeEditorHtml, normalizeWithDOMParser, normalizeWithRegexFallback } from "./normalize-editor-html";
import { validateExportHtml } from "./validate-export-html";
import { renderContractTemplate, replaceContractVariables } from "../services/contract-service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAILED: ${message}`);
  }
}

function runTests() {
  console.log("ðŸ§ª Iniciando ExecuÃ§Ã£o da SuÃ­te de Testes Automatizados...\n");

  // 8.1 Chip Simples
  console.log("Testando 8.1: Chip Simples");
  const input81 = `<span class="docx-field-chip" data-field-key="cliente.nome" contenteditable="false">{{cliente.nome}}<button class="docx-chip-del">Ã—</button></span>`;
  const normalized81 = normalizeEditorHtml(input81);
  assert(normalized81.includes("{{cliente.nome}}"), "Chip deve virar {{cliente.nome}}");
  assert(!normalized81.includes("Ã—"), "BotÃ£o Ã— deve ser removido");
  assert(!normalized81.includes("docx-field-chip"), "Classe docx-field-chip deve ser removida");
  assert(!normalized81.includes("contenteditable"), "Atributo contenteditable deve ser removido");

  const merged81 = replaceContractVariables(normalized81, { "cliente.nome": "Jhansen Silva Santos" });
  assert(merged81 === "Jhansen Silva Santos", `Merge esperado 'Jhansen Silva Santos', obtido: '${merged81}'`);
  console.log("  âœ“ 8.1 Chip Simples passou!");

  // 8.2 Chip com Label Diferente
  console.log("Testando 8.2: Chip com Label Diferente");
  const input82 = `<span class="docx-field-chip" data-field-key="cliente.nome">Nome do Cliente<button class="docx-chip-del">Ã—</button></span>`;
  const normalized82 = normalizeEditorHtml(input82);
  assert(normalized82.includes("{{cliente.nome}}"), "Deve priorizar data-field-key 'cliente.nome'");
  assert(!normalized82.includes("Nome do Cliente"), "NÃ£o deve usar o label visual como placeholder");
  console.log("  âœ“ 8.2 Chip com Label Diferente passou!");

  // 8.3 Campo Repetido
  console.log("Testando 8.3: Campo Repetido");
  const input83 = `<p>{{cliente.nome}}</p><p>Contratante: {{cliente.nome}}</p>`;
  const merged83 = replaceContractVariables(input83, { "cliente.nome": "Jhansen Silva Santos" });
  assert(merged83.includes("<p>Jhansen Silva Santos</p>"), "Primeira ocorrÃªncia deve ser substituÃ­da");
  assert(merged83.includes("<p>Contratante: Jhansen Silva Santos</p>"), "Segunda ocorrÃªncia deve ser substituÃ­da");
  console.log("  âœ“ 8.3 Campo Repetido passou!");

  // 8.4 Caracteres Especiais
  console.log("Testando 8.4: Caracteres Especiais");
  const input84 = `<p>Cliente: {{cliente.nome}}</p>`;
  const merged84 = replaceContractVariables(input84, { "cliente.nome": "JoÃ£o & Maria <Eventos>" });
  assert(merged84.includes("JoÃ£o &amp; Maria &lt;Eventos&gt;"), "Caracteres & e < devem ser escapados com seguranÃ§a");
  console.log("  âœ“ 8.4 Caracteres Especiais passou!");

  // 8.5 PreservaÃ§Ã£o de Tabelas
  console.log("Testando 8.5: PreservaÃ§Ã£o de Tabelas");
  const input85 = `<table class="minha-tabela" style="width: 100%; border: 1px solid red;"><tr class="linha-header"><th colspan="2" style="padding: 10px;">TÃ­tulo</th></tr><tr><td rowspan="2">Cel 1</td><td>Cel 2</td></tr></table>`;
  const normalized85 = normalizeEditorHtml(input85);
  assert(normalized85.includes(`colspan="2"`), "colspan deve ser mantido");
  assert(normalized85.includes(`rowspan="2"`), "rowspan deve ser mantido");
  assert(normalized85.includes(`style="width: 100%; border: 1px solid red;"`), "Estilo inline da tabela deve ser mantido");
  assert(normalized85.includes(`class="minha-tabela"`), "Classe da tabela deve ser mantida");
  console.log("  âœ“ 8.5 PreservaÃ§Ã£o de Tabelas passou!");

  // 8.6 PreservaÃ§Ã£o de Listas
  console.log("Testando 8.6: PreservaÃ§Ã£o de Listas");
  const input86 = `<ol style="margin-left: 20px;"><li>Item 1</li><li><ul><li>Sub-item A</li></ul></li></ol>`;
  const normalized86 = normalizeEditorHtml(input86);
  assert(normalized86.includes(`<ol style="margin-left: 20px;">`), "Estrutura <ol> e estilos mantidos");
  assert(normalized86.includes(`<li>Sub-item A</li>`), "Listas aninhadas mantidas");
  console.log("  âœ“ 8.6 PreservaÃ§Ã£o de Listas passou!");

  // 8.7 Quebra de PÃ¡gina
  console.log("Testando 8.7: Quebra de PÃ¡gina");
  const input87 = `<p>PÃ¡gina 1</p><div style="page-break-after:always;">--- QUEBRA DE PÃGINA ---</div><p>PÃ¡gina 2</p>`;
  const normalized87 = normalizeEditorHtml(input87);
  assert(normalized87.includes(`class="docx-page-break"`), "Deve converter em classe docx-page-break");
  assert(!normalized87.includes("--- QUEBRA DE PÃGINA ---"), "Texto visual do editor deve ser removido");
  console.log("  âœ“ 8.7 Quebra de PÃ¡gina passou!");

  // 8.8 PreservaÃ§Ã£o Seletiva de Atributos do Editor vs GenÃ©ricos
  console.log("Testando 8.8: Atributos do Editor");
  const input88 = `<p contenteditable="true" data-editor="true" data-document-id="123" style="margin-left: 20px;">Texto</p>`;
  const normalized88 = normalizeEditorHtml(input88);
  assert(!normalized88.includes("contenteditable"), "contenteditable deve ser removido");
  assert(!normalized88.includes("data-editor"), "data-editor deve ser removido");
  assert(normalized88.includes('data-document-id="123"'), "data-document-id genÃ©rico deve ser preservado");
  assert(normalized88.includes('style="margin-left: 20px;"'), "estilo de recuo mantido");
  console.log("  âœ“ 8.8 Atributos do Editor passou!");

  // 8.9 Placeholder NÃ£o Resolvido
  console.log("Testando 8.9: Placeholder NÃ£o Resolvido");
  const htmlComPendencia = `<p>Cliente: Jhansen Santos</p><p>HorÃ¡rio: {{evento.hora_fim}}</p>`;
  const valResult = validateExportHtml(htmlComPendencia);
  assert(!valResult.valid, "ValidaÃ§Ã£o deve falhar devido a placeholder pendente");
  assert(valResult.unresolvedFields.includes("{{evento.hora_fim}}"), "Lista de nÃ£o resolvidos deve incluir {{evento.hora_fim}}");
  console.log("  âœ“ 8.9 Placeholder NÃ£o Resolvido passou!");

  // 8.10 IdempotÃªncia
  console.log("Testando 8.10: IdempotÃªncia");
  const input810 = `<div style="padding: 10px;"><p class="titulo">Contrato</p><span class="docx-field-chip" data-field-key="cliente.nome">{{cliente.nome}}<button class="docx-chip-del">Ã—</button></span></div>`;
  const pass1 = normalizeEditorHtml(input810);
  const pass2 = normalizeEditorHtml(pass1);
  assert(pass1 === pass2, `NormalizaÃ§Ã£o deve ser idÃªntica. Pass1: '${pass1}', Pass2: '${pass2}'`);
  console.log("  âœ“ 8.10 IdempotÃªncia passou!");

  // 8.11 Quebra de PÃ¡gina - Regex Fallback explÃ­cito
  console.log("Testando 8.11: Quebra de PÃ¡gina (Regex Fallback)");
  const normRegex = normalizeWithRegexFallback(input87);
  assert(normRegex.includes(`class="docx-page-break"`), "Regex Fallback deve converter em classe docx-page-break");
  console.log("  âœ“ 8.11 Regex Fallback explicit passou!");

  // 8.12 Quebra de PÃ¡gina - DOMParser explÃ­cito
  console.log("Testando 8.12: Quebra de PÃ¡gina (DOMParser)");
  let OriginalDOMParser = (global as any).DOMParser;
  try {
    (global as any).DOMParser = class {
      parseFromString(html: string) {
        const el = {
          textContent: "--- QUEBRA DE PÁGINA ---",
          className: "",
          hasAttribute: () => false,
          setAttribute: function(k: string, v: string) { (this as any).style = v; },
          removeAttribute: () => {},
        };
        return {
          querySelectorAll: () => [],
          createTextNode: () => ({}),
          body: { 
            querySelectorAll: () => [el],
            get innerHTML() { return el.className === "docx-page-break" ? '<div class="docx-page-break"></div>' : html; }
          }
        };
      }
    };
    const normDom = normalizeWithDOMParser(input87);
    assert(normDom.includes(`class="docx-page-break"`), "DOMParser deve converter em classe docx-page-break");
    console.log("  âœ“ 8.12 DOMParser explicit passou!");
  } finally {
    (global as any).DOMParser = OriginalDOMParser;
  }

  console.log("\nðŸŽ‰ TODOS OS TESTES AUTOMATIZADOS FORAM EXECUTADOS COM SUCESSO!");
}

test('Executa testes de normalização', () => { runTests(); });


