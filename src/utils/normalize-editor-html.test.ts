import { describe, expect, test } from "vitest";
import { renderContractTemplate } from "../services/contract-service";
import { normalizeEditorHtml } from "./normalize-editor-html";
import {
  ContractExportValidationError,
  prepareContractExportHtml,
} from "./prepare-contract-export-html";
import { validateExportHtml } from "./validate-export-html";

describe("fluxo de pré-visualização de contratos", () => {
  test("preserva texto em português como UTF-8", () => {
    const html = normalizeEditorHtml(
      "<p>Pré-visualização de João em São Paulo: ação concluída.</p>",
    );
    expect(html).toContain("Pré-visualização");
    expect(html).toContain("João");
    expect(html).toContain("São Paulo");
    expect(html).not.toMatch(/[ÃÂ�]/);
  });

  test("contrato completo gera pré-visualização", () => {
    const html = renderContractTemplate(
      "<p>Cliente: {{cliente.nome}}</p><p>Evento: [EVENTO_NOME]</p>",
      {
        "cliente.nome": "João Silva",
        EVENTO_NOME: "Casamento São Paulo",
      },
    );

    expect(html).toContain("João Silva");
    expect(html).toContain("Casamento São Paulo");
    expect(html).not.toContain("{{cliente.nome}}");
    expect(html).not.toContain("[EVENTO_NOME]");
  });

  test("placeholder real não substituído bloqueia a pré-visualização e informa seu nome", () => {
    expect(() => renderContractTemplate("<p>Horário: {{evento.hora_fim}}</p>", {})).toThrowError(
      /elementos de edição|campos pendentes/,
    );

    try {
      renderContractTemplate("<p>Horário: {{evento.hora_fim}}</p>", {});
    } catch (error) {
      expect(error).toHaveProperty("unresolvedFields", ["{{evento.hora_fim}}"]);
      expect((error as { issues: Array<{ token: string; rule: string }> }).issues[0]).toMatchObject(
        {
          token: "{{evento.hora_fim}}",
          rule: "unresolved_curly_placeholder",
        },
      );
    }
  });

  test("elemento contenteditable já sanitizado não bloqueia", () => {
    const html = renderContractTemplate('<p contenteditable="true">Cliente: {{cliente.nome}}</p>', {
      "cliente.nome": "Maria Ação",
    });

    expect(html).toContain("Maria Ação");
    expect(html).not.toContain("contenteditable");
  });

  test("marcador legítimo de quebra de página não bloqueia", () => {
    const html = renderContractTemplate(
      '<p>Página 1</p><div style="page-break-after:always;" contenteditable="false">--- QUEBRA DE PÁGINA ---</div><p>Página 2</p>',
      {},
    );

    expect(html).toContain('class="docx-page-break"');
    expect(validateExportHtml(html).valid).toBe(true);
  });

  test("HTML com acentos não sofre dupla codificação", () => {
    const html = prepareContractExportHtml("<p>Condições: até sábado, café e açúcar.</p>");
    expect(html).toContain("Condições");
    expect(html).toContain("sábado");
    expect(html).toContain("açúcar");
    expect(html).not.toContain("CondiÃ§Ãµes");
  });

  test("mensagem da API/Edge Function é exibida sem mojibake", () => {
    const error = new ContractExportValidationError(validateExportHtml("<p>{{nome_do_campo}}</p>"));
    const pending = error.unresolvedFields.join(", ");
    const message = `Não foi possível gerar a pré-visualização. Campos pendentes: ${pending}.`;

    expect(message).toBe(
      "Não foi possível gerar a pré-visualização. Campos pendentes: {{nome_do_campo}}.",
    );
    expect(message).not.toMatch(/[ÃÂ�]/);
  });

  test("o fluxo não altera nem duplica o contrato DRAFT existente", () => {
    const draftHtml =
      '<p>Cliente: {{cliente.nome}}</p><div class="docx-page-break" style="page-break-after: always;"></div>';
    const snapshot = String(draftHtml);
    const preview = renderContractTemplate(draftHtml, { "cliente.nome": "João" });

    expect(draftHtml).toBe(snapshot);
    expect(preview).not.toBe(draftHtml);
    expect((preview.match(/João/g) || []).length).toBe(1);
  });
});
