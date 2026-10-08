/** Returns a WhatsApp URL for a Brazilian phone, or null for invalid formats. */
export function whatsappHref(phone: string | null | undefined): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  // Some event registrations include a domestic trunk prefix: 0 + DDD + phone.
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }
  // International prefix 55 can be provided with or without a +.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (!/^\d{2}\d{8,9}$/.test(digits)) return null;
  if (digits.startsWith("0")) return null;
  return `https://wa.me/55${digits}`;
}
