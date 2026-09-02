import type { ProposalPageDefinition } from "@/lib/pdf-engine/types";

const commonArcStyle = {
  font: "Times-Roman" as const,
  fontSize: 21.2,
  lineHeight: 25,
  color: "#FFFFFF",
  align: "center" as const,
};

/** Slots dinâmicos da capa de aniversário; toda a arte (inclusive o bolo) vem do PDF-base. */
export const birthdayCoverConfig: ProposalPageDefinition = {
  pageNumber: 1,
  title: "Capa",
  slots: [
    {
      id: "capa-data-orcamento",
      fieldKey: "dataOrcamento",
      type: "date",
      x: 31.47,
      y: 755.4,
      width: 200,
      height: 30,
      style: { font: "Helvetica", fontSize: 20, lineHeight: 24, color: "#FFFFFF", align: "left" },
    },
    {
      id: "capa-nome-evento-topo",
      fieldKey: "nomeEvento",
      type: "arc",
      x: 282.62,
      y: 445.74,
      width: 270,
      height: 270,
      style: commonArcStyle,
      arcConfig: { radius: 114, startDeg: 175, endDeg: 5, position: "top", minFontSize: 16 },
    },
    {
      id: "capa-data-evento",
      fieldKey: "dataEvento",
      type: "arc",
      x: 282.62,
      y: 445.74,
      width: 270,
      height: 270,
      style: { ...commonArcStyle, fontSize: 21.07 },
      arcConfig: { radius: 134.4, startDeg: 216, endDeg: 324, position: "bottom", minFontSize: 16 },
    },
  ],
};

/** Slots dinâmicos da capa de comemoração; taças e textos fixos permanecem no PDF-base. */
export const celebrationCoverConfig: ProposalPageDefinition = {
  ...birthdayCoverConfig,
  slots: birthdayCoverConfig.slots.map((slot) =>
    slot.id === "capa-data-orcamento" ? { ...slot, x: 35.1 } : slot,
  ),
};
