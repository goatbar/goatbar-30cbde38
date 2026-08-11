import { describe, expect, it } from "vitest";
import { extractProvidedToken, redactSensitive, secureTokenMatches } from "./logic";

describe("Assinafy webhook authentication", () => {
  it("accepts the configured secret through the provider-compatible query parameter", async () => {
    const request = new Request("https://example.test/assinafy-webhook?token=expected", {
      method: "POST",
    });
    expect(await secureTokenMatches(extractProvidedToken(request), "expected")).toBe(true);
  });

  it("fails closed for absent or invalid secrets", async () => {
    expect(await secureTokenMatches(null, "expected")).toBe(false);
    expect(await secureTokenMatches("wrong", "expected")).toBe(false);
  });

  it("redacts credentials before audit persistence", () => {
    expect(
      redactSensitive({ token: "secret", nested: { authorization: "bearer" }, id: "safe" }),
    ).toEqual({ token: "[REDACTED]", nested: { authorization: "[REDACTED]" }, id: "safe" });
  });
});
