import type { EventMenuModel } from "@/lib/event-menu";

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));

export function buildEventMenuHtml(menu: EventMenuModel): string {
  const drinks = menu.drinks.map(d => `<section class="drink"><strong>${esc(d.name)}</strong>${d.description ? `<p>${esc(d.description)}</p>` : ""}</section>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#f3e1e1;color:#383332;font-family:Arial,sans-serif}
.page{width:210mm;height:297mm;padding:30mm 22mm 28mm;position:relative;overflow:hidden}
.arch{position:absolute;left:14mm;right:14mm;top:0;height:53mm;background:#fffdf9;border-radius:0 0 50% 50%}
.content{position:relative;height:100%;display:flex;flex-direction:column;text-align:center}
h1{margin:0 0 18mm;color:#7b1f2c;font:600 13mm Georgia,serif}
.drinks{display:grid;grid-template-columns:${menu.columns === 2 ? "1fr 1fr" : "1fr"};gap:${menu.layout === "compact" ? "3mm" : menu.layout === "standard" ? "4mm" : "6mm"} 9mm;align-content:start}
.drink{break-inside:avoid}.drink strong{display:block;color:#7b1f2c;font:600 ${menu.layout === "compact" ? "3.5mm" : "4mm"} Georgia,serif}
.drink p{margin:1mm auto 0;max-width:72mm;font-size:${menu.layout === "compact" ? "2.5mm" : "2.8mm"};line-height:1.25}
.personalization{margin-top:auto;min-height:25mm;color:#7b1f2c;font:5mm Georgia,serif;display:flex;align-items:center;justify-content:center}
.footer{border-top:.2mm solid rgba(123,31,44,.25);padding-top:3mm;color:#7b1f2c;font-size:2.8mm;font-weight:700;letter-spacing:1.5mm}
</style></head><body><main class="page"><div class="arch"></div><div class="content"><h1>Menu</h1><div class="drinks">${drinks}</div><div class="personalization">${menu.subtitle ? esc(menu.subtitle) : ""}</div><footer class="footer">GOAT BAR</footer></div></main></body></html>`;
}

export function downloadEventMenuHtml(menu: EventMenuModel, filename = "cardapio-goat-bar.html") {
  const blob = new Blob([buildEventMenuHtml(menu)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
