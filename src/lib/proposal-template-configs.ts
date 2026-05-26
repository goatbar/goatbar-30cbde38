import { rgb, type RGB } from "pdf-lib";

export type EventTemplateType = "casamento" | "aniversario" | "comemoracao";
export type FieldType = "text" | "list" | "currency" | "date" | "arc";
export type FieldAlign = "left" | "center" | "right";

export interface FieldConfig {
  page: number;
  field: string;
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  fontSize: number;
  color: RGB;
  align: FieldAlign;
  lineHeight: number;
  type: FieldType;
}

const white = rgb(1, 1, 1);
const gold = rgb(0.83, 0.68, 0.21);

export const proposalTemplateConfigs: Record<EventTemplateType, FieldConfig[]> = {
  aniversario: [
    { page: 0, field: "proposalDateTop", x: 1200, y: 640, maxWidth: 360, maxHeight: 50, fontSize: 28, color: white, align: "right", lineHeight: 34, type: "date" },
    { page: 0, field: "proposalDateBottom", x: 90, y: 56, maxWidth: 420, maxHeight: 50, fontSize: 24, color: white, align: "left", lineHeight: 30, type: "date" },
    { page: 0, field: "coverArcText", x: 820, y: 360, maxWidth: 360, maxHeight: 100, fontSize: 30, color: gold, align: "center", lineHeight: 32, type: "arc" },
    { page: 5, field: "selectedDrinks", x: 118, y: 410, maxWidth: 760, maxHeight: 280, fontSize: 28, color: white, align: "left", lineHeight: 36, type: "list" },
    { page: 5, field: "includedBeverages", x: 120, y: 118, maxWidth: 560, maxHeight: 160, fontSize: 24, color: white, align: "left", lineHeight: 30, type: "list" },
    { page: 6, field: "guests", x: 208, y: 492, maxWidth: 300, maxHeight: 48, fontSize: 28, color: white, align: "left", lineHeight: 34, type: "text" },
    { page: 6, field: "team", x: 208, y: 388, maxWidth: 500, maxHeight: 170, fontSize: 24, color: white, align: "left", lineHeight: 30, type: "list" },
    { page: 6, field: "investment", x: 870, y: 300, maxWidth: 420, maxHeight: 58, fontSize: 38, color: gold, align: "left", lineHeight: 42, type: "currency" },
    { page: 6, field: "totalDrinkVarieties", x: 208, y: 310, maxWidth: 460, maxHeight: 45, fontSize: 24, color: white, align: "left", lineHeight: 30, type: "text" },
    { page: 6, field: "paymentTerms", x: 208, y: 198, maxWidth: 1120, maxHeight: 180, fontSize: 22, color: white, align: "left", lineHeight: 28, type: "list" },
  ],
  casamento: [],
  comemoracao: [],
};
