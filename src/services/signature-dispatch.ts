import type { PdfArtifacts } from "./pdf-service";

export interface SignatureDispatchProvider<Result> {
  createRequest(payload: {
    contractId: string;
    pdfBase64: string;
    pdfHash: string;
  }): Promise<Result>;
}

export function getSignatureDispatchIdentifiers(
  eventId: string,
  contract: { id: string },
): { eventId: string; contractId: string; contractRecordId: string } {
  return { eventId, contractId: contract.id, contractRecordId: contract.id };
}

/** Converts first and never contacts the signature provider when PDF generation fails. */
export async function convertAndDispatchSignature<Result>(options: {
  html: string;
  title: string;
  contractId: string;
  convert: (html: string, title: string) => Promise<PdfArtifacts>;
  provider: SignatureDispatchProvider<Result>;
}): Promise<{ pdf: PdfArtifacts; result: Result }> {
  const pdf = await options.convert(options.html, options.title);
  const result = await options.provider.createRequest({
    contractId: options.contractId,
    pdfBase64: pdf.base64,
    pdfHash: pdf.hash,
  });
  return { pdf, result };
}

/** Synchronous lock: unlike React state, it also blocks a second click in the same render tick. */
export function createSignatureDispatchLock() {
  let locked = false;
  return {
    get locked() {
      return locked;
    },
    async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
      if (locked) return undefined;
      locked = true;
      try {
        return await operation();
      } finally {
        locked = false;
      }
    },
  };
}
