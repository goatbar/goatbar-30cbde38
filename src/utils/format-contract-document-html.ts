/**
 * format-contract-document-html.ts
 *
 * Adiciona ganchos de apresentação semânticos ao HTML compilado do contrato
 * SEM alterar seu texto, variáveis, valores, acentos ou ordenação de cláusulas.
 *
 * Inclui agrupamento semântico tolerante e não-destrutivo para o bloco de
 * encerramento/assinaturas (.contract-signature-block), garantindo que data e
 * signatários permaneçam juntos na mesma página (break-inside: avoid).
 */

export function formatContractDocumentHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  if (typeof DOMParser === "undefined") return formatContractDocumentHtmlWithoutDom(html);

  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(document.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div"));

  blocks.forEach((element) => {
    // Divs aninhadas não sobrescrevem a classificação dos seus nós de texto
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

  // Agrupamento semântico e tolerante do bloco de assinaturas
  wrapSignatureBlock(document.body);

  return document.body.innerHTML;
}

/**
 * Localiza de forma tolerante os elementos finais de encerramento, data e assinaturas,
 * envolvendo-os em <div class="contract-signature-block"> para evitar quebra de página órfã.
 */
function wrapSignatureBlock(root: HTMLElement): void {
  // Se já existir um bloco de assinaturas explícito, não duplica
  if (root.querySelector(".contract-signature-block, .signature-block, .signature-grid")) {
    return;
  }

  const children = Array.from(root.children);
  if (children.length === 0) return;

  const signatureElements: Element[] = [];
  let foundSignatures = false;

  // Percorre os nós filhos de trás para a frente
  for (let i = children.length - 1; i >= 0; i--) {
    const el = children[i];
    const text = (el.textContent || "").trim();

    // Identifica linhas de assinatura ou rótulos de signatários
    const isSignatureLine = /_{3,}/.test(text);
    const isSignerLabel = /\b(CONTRATANTE|CONTRATADA|TESTEMUNHA|ASSINATURA)\b/i.test(text);
    const isClosingOrDate =
      /\b\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+\d{4}\b/i.test(text) ||
      /\b(firmam\s+o\s+presente|vias\s+de\s+igual|justos\s+e\s+contratados)\b/i.test(text);

    if (isSignatureLine || isSignerLabel) {
      foundSignatures = true;
      signatureElements.unshift(el);
    } else if (foundSignatures && (isClosingOrDate || text === "")) {
      // Inclui a data/fechamento que antecede imediatamente as assinaturas
      signatureElements.unshift(el);
    } else if (foundSignatures) {
      // Encontrou conteúdo normal antes do bloco de assinaturas (ex: Cláusula final) -> encerra coleta
      break;
    }
  }

  // Se encontrou assinaturas, envolve todos os elementos coletados em .contract-signature-block
  if (foundSignatures && signatureElements.length > 0) {
    const firstEl = signatureElements[0];
    const parent = firstEl.parentNode;
    if (parent) {
      const wrapper = root.ownerDocument.createElement("div");
      wrapper.className = "contract-signature-block";
      parent.insertBefore(wrapper, firstEl);
      signatureElements.forEach((el) => {
        wrapper.appendChild(el);
      });
    }
  }
}

function formatContractDocumentHtmlWithoutDom(html: string): string {
  // 1. Aplica classes semânticas de cabeçalho
  let result = html.replace(
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

  // 2. Se não houver wrapper de assinaturas, agrupa os parágrafos finais com assinaturas
  if (!result.includes("contract-signature-block")) {
    const contratanteIdx = result.lastIndexOf("CONTRATANTE");
    const contratadaIdx = result.lastIndexOf("CONTRATADA");
    const validIndices = [contratanteIdx, contratadaIdx].filter((i) => i !== -1);
    const firstSigIdx = validIndices.length > 0 ? Math.min(...validIndices) : -1;

    if (firstSigIdx !== -1) {
      // Procura o início do bloco antes da primeira assinatura (data ou fechamento)
      const beforeSig = result.slice(0, firstSigIdx);
      const pMatches = [...beforeSig.matchAll(/<p\b[^>]*>/gi)];

      let blockStartIdx = -1;
      for (let i = pMatches.length - 1; i >= Math.max(0, pMatches.length - 6); i--) {
        const pMatch = pMatches[i];
        const nextPIndex = i < pMatches.length - 1 ? pMatches[i + 1].index : beforeSig.length;
        const pText = beforeSig.slice(pMatch.index, nextPIndex).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        const isSig = /_{3,}/.test(pText) || /\b(CONTRATANTE|CONTRATADA|TESTEMUNHA|ASSINATURA)\b/i.test(pText);
        const isDateOrClosing =
          /\b\d{1,2}\s+de\s+[a-zçA-ZÇ]+\s+de\s+\d{4}\b/i.test(pText) ||
          /\b(firmam\s+o\s+presente|justos\s+e\s+contratados|duas\s+vias)\b/i.test(pText);

        if (isSig || isDateOrClosing) {
          blockStartIdx = pMatch.index;
        } else {
          // Chegou ao conteúdo anterior (ex: Cláusula)
          break;
        }
      }

      if (blockStartIdx === -1 && pMatches.length > 0) {
        // Fallback: usa o parágrafo da primeira assinatura
        for (let i = pMatches.length - 1; i >= 0; i--) {
          if (pMatches[i].index <= firstSigIdx) {
            blockStartIdx = pMatches[i].index;
            break;
          }
        }
      }

      if (blockStartIdx !== -1) {
        result =
          result.slice(0, blockStartIdx) +
          '<div class="contract-signature-block">' +
          result.slice(blockStartIdx) +
          "</div>";
      }
    }
  }

  return result;
}
