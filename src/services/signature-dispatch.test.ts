import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { convertHtmlToPdf, createPdfArtifacts } from "./pdf-service";
import { convertAndDispatchSignature, createSignatureDispatchLock } from "./signature-dispatch";

describe("signature PDF dispatch", () => {
  it("converts HTML to a valid PDF when the renderer module is available", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nmock pdf");
    const iframeDocument = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      body: {},
    };
    const iframe = { style: {}, contentDocument: iframeDocument };
    const body = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      contains: vi.fn().mockReturnValue(true),
    };
    vi.stubGlobal("document", {
      body,
      createElement: vi.fn().mockReturnValue(iframe),
    });
    const worker = {
      set: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      outputPdf: vi.fn().mockResolvedValue(bytes.buffer),
    };
    const renderer = vi.fn().mockReturnValue(worker);

    const pdf = await convertHtmlToPdf(
      "<p>Contract</p>",
      "Contract",
      renderer as unknown as Parameters<typeof convertHtmlToPdf>[2],
    );

    expect(pdf.blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode(await pdf.blob.arrayBuffer())).toMatch(/^%PDF-/);
    expect(renderer).toHaveBeenCalledOnce();
    expect(worker.from).toHaveBeenCalledWith(iframeDocument.body);
    vi.unstubAllGlobals();
  });

  it("does not call assinafy-create-doc when PDF conversion fails", async () => {
    const createRequest = vi.fn();
    await expect(
      convertAndDispatchSignature({
        html: "<p>contract</p>",
        title: "Contract",
        contractId: "contract-1",
        convert: vi.fn().mockRejectedValue(new Error("PDF conversion failed")),
        provider: { createRequest },
      }),
    ).rejects.toThrow("PDF conversion failed");

    expect(createRequest).not.toHaveBeenCalled();
  });

  it("hashes exactly the bytes encoded for upload", async () => {
    const source = new TextEncoder().encode("%PDF-1.7\nimmutable bytes");
    const pdf = await createPdfArtifacts(source.buffer);
    const uploaded = Buffer.from(pdf.base64, "base64");

    expect(uploaded).toEqual(Buffer.from(source));
    expect(pdf.hash).toBe(createHash("sha256").update(uploaded).digest("hex"));
  });

  it("blocks a second click while dispatch is processing", async () => {
    const lock = createSignatureDispatchLock();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const operation = vi.fn(async () => pending);

    const first = lock.run(operation);
    const second = await lock.run(operation);
    expect(second).toBeUndefined();
    expect(operation).toHaveBeenCalledTimes(1);

    release();
    await first;
    expect(lock.locked).toBe(false);
  });
});
