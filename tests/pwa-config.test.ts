import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifestPath = fileURLToPath(
  new URL("../public/manifest.webmanifest", import.meta.url),
);
const indexPath = fileURLToPath(new URL("../index.html", import.meta.url));
const serviceWorkerPath = fileURLToPath(
  new URL("../public/sw.js", import.meta.url),
);
const vercelPath = fileURLToPath(new URL("../vercel.json", import.meta.url));

describe("PWA configuration", () => {
  it("keeps Goat Bar branding and standalone mode", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(manifest.name).toBe("Goat Bar");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#0F1414");
    expect(manifest.theme_color).toBe("#701117");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/goatbar-192.png",
          sizes: "192x192",
        }),
        expect.objectContaining({
          src: "/icons/goatbar-512.png",
          sizes: "512x512",
        }),
      ]),
    );
  });

  it("declares the official iPhone home screen icon", () => {
    const indexHtml = readFileSync(indexPath, "utf8");

    expect(indexHtml).toContain('rel="apple-touch-icon"');
    expect(indexHtml).toContain("/icons/apple-touch-icon.png");
  });

  it("keeps the service worker isolated from external integrations", () => {
    const serviceWorker = readFileSync(serviceWorkerPath, "utf8");

    expect(serviceWorker).toContain(
      "if (url.origin !== self.location.origin)",
    );
  });

  it("serves PWA files without SPA rewrites", () => {
    const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
    const source = vercel.rewrites[0].source;

    expect(source).toContain("icons/");
    expect(source).toContain("manifest.webmanifest");
    expect(source).toContain("sw.js");
  });

  it("includes all required icon files", () => {
    const iconPaths = [
      "../public/icons/apple-touch-icon.png",
      "../public/icons/goatbar-192.png",
      "../public/icons/goatbar-512.png",
    ].map((path) => fileURLToPath(new URL(path, import.meta.url)));

    for (const iconPath of iconPaths) {
      expect(existsSync(iconPath)).toBe(true);
    }
  });
});
