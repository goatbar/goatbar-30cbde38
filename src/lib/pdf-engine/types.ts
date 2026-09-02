import type { CanonicalProposalData } from "@/lib/proposal-field-resolver";

export type ProposalFieldAlign = "left" | "center" | "right";
export type ProposalFieldType =
  | "text"
  | "bullet_list"
  | "date"
  | "currency"
  | "number"
  | "image"
  | "arc";

export interface ProposalArcConfig {
  radius: number;
  startDeg: number;
  endDeg: number;
  position: "top" | "bottom";
  minFontSize?: number;
}

export interface ProposalSlotStyle {
  font?: "Helvetica" | "Helvetica-Bold" | "Times-Roman" | "Times-Bold" | string;
  fontSize: number;
  lineHeight: number;
  color: string; // Hex (#FFFFFF) ou rgb
  align?: ProposalFieldAlign;
  letterSpacing?: number;
}

export interface ProposalFieldSlot {
  id: string;
  fieldKey: keyof CanonicalProposalData | string;
  type: ProposalFieldType;
  x: number;
  y: number; // Coordenada Y (topo da página como 0 no sistema de template)
  width: number;
  height: number;
  style: ProposalSlotStyle;
  arcConfig?: ProposalArcConfig;
  prefix?: string;
  suffix?: string;
  transform?: (value: any, canonical: CanonicalProposalData) => string;
}

export interface ProposalBackgroundConfig {
  type: "blank" | "color" | "pdf_page" | "image";
  colorHex?: string;
  assetPath?: string;
  assetBytes?: Uint8Array;
}

export interface ProposalPageDefinition {
  pageNumber: number; // 1-indexed
  title?: string;
  background?: ProposalBackgroundConfig;
  slots: ProposalFieldSlot[];
  isMenuPage?: boolean;
  menuSafeArea?: {
    drinksStartY: number;
    drinksMaxHeight: number;
    bebidasStartY: number;
    bebidasMaxHeight: number;
  };
  /**
   * Identifica uma composição reutilizável do renderer.  A composição é
   * intencionalmente uma propriedade da página, e não do template: modelos
   * diferentes podem compartilhar a mesma grade sem duplicar a lógica de
   * desenho.
   */
  composition?: "commercial-values";
}

export interface ProposalOverflowConfig {
  enabled: boolean;
  maxMenuHeight: number;
  continuationPageTitle: string;
}

export interface ProposalTemplateDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
  isDevelopment?: boolean; // Flag explícita para templates não-produtivos de debug/teste
  basePdfBytes?: Uint8Array;
  basePdfPath?: string;
  pageSize: {
    width: number;
    height: number;
  };
  pages: ProposalPageDefinition[];
  overflow?: ProposalOverflowConfig;
}

export interface ProposalRenderOptions {
  watermarkDev?: boolean;
}

export interface ProposalRenderResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  templateId: string;
  templateVersion: string;
  generatedAt: string;
  canonicalSnapshot: CanonicalProposalData;
}
