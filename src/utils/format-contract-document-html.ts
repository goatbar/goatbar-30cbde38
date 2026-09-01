/**
 * Adds presentation hooks to compiled contract HTML without changing its text,
 * variables, values or clause ordering. This is intentionally applied only to
 * the isolated PDF document: the stored template remains the source of truth.
 */
export function formatContractDocumentHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  if (typeof DOMParser === "undefined") return formatContractDocumentHtmlWithoutDom(html);

  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(document.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div"));

  blocks.forEach((element) => {
    // Nested divs inherit the classification from their actual text blocks.
    if (element.tagName === "DIV" && element.querySelector("p, div, h1, h2, h3, h4, h5, h6")) return;

    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    if (/^CONTRATO(?:\s+DE)?\b/i.test(text) && text.length <= 140) {
      element.classList.add("contract-title");
    } else if (/^(CONTRATANTE|CONTRATADA)\s*:?(?:\s|$)/i.test(text) && text.length <= 40) {
      element.classList.add("contract-party-heading");
    } else if (/^CL[ÁA]USULA\s+(?:\d+|[IVXLCDM]+)(?:[ªº.\s-]|$)/i.test(text)) {
      element.classList.add("contract-clause-heading");
    } else if (/^[a-z]\)\s+/i.test(text)) {
      element.classList.add("contract-alpha-item");
    }
  });

  return document.body.innerHTML;
}

function formatContractDocumentHtmlWithoutDom(html: string): string {
  return html.replace(
    /<(h[1-6]|p|div)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attributes: string, contents: string) => {
      if (tag.toLowerCase() === "div" && /<(?:p|div|h[1-6])\b/i.test(contents)) return match;
      const text = contents.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
      let className = "";
      if (/^CONTRATO(?:\s+DE)?\b/i.test(text) && text.length <= 140) className = "contract-title";
      else if (/^(CONTRATANTE|CONTRATADA)\s*:?(?:\s|$)/i.test(text) && text.length <= 40)
        className = "contract-party-heading";
      else if (/^CL[ÁA]USULA\s+(?:\d+|[IVXLCDM]+)(?:[ªº.\s-]|$)/i.test(text))
        className = "contract-clause-heading";
      else if (/^[a-z]\)\s+/i.test(text)) className = "contract-alpha-item";
      if (!className) return match;

      const classAttribute = attributes.match(/\sclass=(['"])(.*?)\1/i);
      const nextAttributes = classAttribute
        ? attributes.replace(classAttribute[0], ` class=${classAttribute[1]}${classAttribute[2]} ${className}${classAttribute[1]}`)
        : `${attributes} class="${className}"`;
      return `<${tag}${nextAttributes}>${contents}</${tag}>`;
    },
  );
}
