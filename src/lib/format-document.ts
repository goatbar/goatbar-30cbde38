/**
 * format-document.ts
 * 
 * Fonte Única de Verdade para Validação, Formatação e Normalização
 * de Documentos Brasileiros (CPF e CNPJ).
 */

export type BrazilianDocumentType = "CPF" | "CNPJ" | "UNKNOWN" | "Documento";

/**
 * Remove todos os caracteres não numéricos.
 */
export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Identifica o tipo do documento pelo número de dígitos (11 = CPF, 14 = CNPJ).
 */
export function getBrazilianDocumentType(value: string | null | undefined): BrazilianDocumentType {
  const digits = onlyDigits(value);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return "UNKNOWN";
}

/**
 * Formata o CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00).
 */
export function formatBrazilianDocument(value: string | null | undefined): string {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  return digits;
}

/**
 * Retorna o rótulo dinâmico do documento ("CPF", "CNPJ" ou "Documento").
 */
export function getBrazilianDocumentLabel(value: string | null | undefined): string {
  const type = getBrazilianDocumentType(value);
  if (type === "CPF") return "CPF";
  if (type === "CNPJ") return "CNPJ";
  return "Documento";
}


/**
 * Retorna o documento formatado com o rótulo do tipo na frente, usando
 * os utilitários centrais de normalização, identificação e máscara.
 */
export function formatBrazilianDocumentWithLabel(value: string | null | undefined): string {
  const digits = onlyDigits(value);

  if (!digits) {
    return "Documento: Não informado";
  }

  return `${getBrazilianDocumentLabel(digits)}: ${formatBrazilianDocument(digits)}`;
}

/**
 * Compatibilidade para modelos/código legado que ainda referenciam este nome.
 * Não contém regra própria: delega para o formatador central com rótulo.
 */
export const formatDocumentWithType = formatBrazilianDocumentWithLabel;

/**
 * Máscara em tempo real para uso em inputs de formulário (até 14 dígitos).
 */
export function maskBrazilianDocumentInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/**
 * Valida os dígitos verificadores de um CPF (11 dígitos).
 */
export function isValidCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // Rejeita 00000000000, 11111111111...

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

/**
 * Valida os dígitos verificadores de um CNPJ (14 dígitos).
 */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // Rejeita 00000000000000...

  let size = digits.length - 2;
  let numbers = digits.substring(0, size);
  const verifiers = digits.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(verifiers.charAt(0), 10)) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(verifiers.charAt(1), 10)) return false;

  return true;
}

/**
 * Validação completa de CPF ou CNPJ com relatório detalhado.
 */
export function validateBrazilianDocument(value: string | null | undefined): {
  valid: boolean;
  type: BrazilianDocumentType;
  digits: string;
  formatted: string;
  error?: string;
} {
  const digits = onlyDigits(value);
  const type = getBrazilianDocumentType(digits);

  if (type === "UNKNOWN") {
    return {
      valid: false,
      type,
      digits,
      formatted: digits,
      error: "Informe um CPF com 11 dígitos ou um CNPJ com 14 dígitos.",
    };
  }

  const valid = type === "CPF" ? isValidCPF(digits) : isValidCNPJ(digits);

  return {
    valid,
    type,
    digits,
    formatted: formatBrazilianDocument(digits),
    error: valid ? undefined : `O ${type} informado é inválido.`,
  };
}

/**
 * Função utilitária de sanitização profunda de templates para remover caracteres residuais (xxxx, xxx, xx, x)
 * colados diretamente a placeholders no corpo do documento.
 */
export function sanitizeTemplateResiduals(templateContent: string): string {
  if (!templateContent) return "";
  let clean = templateContent;

  // 1. Remove sufixos x, xx, xxx, xxxx colados a tags {{...}}, [...], ${...}
  clean = clean.replace(/(\{\{\s*[\w.]+\s*\}\})(?:x{1,4})/gi, "$1");
  clean = clean.replace(/(\[\s*[\w._]+\s*\])(?:x{1,4})/gi, "$1");
  clean = clean.replace(/(\$\{\s*[\w.]+\s*\}\})(?:x{1,4})/gi, "$1");

  // 2. Remove sufixos x, xx, xxx, xxxx colados a invólucros de chips HTML
  clean = clean.replace(/(<\/span>)(?:x{1,4})/gi, "$1");

  return clean;
}
