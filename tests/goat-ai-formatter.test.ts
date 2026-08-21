import { describe, it, expect } from "vitest";
import { formatWhatsAppMessage } from "../supabase/functions/_shared/goat-ai/formatter";

describe("formatWhatsAppMessage", () => {
  it("converts headings with emojis into WhatsApp bold format with emoji outside asterisks", () => {
    const input = "### 🍹 Cardápio de Drinks Selecionados\n\n### 📋 Detalhes do Evento";
    const output = formatWhatsAppMessage(input);
    expect(output).toContain("🍹 *Cardápio de Drinks Selecionados*");
    expect(output).toContain("📋 *Detalhes do Evento*");
    expect(output).not.toContain("###");
  });

  it("converts standard headings without emojis into *Title*", () => {
    const input = "## Próximos Eventos\n\nLista de eventos";
    const output = formatWhatsAppMessage(input);
    expect(output).toContain("*Próximos Eventos*");
    expect(output).not.toContain("##");
  });

  it("converts double asterisks **bold** to single asterisks *bold*", () => {
    const input = "Temos **5 eventos confirmados** para o período.";
    const output = formatWhatsAppMessage(input);
    expect(output).toBe("Temos *5 eventos confirmados* para o período.");
  });

  it("converts various bullet types (-, *, ·) to standard bullet • and strips redundant italic stars from bullet lines", () => {
    const input = "· *Caipi Limão Cravo e Mel*\n· *Caipivodka Abacaxi*\n- Moscow Mule\n* Mojito";
    const output = formatWhatsAppMessage(input);
    expect(output).toBe("• Caipi Limão Cravo e Mel\n• Caipivodka Abacaxi\n• Moscow Mule\n• Mojito");
  });

  it("removes horizontal rules --- and collapses excessive blank lines", () => {
    const input = "Primeira linha\n\n---\n\n\n\nSegunda linha";
    const output = formatWhatsAppMessage(input);
    expect(output).toBe("Primeira linha\n\nSegunda linha");
    expect(output).not.toContain("---");
  });

  it("formats the full event menu example perfectly", () => {
    const input = `### 🍹 Cardápio de Drinks Selecionados

· *Caipi Limão Cravo e Mel*
· *Caipivodka Abacaxi*
· *Caipivodka Maracujá*

---

### 📋 Detalhes do Evento
· *Cliente:* Luísa de Paula
· *Data:* 05/09/2026
· *Status:* Confirmado`;

    const output = formatWhatsAppMessage(input);
    expect(output).toContain("🍹 *Cardápio de Drinks Selecionados*");
    expect(output).toContain("• Caipi Limão Cravo e Mel");
    expect(output).toContain("• Caipivodka Abacaxi");
    expect(output).toContain("📋 *Detalhes do Evento*");
    expect(output).toContain("• *Cliente:* Luísa de Paula");
    expect(output).not.toContain("###");
    expect(output).not.toContain("---");
  });
});
