import { describe, expect, it } from "vitest";
import { whatsappHref } from "./whatsapp";

describe("whatsappHref", () => {
  it.each([
    ["(11) 99999-9999", "https://wa.me/5511999999999"],
    ["11 99999-9999", "https://wa.me/5511999999999"],
    ["+55 (11) 99999-9999", "https://wa.me/5511999999999"],
    ["031982023590", "https://wa.me/5531982023590"],
    ["(031) 98202-3590", "https://wa.me/5531982023590"],
    ["031 3222-3344", "https://wa.me/553132223344"],
  ])("normalizes %s", (phone, expected) => expect(whatsappHref(phone)).toBe(expected));
  it.each([undefined, null, "", "123", "telefone", "441234567890"])("rejects %s", (phone) =>
    expect(whatsappHref(phone)).toBeNull(),
  );
});
