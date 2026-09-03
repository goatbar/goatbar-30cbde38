import type { ProposalTemplateDefinition } from "@/lib/pdf-engine/types";
import cleanTemplateUrl from "./clean-template.pdf?url";

/**
 * TEMPLATE OFICIAL: Proposta Comercial Goat Bar — Comemoração / Corporativo (16:9 Widescreen)
 * Páginas 6 e 7 com a mesma configuração funcional e mecânica do modelo de Casamento baseline.
 */
export const GOATBAR_COMEMORACAO_V1_TEMPLATE: ProposalTemplateDefinition = {
  id: "goatbar-comemoracao",
  version: "1.0.0",
  name: "Proposta Comercial Goat Bar — Comemoração",
  description: "Modelo oficial 16:9 para Comemoração, Festas e Eventos Corporativos",
  isDevelopment: false,
  basePdfPath: cleanTemplateUrl,
  pageSize: {
    width: 1440.0,
    height: 810.0,
  },
  overflow: {
    enabled: true,
    maxMenuHeight: 280,
    continuationPageTitle: "Drinks & Experiências",
  },
  pages: [
    // --- PÁGINA 1: CAPA COMEMORAÇÃO ---
    {
      pageNumber: 1,
      title: "Capa",
      slots: [
        {
          id: "capa-data-orcamento",
          fieldKey: "dataOrcamento",
          type: "date",
          x: 66.77,
          y: 775.39,
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
          id: "capa-nome-evento-topo",
          fieldKey: "nomeEvento",
          type: "arc",
          x: 282.62,
          y: 459.0,
          width: 270,
          height: 270,
          style: {
            font: "Times-Roman",
            fontSize: 21.2,
            lineHeight: 25,
            color: "#FFFFFF",
            align: "center",
          },
          arcConfig: {
            radius: 118,
            startDeg: 175,
            endDeg: 5,
            position: "top",
            minFontSize: 16,
          },
        },
        {
          id: "capa-data-evento",
          fieldKey: "dataEvento",
          type: "arc",
          x: 282.62,
          y: 459.0,
          width: 270,
          height: 270,
          style: {
            font: "Times-Roman",
            fontSize: 21.07,
            lineHeight: 25,
            color: "#FFFFFF",
            align: "center",
          },
          arcConfig: {
            radius: 138,
            startDeg: 216,
            endDeg: 324,
            position: "bottom",
            minFontSize: 16,
          },
        },
      ],
    },

    // --- PÁGINAS 2 A 5: ESTÁTICAS ---
    { pageNumber: 2, title: "Sobre a Goat Bar", slots: [] },
    { pageNumber: 3, title: "Nosso propósito", slots: [] },
    { pageNumber: 4, title: "O Bar dos Sonhos de Vocês", slots: [] },
    { pageNumber: 5, title: "Por que escolher a Goat Bar?", slots: [] },

    // --- PÁGINA 6: DRINKS & EXPERIÊNCIAS (Cópia exata do casamento) ---
    {
      pageNumber: 6,
      title: "Drinks & Experiências",
      isMenuPage: true,
      menuSafeArea: {
        drinksStartY: 301.3,
        drinksMaxHeight: 280,
        bebidasStartY: 640.0,
        bebidasMaxHeight: 140,
      },
      slots: [
        {
          id: "drinks-list",
          fieldKey: "drinks",
          type: "bullet_list",
          x: 81.0,
          y: 311.0,
          width: 600,
          height: 280,
          style: {
            font: "Helvetica",
            fontSize: 20,
            lineHeight: 31,
            color: "#7D1018",
            align: "left",
          },
        },
        {
          id: "bebidas-list",
          fieldKey: "bebidas",
          type: "bullet_list",
          x: 81.0,
          y: 648.0,
          width: 600,
          height: 140,
          style: {
            font: "Helvetica",
            fontSize: 20,
            lineHeight: 27.5,
            color: "#7D1018",
            align: "left",
          },
        },
      ],
    },

    // --- PÁGINA 7: VALORES E CONDIÇÕES (Cópia exata da estrutura de casamento) ---
    {
      pageNumber: 7,
      title: "Valores e condições",
      slots: [
        {
          id: "resumo-convidados",
          fieldKey: "quantidadePessoasFormatted",
          type: "text",
          x: 81.0,
          y: 145.92,
          width: 500,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
          transform: (val, canonical) => {
            const count = canonical.quantidadePessoasFormatted || val || "70";
            return `Número de convidados: ${count} pessoas`;
          },
        },
        {
          id: "resumo-duracao-horas",
          fieldKey: "quantidadeHorasEventoFormatted",
          type: "text",
          x: 42.39,
          y: 216.01,
          width: 700,
          height: 35,
          style: {
            font: "Helvetica",
            fontSize: 28.99,
            lineHeight: 32,
            color: "#FFFFFF",
            align: "left",
          },
          transform: (val, canonical) => {
            const hours = canonical.quantidadeHorasEventoFormatted || val || "5";
            return `Serviço de bar completo durante ${hours} horas de festa`;
          },
        },
        {
          id: "resumo-equipe-staff",
          fieldKey: "qtdBartendersFormatted",
          type: "bullet_list",
          x: 890.0,
          y: 284.19,
          width: 400,
          height: 110,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 32.68,
            color: "#FFFFFF",
            align: "left",
          },
          transform: (_val, canonical) => {
            const items = [
              canonical.qtdBartendersFormatted,
              canonical.qtdBarKeepersFormatted,
              canonical.qtdCopeirasFormatted,
            ].filter((s) => s && s.trim().length > 0);
            return items.map((i) => (i.startsWith("•") ? i : `• ${i}`)).join("\n");
          },
        },
        {
          id: "resumo-variedades-drinks",
          fieldKey: "quantidadeVariedadesDrinksFormatted",
          type: "text",
          x: 118.0,
          y: 460.37,
          width: 600,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
          transform: (val, canonical) => {
            const count = canonical.quantidadeVariedadesDrinksFormatted || val || "7";
            return `• Carta composta por ${count} variedades de drinks`;
          },
        },
        {
          id: "resumo-investimento-total",
          fieldKey: "valorInvestimentoFormatted",
          type: "currency",
          x: 130.77,
          y: 647.96,
          width: 400,
          height: 40,
          style: {
            font: "Helvetica",
            fontSize: 30,
            lineHeight: 34,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-formas-pagamento",
          fieldKey: "dataFinalPagamento",
          type: "text",
          x: 750.85,
          y: 632.96,
          width: 650,
          height: 130,
          style: {
            font: "Helvetica",
            fontSize: 25,
            lineHeight: 25,
            color: "#FFFFFF",
            align: "left",
          },
          transform: (val, canonical) => {
            const dataFinal = canonical.dataFinalPagamento || (typeof val === "string" ? val : "") || "03.10.2026";
            return dataFinal;
          },
        },
      ],
    },

    // --- PÁGINA 8: ESTÁTICA ---
    { pageNumber: 8, title: "Vamos brindar juntos?", slots: [] },
  ],
};
