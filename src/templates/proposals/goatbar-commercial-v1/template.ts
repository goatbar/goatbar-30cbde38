import type { ProposalTemplateDefinition } from "@/lib/pdf-engine/types";
import cleanTemplateUrl from "./clean-template.pdf?url";

/**
 * TEMPLATE OFICIAL: Proposta Comercial Goat Bar (16:9 Widescreen)
 * Calibrado pixel a pixel a partir dos PDFs reais do Canva.
 *
 * NOTA TIPOGRÁFICA:
 * Utiliza Helvetica / Helvetica-Bold como fallback tipográfico padrão do PDF.
 * Para fidelidade visual estrita (0% diff nas páginas de texto), suporta a futura
 * inclusão dos arquivos .ttf das fontes comerciais:
 * - Neue Montreal (Regular / Bold)
 * - Allrounder Monument (Regular / Book)
 */
export const GOATBAR_COMMERCIAL_V1_TEMPLATE: ProposalTemplateDefinition = {
  id: "goatbar-commercial",
  version: "1.0.0",
  name: "Proposta Comercial Goat Bar",
  description: "Modelo oficial 16:9 (1440x810) - Base vetorial corrigida com fallback Helvetica",
  isDevelopment: false,
  // URL processada pelo Vite. O gerador roda no browser; usar `fs` aqui fazia o
  // template desaparecer silenciosamente no bundle e deixava texto branco sobre
  // páginas brancas, embora o texto ainda fosse extraível do PDF.
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
    // --- PÁGINA 1: CAPA ---
    {
      pageNumber: 1,
      title: "Capa",
      slots: [
        {
          id: "capa-data-orcamento",
          fieldKey: "dataOrcamento",
          type: "date",
          x: 66.8,
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
          id: "capa-inicial-noivo",
          fieldKey: "inicialNoivo",
          type: "text",
          x: 204.5,
          y: 393.6,
          width: 70,
          height: 100,
          style: {
            font: "Helvetica-Bold",
            fontSize: 93,
            lineHeight: 95,
            color: "#FFFFFF",
            align: "center",
          },
          transform: (val, canonical) => {
            // Em casamento com dois noivos, exibe inicial do noivo
            if (canonical.inicialNoivo && canonical.inicialNoiva) return canonical.inicialNoivo;
            return "";
          },
        },
        {
          id: "capa-inicial-noiva",
          fieldKey: "inicialNoiva",
          type: "text",
          x: 306.4,
          y: 393.6,
          width: 70,
          height: 100,
          style: {
            font: "Helvetica-Bold",
            fontSize: 93,
            lineHeight: 95,
            color: "#FFFFFF",
            align: "center",
          },
          transform: (val, canonical) => {
            // Em casamento com dois noivos, exibe inicial da noiva
            if (canonical.inicialNoivo && canonical.inicialNoiva) return canonical.inicialNoiva;
            return "";
          },
        },
        {
          id: "capa-inicial-solitaria",
          fieldKey: "nomeCliente",
          type: "text",
          x: 235.0,
          y: 393.6,
          width: 110,
          height: 100,
          style: {
            font: "Helvetica-Bold",
            fontSize: 93,
            lineHeight: 95,
            color: "#FFFFFF",
            align: "center",
          },
          transform: (val, canonical) => {
            // Em eventos de aniversariante único (ex: 15 anos), exibe 1 inicial centralizada grande
            if (!canonical.inicialNoivo || !canonical.inicialNoiva) {
              const name = canonical.nomeCliente || canonical.nomeEvento || "";
              const first = name.trim()[0];
              return first ? first.toUpperCase() : "";
            }
            return "";
          },
        },
        {
          id: "capa-nome-evento-topo",
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
          transform: (val, canonical) => {
            // Se for casamento com nomes separados, exibe "Noivo & Noiva"
            if (canonical.inicialNoivo && canonical.inicialNoiva) {
              const groom = canonical.inicialNoivo;
              const bride = canonical.inicialNoiva;
              return `${groom} & ${bride}`;
            }
            // Em 15 anos / outros eventos, exibe o nome do evento limpo
            return String(val || canonical.nomeCliente || "");
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

    // --- PÁGINAS 2 A 5: ESTÁTICAS ---
    { pageNumber: 2, title: "Sobre a Goat Bar", slots: [] },
    { pageNumber: 3, title: "Nosso propósito", slots: [] },
    { pageNumber: 4, title: "O Bar dos Sonhos de Vocês", slots: [] },
    { pageNumber: 5, title: "Por que escolher a Goat Bar?", slots: [] },

    // --- PÁGINA 6: DRINKS & EXPERIÊNCIAS ---
    {
      pageNumber: 6,
      title: "Drinks & Experiências",
      isMenuPage: true,
      menuSafeArea: {
        drinksStartY: 301.3,
        drinksMaxHeight: 280,
        bebidasStartY: 591.7,
        bebidasMaxHeight: 180,
      },
      slots: [
        {
          id: "drinks-list",
          fieldKey: "drinks",
          type: "bullet_list",
          x: 124.1,
          y: 316.0,
          width: 600,
          height: 280,
          style: {
            font: "Helvetica",
            fontSize: 25.4,
            lineHeight: 35.2,
            color: "#7D1018",
            align: "left",
          },
        },
        {
          id: "bebidas-list",
          fieldKey: "bebidas",
          type: "bullet_list",
          x: 81.0,
          y: 591.7,
          width: 600,
          height: 180,
          style: {
            font: "Helvetica",
            fontSize: 20,
            lineHeight: 27.7,
            color: "#7D1018",
            align: "left",
          },
        },
      ],
    },

    // --- PÁGINA 7: VALORES E CONDIÇÕES ---
    {
      pageNumber: 7,
      title: "Valores e condições",
      slots: [
        {
          id: "resumo-convidados",
          fieldKey: "quantidadePessoasFormatted",
          type: "text",
          x: 308.7,
          y: 145.9,
          width: 40,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-duracao-horas",
          fieldKey: "quantidadeHorasEventoFormatted",
          type: "text",
          x: 443.3,
          y: 216.0,
          width: 30,
          height: 35,
          style: {
            font: "Helvetica",
            fontSize: 29,
            lineHeight: 30,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-equipe-bartenders",
          fieldKey: "qtdBartendersFormatted",
          type: "text",
          x: 901.2,
          y: 284.2,
          width: 300,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-equipe-keepers",
          fieldKey: "qtdBarKeepersFormatted",
          type: "text",
          x: 901.2,
          y: 316.9,
          width: 300,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-equipe-copeiras",
          fieldKey: "qtdCopeirasFormatted",
          type: "text",
          x: 901.2,
          y: 349.5,
          width: 300,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-variedades-drinks",
          fieldKey: "quantidadeVariedadesDrinksFormatted",
          type: "text",
          x: 381.7,
          y: 459.6,
          width: 30,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 22,
            lineHeight: 24,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-investimento-total",
          fieldKey: "valorInvestimentoFormatted",
          type: "currency",
          x: 130.8,
          y: 648.0,
          width: 400,
          height: 40,
          style: {
            font: "Helvetica-Bold",
            fontSize: 30,
            lineHeight: 34,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-data-pagamento",
          fieldKey: "dataFinalPagamento",
          type: "date",
          x: 928.1,
          y: 657.7,
          width: 200,
          height: 30,
          style: {
            font: "Helvetica",
            fontSize: 25,
            lineHeight: 28,
            color: "#FFFFFF",
            align: "left",
          },
        },
      ],
    },

    // --- PÁGINA 8: ESTÁTICA ---
    { pageNumber: 8, title: "Vamos brindar juntos?", slots: [] },
  ],
};
