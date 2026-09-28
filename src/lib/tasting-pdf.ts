import html2pdf from "html2pdf.js";

type ExportOptions = {
  minWidth?: number;
  backgroundColor?: string;
  hideSelector?: string;
};

export async function exportElementAsPortraitPdf(
  source: HTMLElement,
  filename: string,
  options: ExportOptions = {},
) {
  const ownerDocument = source.ownerDocument || document;
  const backgroundColor = options.backgroundColor || "#0f1414";
  const hideSelector = options.hideSelector || '[data-pdf-hide="true"]';
  const minWidth = options.minWidth || 1200;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(hideSelector).forEach((el) => el.remove());

  const captureWidth = Math.max(
    Math.ceil(source.getBoundingClientRect().width),
    source.scrollWidth,
    minWidth,
  );

  clone.style.width = `${captureWidth}px`;
  clone.style.maxWidth = `${captureWidth}px`;
  clone.style.minWidth = `${captureWidth}px`;
  clone.style.margin = "0";
  clone.style.backgroundColor = backgroundColor;
  clone.style.overflow = "visible";

  const host = ownerDocument.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${captureWidth}px`;
  host.style.backgroundColor = backgroundColor;
  host.style.zIndex = "-1";
  host.appendChild(clone);
  ownerDocument.body.appendChild(host);

  try {
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      ),
    );

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    await html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        filename,
        image: { type: "jpeg", quality: 0.99 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor,
          windowWidth: captureWidth,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(clone)
      .save();
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}

export async function exportTastingPublicPagePdf(
  publicToken: string,
  eventName: string,
) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-20000px";
  iframe.style.top = "0";
  iframe.style.width = "1440px";
  iframe.style.height = "9000px";
  iframe.style.border = "0";
  iframe.style.pointerEvents = "none";
  iframe.src = `/degustacao/${publicToken}?pdf=1`;
  document.body.appendChild(iframe);

  const waitForFinalPage = async () => {
    const started = Date.now();
    while (Date.now() - started < 15000) {
      const doc = iframe.contentDocument;
      const summary = doc?.querySelector(
        '[data-tasting-final-summary="true"]',
      ) as HTMLElement | null;
      const main = doc?.querySelector("main") as HTMLElement | null;
      if (summary && main) return main;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error("A página final da degustação não ficou pronta para exportação.");
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Tempo esgotado ao carregar a degustação.")),
        15000,
      );
      iframe.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      iframe.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Não foi possível carregar a degustação para gerar o PDF."));
      };
    });

    const main = await waitForFinalPage();
    const safeName = String(eventName || "Degustacao").replace(
      /[^a-z0-9]+/gi,
      "_",
    );

    await exportElementAsPortraitPdf(
      main,
      `Degustacao_${safeName}.pdf`,
      { minWidth: 1200, backgroundColor: "#0f1414" },
    );
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}
