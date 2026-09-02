import type { ProposalTemplateDefinition } from "@/lib/pdf-engine/types";
import { celebrationCoverConfig } from "../cover-configs";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "../goatbar-commercial-v1/template";
import celebrationTemplateUrl from "../../../../Proposta limpa/Cópia de Proposta Comercial - Casamento Andreza.pdf?url";

/**
 * TEMPLATE OFICIAL: Proposta Comercial Goat Bar — Comemoração.
 * Despedidas e eventos corporativos pertencem a esta família e preservam sua capa original.
 */
export const GOATBAR_DESPEDIDA_V1_TEMPLATE: ProposalTemplateDefinition = {
  ...GOATBAR_COMMERCIAL_V1_TEMPLATE,
  id: "goatbar-celebration",
  version: "1.0.0",
  name: "Proposta Comercial Goat Bar — Comemoração",
  description: "Modelo oficial de comemoração com a arte original da capa preservada",
  isDevelopment: false,
  basePdfPath: celebrationTemplateUrl,
  pages: [celebrationCoverConfig, ...GOATBAR_COMMERCIAL_V1_TEMPLATE.pages.slice(1)],
};
