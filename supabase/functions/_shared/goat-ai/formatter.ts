/**
 * Formats natural language agent replies specifically for WhatsApp.
 * WhatsApp supports *bold*, _italic_, ~strikethrough~, ```monospace```.
 * It does NOT support GitHub Markdown headers (###), HTML, or double asterisks (**).
 */
export function formatWhatsAppMessage(text: string): string {
  if (!text) return "";

  let formatted = text;

  // 1. Remove horizontal rules (--- or ___)
  formatted = formatted.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

  // 2. Convert Markdown headings (### Title or ## Title or # Title) into bold headers with emojis preserved
  // e.g. "### 🍹 Cardápio de Drinks Selecionados" -> "🍹 *Cardápio de Drinks Selecionados*"
  formatted = formatted.replace(/^[ \t]*#{1,6}[ \t]+(.*)$/gm, (_match, title) => {
    const cleanTitle = title.trim();
    // Check if title starts with emoji
    const emojiMatch = cleanTitle.match(/^([\p{Emoji}\u200d]+|\p{Extended_Pictographic}+)\s*(.*)$/u);
    if (emojiMatch) {
      const emoji = emojiMatch[1].trim();
      const rest = emojiMatch[2].trim().replace(/^\*+|\*+$/g, "");
      return `${emoji} *${rest}*`;
    }
    const noStars = cleanTitle.replace(/^\*+|\*+$/g, "");
    return `*${noStars}*`;
  });

  // 3. Convert double asterisks (**bold**) to single asterisks (*bold*)
  // Be careful to avoid leaving quadruple or unclosed asterisks
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // 4. Clean up bullet lists: lines starting with "- ", "* ", "· " -> "• "
  formatted = formatted.replace(/^[ \t]*[-*·][ \t]+(.*)$/gm, (_match, item) => {
    // If the bullet item itself was wrapped in single asterisks like "*Caipi Limão*", unwrap if it's purely italic markup
    let cleanItem = item.trim();
    if (cleanItem.startsWith("*") && cleanItem.endsWith("*") && cleanItem.indexOf("*", 1) === cleanItem.length - 1) {
      cleanItem = cleanItem.slice(1, -1).trim();
    }
    return `• ${cleanItem}`;
  });

  // 5. Clean up redundant/unmatched asterisks like '****' or dangling '**'
  formatted = formatted.replace(/\*{3,}/g, "*");

  // 6. Clean up spacing and excessive consecutive newlines
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}
