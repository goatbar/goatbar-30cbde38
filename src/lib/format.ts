export const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export const fmtBRL2 = fmtBRL;

export const fmtPct = (v: number) => `${v.toFixed(1)}%`;
