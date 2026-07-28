/**
 * Converte valores numéricos monetários para o formato por extenso em Português do Brasil (BRL).
 * Exemplo:
 *  - 5472.09 -> "Cinco mil quatrocentos e setenta e dois reais e nove centavos"
 *  - 58.00 -> "Cinquenta e oito reais"
 *  - 1.00 -> "Um real"
 *  - 0.50 -> "Cinquenta centavos"
 */
export function numberToWordsBRL(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "Zero reais";
  }

  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(Math.abs(rounded));
  const centsPart = Math.round((Math.abs(rounded) - intPart) * 100);

  const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function convertGroup(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    const parts: string[] = [];

    if (c > 0) parts.push(hundreds[c]);

    if (d === 1) {
      parts.push(teens[u]);
    } else {
      if (d > 1) parts.push(tens[d]);
      if (u > 0) parts.push(units[u]);
    }

    return parts.join(" e ");
  }

  function convertNumber(n: number): string {
    if (n === 0) return "zero";

    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;

    const parts: string[] = [];

    if (millions > 0) {
      if (millions === 1) {
        parts.push("um milhão");
      } else {
        parts.push(`${convertGroup(millions)} milhões`);
      }
    }

    if (thousands > 0) {
      if (thousands === 1) {
        parts.push("mil");
      } else {
        parts.push(`${convertGroup(thousands)} mil`);
      }
    }

    if (remainder > 0) {
      parts.push(convertGroup(remainder));
    }

    return parts.join(remainder < 100 && (millions > 0 || thousands > 0) ? " e " : " ");
  }

  let text = "";

  if (intPart > 0) {
    const intText = convertNumber(intPart);
    const currencySuffix = intPart === 1 ? "real" : "reais";
    text += `${intText} ${currencySuffix}`;
  }

  if (centsPart > 0) {
    const centsText = convertGroup(centsPart);
    const centsSuffix = centsPart === 1 ? "centavo" : "centavos";
    if (intPart > 0) {
      text += ` e ${centsText} ${centsSuffix}`;
    } else {
      text += `${centsText} ${centsSuffix}`;
    }
  }

  if (intPart === 0 && centsPart === 0) {
    text = "zero reais";
  }

  // Capitaliza a primeira letra
  return text.charAt(0).toUpperCase() + text.slice(1);
}
