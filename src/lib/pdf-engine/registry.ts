import type { ProposalTemplateDefinition } from "./types";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "@/templates/proposals/goatbar-commercial-v1/template";
import { GOATBAR_DESPEDIDA_V1_TEMPLATE } from "@/templates/proposals/goatbar-despedida-v1/template";
import { GOATBAR_BIRTHDAY_V1_TEMPLATE } from "@/templates/proposals/goatbar-birthday-v1/template";

/**
 * Template de desenvolvimento/teste estritamente NÃO-PRODUTIVO.
 * Usado exclusivamente para validação técnica da engine, cálculo de layout,
 * quebra de linha, paginação de overflow e testes automatizados.
 */
export const DEV_DEBUG_TEMPLATE: ProposalTemplateDefinition = {
  id: "dev-debug-pilot",
  version: "1.0.0-dev",
  name: "[DEV ONLY] Validação Técnica da Engine",
  description: "Template técnico não-produtivo para testes de renderização",
  isDevelopment: true,
  pageSize: {
    width: 595.28, // A4 Retrato
    height: 841.89,
  },
  overflow: {
    enabled: true,
    maxMenuHeight: 280,
    continuationPageTitle: "CARDÁPIO DE DRINKS (CONTINUAÇÃO)",
  },
  pages: [
    {
      pageNumber: 1,
      title: "Capa",
      background: {
        type: "color",
        colorHex: "#111115",
      },
      slots: [
        {
          id: "capa-brand",
          fieldKey: "nomeEvento",
          type: "text",
          x: 40,
          y: 60,
          width: 515,
          height: 30,
          style: {
            font: "Helvetica-Bold",
            fontSize: 20,
            lineHeight: 24,
            color: "#D4AF37",
            align: "center",
          },
          transform: () => "GOAT BAR • EXPERIÊNCIAS PREMIUM",
        },
        {
          id: "capa-titulo",
          fieldKey: "nomeEvento",
          type: "text",
          x: 50,
          y: 280,
          width: 495,
          height: 80,
          style: {
            font: "Helvetica-Bold",
            fontSize: 28,
            lineHeight: 34,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "capa-data-evento",
          fieldKey: "dataEvento",
          type: "date",
          x: 50,
          y: 380,
          width: 300,
          height: 25,
          prefix: "Data do Evento: ",
          style: {
            font: "Helvetica",
            fontSize: 14,
            lineHeight: 18,
            color: "#D4AF37",
            align: "left",
          },
        },
        {
          id: "capa-data-orcamento",
          fieldKey: "dataOrcamento",
          type: "date",
          x: 50,
          y: 760,
          width: 300,
          height: 20,
          prefix: "Proposta emitida em: ",
          style: {
            font: "Helvetica",
            fontSize: 10,
            lineHeight: 14,
            color: "#888890",
            align: "left",
          },
        },
      ],
    },
    {
      pageNumber: 2,
      title: "Cardápio & Experiências",
      isMenuPage: true,
      background: {
        type: "color",
        colorHex: "#16161B",
      },
      menuSafeArea: {
        drinksStartY: 120,
        drinksMaxHeight: 320,
        bebidasStartY: 480,
        bebidasMaxHeight: 200,
      },
      slots: [
        {
          id: "menu-titulo",
          fieldKey: "quantidadeVariedadesDrinksFormatted",
          type: "text",
          x: 40,
          y: 50,
          width: 515,
          height: 30,
          style: {
            font: "Helvetica-Bold",
            fontSize: 18,
            lineHeight: 22,
            color: "#D4AF37",
            align: "left",
          },
          transform: (val) => `CARDÁPIO DE DRINKS (${val || 0} VARIEDADES)`,
        },
        {
          id: "menu-drinks-list",
          fieldKey: "drinks",
          type: "bullet_list",
          x: 40,
          y: 100,
          width: 515,
          height: 320,
          style: {
            font: "Helvetica",
            fontSize: 12,
            lineHeight: 20,
            color: "#F0F0F5",
            align: "left",
          },
        },
        {
          id: "menu-bebidas-titulo",
          fieldKey: "bebidas",
          type: "text",
          x: 40,
          y: 450,
          width: 515,
          height: 25,
          style: {
            font: "Helvetica-Bold",
            fontSize: 14,
            lineHeight: 18,
            color: "#D4AF37",
            align: "left",
          },
          transform: () => "BEBIDAS & INSUMOS INCLUSOS",
        },
        {
          id: "menu-bebidas-list",
          fieldKey: "bebidas",
          type: "bullet_list",
          x: 40,
          y: 480,
          width: 515,
          height: 200,
          style: {
            font: "Helvetica",
            fontSize: 11,
            lineHeight: 18,
            color: "#CCCCCC",
            align: "left",
          },
        },
      ],
    },
    {
      pageNumber: 3,
      title: "Investimento e Condições",
      background: {
        type: "color",
        colorHex: "#111115",
      },
      slots: [
        {
          id: "resumo-convidados",
          fieldKey: "quantidadePessoasFormatted",
          type: "text",
          x: 50,
          y: 80,
          width: 240,
          height: 40,
          prefix: "Convidados: ",
          style: {
            font: "Helvetica",
            fontSize: 14,
            lineHeight: 18,
            color: "#FFFFFF",
            align: "left",
          },
        },
        {
          id: "resumo-equipe-bartenders",
          fieldKey: "qtdBartendersFormatted",
          type: "text",
          x: 50,
          y: 120,
          width: 240,
          height: 25,
          style: {
            font: "Helvetica",
            fontSize: 12,
            lineHeight: 16,
            color: "#D0D0D5",
            align: "left",
          },
        },
        {
          id: "resumo-equipe-keepers",
          fieldKey: "qtdBarKeepersFormatted",
          type: "text",
          x: 50,
          y: 150,
          width: 240,
          height: 25,
          style: {
            font: "Helvetica",
            fontSize: 12,
            lineHeight: 16,
            color: "#D0D0D5",
            align: "left",
          },
        },
        {
          id: "resumo-equipe-copeiras",
          fieldKey: "qtdCopeirasFormatted",
          type: "text",
          x: 50,
          y: 180,
          width: 240,
          height: 25,
          style: {
            font: "Helvetica",
            fontSize: 12,
            lineHeight: 16,
            color: "#D0D0D5",
            align: "left",
          },
        },
        {
          id: "resumo-investimento",
          fieldKey: "valorInvestimentoFormatted",
          type: "currency",
          x: 50,
          y: 280,
          width: 495,
          height: 50,
          prefix: "Investimento Total: ",
          style: {
            font: "Helvetica-Bold",
            fontSize: 22,
            lineHeight: 28,
            color: "#D4AF37",
            align: "left",
          },
        },
        {
          id: "resumo-pagamento",
          fieldKey: "dataFinalPagamento",
          type: "date",
          x: 50,
          y: 350,
          width: 495,
          height: 30,
          prefix: "Data limite para quitação: ",
          style: {
            font: "Helvetica",
            fontSize: 12,
            lineHeight: 16,
            color: "#A0A0A5",
            align: "left",
          },
        },
      ],
    },
  ],
};

class ProposalTemplateRegistryClass {
  private templates: Map<string, ProposalTemplateDefinition> = new Map();

  constructor() {
    // Registra os templates oficiais e o de desenvolvimento
    this.registerTemplate(GOATBAR_COMMERCIAL_V1_TEMPLATE);
    this.registerTemplate(GOATBAR_BIRTHDAY_V1_TEMPLATE);
    this.registerTemplate(GOATBAR_DESPEDIDA_V1_TEMPLATE);
    this.registerTemplate(DEV_DEBUG_TEMPLATE);
  }

  registerTemplate(template: ProposalTemplateDefinition) {
    const key = this.getKey(template.id, template.version);
    this.templates.set(key, template);
  }

  getTemplate(id: string, version?: string): ProposalTemplateDefinition | undefined {
    if (version) {
      return this.templates.get(this.getKey(id, version));
    }
    // Retorna a versão mais recente registrada para o ID
    const matching = Array.from(this.templates.values()).filter((t) => t.id === id);
    if (!matching.length) return undefined;
    return matching[matching.length - 1];
  }

  listTemplates(includeDev = false): ProposalTemplateDefinition[] {
    return Array.from(this.templates.values()).filter((t) => includeDev || !t.isDevelopment);
  }

  private getKey(id: string, version: string) {
    return `${id}@${version}`;
  }
}

export const ProposalTemplateRegistry = new ProposalTemplateRegistryClass();
