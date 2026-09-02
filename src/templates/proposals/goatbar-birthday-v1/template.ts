import type { ProposalTemplateDefinition } from "@/lib/pdf-engine/types";
import { birthdayCoverConfig } from "../cover-configs";
import { GOATBAR_COMMERCIAL_V1_TEMPLATE } from "../goatbar-commercial-v1/template";
import birthdayTemplateUrl from "../../../../Proposta limpa/Cópia de Proposta Comercial - Juliana.pdf?url";

export const GOATBAR_BIRTHDAY_V1_TEMPLATE: ProposalTemplateDefinition = {
  ...GOATBAR_COMMERCIAL_V1_TEMPLATE,
  id: "goatbar-birthday",
  name: "Proposta Comercial Goat Bar — Aniversário",
  description: "Modelo oficial de aniversário com a arte original da capa preservada",
  basePdfPath: birthdayTemplateUrl,
  pages: [birthdayCoverConfig, ...GOATBAR_COMMERCIAL_V1_TEMPLATE.pages.slice(1)],
};
