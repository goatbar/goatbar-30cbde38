/**
 * Utilitário centralizado para formatação e identificação de CPF / CNPJ.
 * Utilizado uniformemente em:
 *  - Tela de Dados do Contratante
 *  - Mapeamento de Campos (Match)
 *  - Pré-visualização da Minuta
 *  - Geração de PDF e envio para Assinatura
 */

export function getRawDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatBrazilianDocument(value: string | null | undefined): string {
  if (!value) return "";
  const digits = getRawDigits(value);

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  // Se o valor já vier formatado ou for incompleto/diferente, retorna o texto limpo sem resíduos ou xx
  return String(value).trim();
}

export function getBrazilianDocumentType(
  value: string | null | undefined
): "CPF" | "CNPJ" | "Documento" {
  const digits = getRawDigits(value);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return "Documento";
}

export function formatDocumentWithType(value: string | null | undefined): string {
  if (!value || value === "Não informado") return "Não informado";
  const docType = getBrazilianDocumentType(value);
  const formatted = formatBrazilianDocument(value);
  return `${docType}: ${formatted}`;
}
