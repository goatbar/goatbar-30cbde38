// supabase/functions/contract-render-pdf/sanitize.ts
// Strict HTML sanitization and semantic signature grouping for contract PDF generation

/**
 * Sanitiza o HTML enviado pelo frontend:
 * 1. Remove tags executáveis ou estilizadoras externas (<script>, <style>, <link>, <iframe>, <object>, <embed>).
 * 2. Remove todos os event handlers inline (on*).
 * 3. Bloqueia recursos externos não autorizados em src, href, srcset, poster, background e url(...).
 * 4. Assegura o agrupamento tolerante do bloco de assinaturas (.contract-signature-block).
 */
export function sanitizeAndPrepareContractHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  let clean = rawHtml;

  // 1. Remover tags perigosas e de estilos/links externos
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  clean = clean.replace(/<link\b[^>]*\/?>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^>]*\/?>/gi, "");

  // 2. Remover atributos inline on* (ex: onclick, onload, onerror)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 3. Bloquear recursos externos em src, srcset, poster, background (permite apenas data: seguro)
  clean = clean.replace(/\s+src\s*=\s*["'](?:\s*(?:https?:|\/\/)[^"']*)["']/gi, ' src=""');
  clean = clean.replace(/\s+srcset\s*=\s*["'][^"']*["']/gi, "");
  clean = clean.replace(/\s+poster\s*=\s*["'][^"']*["']/gi, "");
  clean = clean.replace(/\s+background\s*=\s*["'][^"']*["']/gi, "");

  // 4. Bloquear links externos não autorizados (substitui por href="#")
  clean = clean.replace(/\s+href\s*=\s*["'](?:\s*(?:https?:|\/\/)[^"']*)["']/gi, ' href="#"');

  // 5. Normalizar estilos inline para o documento oficial.
  // O editor pode carregar cores/opacidade do DOCX; na emissão oficial o texto precisa
  // permanecer preto sobre branco, exatamente como na prévia canônica.
  clean = clean.replace(/style\s*=\s*(["'])([\s\S]*?)\1/gi, (_match, quote, styleContent) => {
    let sanitizedStyle = styleContent.replace(/url\(\s*(?!['"]?data:image\/)[^)]*\)/gi, "none");
    sanitizedStyle = sanitizedStyle.replace(
      /(?:^|;)\s*(?:color|-webkit-text-fill-color|opacity|filter|mix-blend-mode)\s*:[^;]*/gi,
      "",
    );
    return `style=${quote}${sanitizedStyle}${quote}`;
  });

  // Remove também o atributo HTML legado <font color="..."> importado de DOCX.
  clean = clean.replace(
    /(<font\b[^>]*?)\s+color\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    "$1",
  );

  // 6. Marca semanticamente cada linha de assinatura, inclusive em minutas
  // geradas antes da atualização do template. Isso garante espaço suficiente para
  // o selo/assinatura eletrônica no PDF oficial.
  clean = clean.replace(
    /<p(?![^>]*class=)([^>]*)>(\s*_{3,}[\s\S]*?\b(?:CONTRATANTE|CONTRATADA|TESTEMUNHA)\b[\s\S]*?)<\/p>/gi,
    '<p class="contract-signature-line"$1>$2</p>',
  );

  // 7. Agrupamento tolerante e não-destrutivo do bloco de assinaturas
  if (!clean.includes("contract-signature-block")) {
    const contratanteIdx = clean.lastIndexOf("CONTRATANTE");
    const contratadaIdx = clean.lastIndexOf("CONTRATADA");
    const validIndices = [contratanteIdx, contratadaIdx].filter((i) => i !== -1);
    const firstSigIdx = validIndices.length > 0 ? Math.min(...validIndices) : -1;

    if (firstSigIdx !== -1) {
      const beforeSig = clean.slice(0, firstSigIdx);
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
          break;
        }
      }

      if (blockStartIdx === -1 && pMatches.length > 0) {
        for (let i = pMatches.length - 1; i >= 0; i--) {
          if (pMatches[i].index <= firstSigIdx) {
            blockStartIdx = pMatches[i].index;
            break;
          }
        }
      }

      if (blockStartIdx !== -1) {
        clean =
          clean.slice(0, blockStartIdx) +
          '<div class="contract-signature-block">' +
          clean.slice(blockStartIdx) +
          "</div>";
      }
    }
  }

  return clean;
}
