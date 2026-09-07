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
  it("converts HTML to a valid PDF via Cloudflare Browser Run transport", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nmock pdf bytes");
    const mockTransport = vi.fn().mockResolvedValue(bytes.buffer);

    const pdf = await convertHtmlToPdf(
      "<p>Contract</p>",
      "Contract",
      mockTransport,
    );

    expect(pdf.blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode(await pdf.blob.arrayBuffer())).toMatch(/^%PDF-/);
    expect(mockTransport).toHaveBeenCalledOnce();
    expect(mockTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Contract",
      }),
    );
  });

  it("builds a self-contained light A4 document without changing contract semantics", () => {
    const source =
      '<h1 class="font-bold">Título ágil</h1><p>Cláusula <strong>essencial</strong>.</p><ul><li>Item</li></ul><div class="docx-page-break" style="page-break-after: always"></div>';
    const documentHtml = buildContractPdfDocument(source, "Contrato & revisão");

    expect(documentHtml).toContain('<meta charset="UTF-8">');
    expect(documentHtml).toContain("background:#ffffff");
    expect(documentHtml).toContain("color-scheme: light");
    expect(documentHtml).toContain("page-break-after: always");
    expect(documentHtml).toContain("<strong>essencial</strong>");
    expect(documentHtml).toContain("<p>Cláusula");
    expect(documentHtml).toContain("<ul><li>Item</li></ul>");
    expect(documentHtml).not.toMatch(/prefers-color-scheme|class="dark"|dark:/);
    expect(documentHtml).not.toContain("var(--");
    expect(documentHtml).toContain("GoatBarContractFont");
    expect(documentHtml).toContain('<h1 class="font-bold">Título ágil</h1>');
    expect(source).toContain('class="font-bold"');
    expect(documentHtml).toContain("Contrato &amp; revisão");
  });

  it("adds legal-document hierarchy and groups signature block without changing compiled content", () => {
    const source = `<p>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</p>
      <p>CONTRATANTE:</p><p>Nome: Mariana Campos Moreira</p>
      <p>CLÁUSULA 1 – DO OBJETO DO CONTRATO</p>
      <p>1.1. O presente contrato tem por objeto...</p>
      <p>a) Montagem do bar no local do evento;</p>
      <p>E, por estarem assim justos e contratados, firmam o presente.</p>
      <p>Sete Lagoas, 14 de novembro de 2026</p>
      <p>_________________________________________<br>CONTRATANTE - Mariana Campos Moreira</p>
      <p>_________________________________________<br>CONTRATADA - Gabriel Santos Silva</p>`;

    const documentHtml = buildContractPdfDocument(source, "Contrato");

    expect(documentHtml).toContain('class="contract-title"');
    expect(documentHtml).toContain('class="contract-party-heading"');
    expect(documentHtml).toContain('class="contract-clause-heading"');
    expect(documentHtml).toContain('class="contract-alpha-item"');
    expect(documentHtml).toContain('class="contract-signature-block"');
    expect(documentHtml).toContain("Nome: Mariana Campos Moreira");
    expect(documentHtml).toContain("1.1. O presente contrato tem por objeto...");
    expect(documentHtml).toContain("Gabriel Santos Silva");
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
