import type { ProposalTemplateDefinition } from "@/lib/pdf-engine/types";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "../goatbar-commercial-v1/template";

/**
 * TEMPLATE OFICIAL: Proposta Comercial Goat Bar — Despedida de Solteira
 * Variante oficial calibrada para despedidas e eventos com destaque de nome central em duas linhas.
 */
export const GOATBAR_DESPEDIDA_V1_TEMPLATE: ProposalTemplateDefinition = {
  ...GOATBAR_COMMERCIAL_V1_TEMPLATE,
  id: "goatbar-despedida",
  version: "1.0.0",
  name: "Proposta Comercial Goat Bar — Despedida de Solteira",
  description: "Variante oficial 16:9 para Despedida de Solteira com destaque nominal na capa",
  isDevelopment: false,
  pages: [
    // --- PÁGINA 1: CAPA DESPEDIDA ---
    {
      pageNumber: 1,
      title: "Capa",
      slots: [
        {
          id: "capa-data-orcamento",
          fieldKey: "dataOrcamento",
          type: "date",
          x: 35.1,
          y: 755.4,
          width: 200,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 20,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "capa-despedida-titulo-arco",
          fieldKey: "nomeEvento",
          type: "text",
          x: 170.0,
          y: 315.0,
          width: 240,
          height: 30,
          style: {
            font: "Helvetica-Bold",
            fontSize: 20,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "center",
          },
          transform: (val) => {
            const raw = String(val || "").toUpperCase();
            if (raw.includes("DESPEDIDA")) return raw;
            return "DESPEDIDA DE SOLTEIRA";
          },
        },
        {
          id: "capa-despedida-homenageada",
          fieldKey: "nomeCliente",
          type: "text",
          x: 170.0,
          y: 385.0,
          width: 240,
          height: 70,
          style: {
            font: "Helvetica-Bold",
            fontSize: 32,
            lineHeight: 36,
            color: "#FFFFFF",
            align: "center",
          },
          transform: (val, canonical) => {
            const client = String(val || canonical.nomeEvento || "").trim();
            const parts = client.split(" ");
            if (parts.length >= 2) {
              return `${parts[0].toUpperCase()}\n${parts.slice(1).join(" ").toUpperCase()}`;
            }
            return client.toUpperCase();
          },
        },
        {
          id: "capa-data-evento",
          fieldKey: "dataEvento",
          type: "date",
          x: 170.0,
          y: 535.0,
          width: 240,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 20,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "center",
          },
        },
      ],
    },
    // Páginas 2 a 8 reaproveitadas da base comercial
    ...GOATBAR_COMMERCIAL_V1_TEMPLATE.pages.slice(1),
  ],
};
