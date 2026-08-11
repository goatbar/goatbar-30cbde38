import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  buildContractPdfDocument,
  CONTRACT_PDF_MIME_TYPE,
  convertHtmlToPdf,
  createPdfArtifacts,
} from "./pdf-service";
import { convertAndDispatchSignature, createSignatureDispatchLock } from "./signature-dispatch";

describe("signature PDF dispatch", () => {
  it("converts HTML to a valid PDF when the renderer module is available", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nmock pdf");
    const iframeDocument = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      body: {},
      getElementById: vi.fn().mockReturnValue({ id: "contract-pdf-document" }),
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
    expect(worker.from).toHaveBeenCalledWith({ id: "contract-pdf-document" });
    expect(worker.set).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "Contract.pdf",
        html2canvas: expect.objectContaining({ backgroundColor: "#ffffff" }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("builds a self-contained light A4 document without changing contract semantics", () => {
    const source =
      '<h1 class="font-bold">Título ágil</h1><p>Cláusula <strong>essencial</strong>.</p><ul><li>Item</li></ul><div class="docx-page-break" style="page-break-after: always"></div>';
    const documentHtml = buildContractPdfDocument(source, "Contrato & revisão");

    expect(documentHtml).toContain('<meta charset="UTF-8">');
    expect(documentHtml).toContain("background:#ffffff");
    expect(documentHtml).toContain("color:#000000");
    expect(documentHtml).toContain("color-scheme:light");
    expect(documentHtml).toContain("width: 180mm");
    expect(documentHtml).toContain("page-break-after: always");
    expect(documentHtml).toContain("<strong>essencial</strong>");
    expect(documentHtml).toContain("<p>Cláusula");
    expect(documentHtml).toContain("<ul><li>Item</li></ul>");
    expect(documentHtml).not.toMatch(/prefers-color-scheme|class="dark"|dark:/);
    expect(documentHtml).not.toContain("var(--");
    expect(documentHtml).toContain('<h1 class="font-bold">Título ágil</h1>');
    expect(source).toContain('class="font-bold"');
    expect(documentHtml).toContain("Contrato &amp; revisão");
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
    expect(pdf.blob.type).toBe(CONTRACT_PDF_MIME_TYPE);
    expect(pdf.hash).toBe(createHash("sha256").update(uploaded).digest("hex"));
  });

  it("rejects bytes falsely declared as PDF", async () => {
    const htmlBytes = new TextEncoder().encode("<html>not a pdf</html>");
    await expect(createPdfArtifacts(htmlBytes.buffer)).rejects.toThrow("PDF válido");
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
