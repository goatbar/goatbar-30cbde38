/** Returns a wa.me URL, or null when the value is not a plausible telephone number. */
export function whatsappHref(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.length > 11 && !digits.startsWith("55")) return null;
  const normalized = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${normalized}`;
}
