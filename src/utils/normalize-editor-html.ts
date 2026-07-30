/**
 * normalize-editor-html.ts
 *
 * Função pura de normalização de HTML do editor de contratos.
 * Remove elementos e atributos exclusivos da interface de edição (chips, botão "×", contenteditable, data-editor, etc.)
 * enquanto preserva 100% da estrutura HTML, alinhamentos, tabelas, recuos, quebras de página e estilos visuais.
 */

const EDITOR_ONLY_SELECTORS = [
  ".docx-chip-del",
  "[data-editor-control]",
  ".editor-only",
  ".field-chip-remove",
  "[data-delete-key]",
];

const EDITOR_ONLY_ATTRIBUTES = [
  "contenteditable",
  "data-editor",
  "data-lexical",
  "data-slate",
  "data-prosemirror",
  "data-delete-key",
  "tabindex",
  "spellcheck",
];

/**
 * Normaliza o HTML vindo do editor visual ou do banco de dados,
 * convertendo chips visuais em placeholders simples e removendo controles de edição.
 */
export function normalizeEditorHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  // Suporte para ambiente Browser ou Node/Bun com DOMParser
  if (typeof DOMParser !== "undefined") {
    return normalizeWithDOMParser(html);
  }

  // Fallback seguro em ambientes sem DOMParser nativo (ex: testes legados sem DOM)
  return normalizeWithRegexFallback(html);
}

export function normalizeWithDOMParser(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 1. Remover seletores exclusivos de controles do editor (botões "×", ícones, etc.)
  EDITOR_ONLY_SELECTORS.forEach((selector) => {
    const elements = doc.querySelectorAll(selector);
    elements.forEach((el) => el.remove());
  });

  // 2. Converter chips de variáveis (.docx-field-chip ou [data-field-key]) em placeholders simples {{chave}}
  const chips = Array.from(doc.querySelectorAll(".docx-field-chip, [data-field-key]"));
  chips.forEach((chip) => {
    const fieldKey = chip.getAttribute("data-field-key");

    let replacementText = "";
    if (fieldKey && fieldKey.trim().length > 0) {
      replacementText = `{{${fieldKey.trim()}}}`;
    } else {
      // Fallback: limpa botões internos e extrai apenas o texto
      const clone = chip.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("button, .docx-chip-del").forEach((b) => b.remove());
      const rawText = clone.textContent || "";
      const match = rawText.match(/\{\{\s*([a-zA-Z0-9._]+)\s*\}\}|\[([A-Z0-9_]+)\]/);
      if (match) {
        replacementText = match[0];
      } else {
        replacementText = rawText.trim();
      }
    }

    const textNode = doc.createTextNode(replacementText);
    chip.parentNode?.replaceChild(textNode, chip);
  });

  // 3. Remover botões "×" que possam ter sobrado soltos
  const strayButtons = Array.from(doc.querySelectorAll("button"));
  strayButtons.forEach((btn) => {
    if (
      btn.classList.contains("docx-chip-del") ||
      btn.getAttribute("data-delete-key") ||
      btn.textContent?.trim() === "×"
    ) {
      btn.remove();
    }
  });

  // 4. Remover atributos de edição conhecidos de todos os elementos
  const allElements = Array.from(doc.body.querySelectorAll("*"));
  allElements.forEach((el) => {
    EDITOR_ONLY_ATTRIBUTES.forEach((attr) => {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr);
      }
    });

    if (el.hasAttribute("data-field-key")) {
      el.removeAttribute("data-field-key");
    }

    // Normalizar quebras de página visuais do editor (ex: <div ...>--- QUEBRA DE PÁGINA ---</div>)
    const textContent = el.textContent || "";
    if (/---\s*QUEBRA DE P.*?GINA\s*---/i.test(textContent)) {
      el.className = "docx-page-break";
      el.setAttribute("style", "page-break-after: always; break-after: page; display: block;");
      el.textContent = "";
    }
  });

  return doc.body.innerHTML;
}

/**
 * Fallback de expressões regulares idêntico ao comportamental para ambientes sem DOM.
 */
export function normalizeWithRegexFallback(html: string): string {
  let clean = html;

  // 1. Remove botões de exclusão de chip <button...>×</button>
  clean = clean.replace(/<button[^>]*class="[^"]*docx-chip-del[^"]*"[^>]*>.*?<\/button>/gi, "");
  clean = clean.replace(/<button[^>]*data-delete-key="[^"]*"[^>]*>.*?<\/button>/gi, "");
  clean = clean.replace(/<button[^>]*>\s*×\s*<\/button>/gi, "");

  // 2. Extrai chave do chip data-field-key="key" e substitui o span inteiro por {{key}}
  clean = clean.replace(
    /<span[^>]*data-field-key="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi,
    (_match, key) => {
      return `{{${key.trim()}}}`;
    },
  );

  // 3. Unwras de chips sem data-field-key
  clean = clean.replace(
    /<span[^>]*class="[^"]*docx-field-chip[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_match, inner) => {
      return inner.replace(/<button[^>]*>.*?<\/button>/gi, "").trim();
    },
  );

  // 4. Remove atributos de edição conhecidos
  EDITOR_ONLY_ATTRIBUTES.forEach((attr) => {
    const attrRegex = new RegExp(`\\s+${attr}(?:="[^"]*"|='[^']*'|=[^\\s>]*)?`, "gi");
    clean = clean.replace(attrRegex, "");
  });
  clean = clean.replace(/\s+data-field-key="[^"]*"/gi, "");

  // 5. Quebra de página
  clean = clean.replace(
    /<div[^>]*>---\s*QUEBRA DE P.*?GINA\s*---<\/div>/gi,
    '<div class="docx-page-break" style="page-break-after: always; break-after: page;"></div>',
  );

  return clean;
}
