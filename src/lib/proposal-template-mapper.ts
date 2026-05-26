export type TemplateFieldType =
  | "texto_simples"
  | "texto_multiline"
  | "lista_dinamica"
  | "moeda"
  | "data"
  | "numero"
  | "texto_arco"
  | "imagem_dinamica";

export type FieldAlign = "left" | "center" | "right";
export type FieldWeight = "normal" | "bold";

export interface CircularFieldConfig {
  radius?: number;
  centerX?: number;
  centerY?: number;
  startAngle?: number;
  endAngle?: number;
  direction?: "clockwise" | "counterclockwise";
  uppercase?: boolean;
}

export interface ProposalTemplateField {
  id?: string;
  template_id: string;
  page_number: number;
  field_key: string;
  field_label: string;
  field_type: TemplateFieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  font_family: string;
  font_size: number;
  font_color: string;
  font_weight: FieldWeight;
  text_align: FieldAlign;
  line_height: number;
  letter_spacing: number;
  z_index: number;
  config: Record<string, unknown> & CircularFieldConfig;
  created_at?: string;
  updated_at?: string;
}

export const TEMPLATE_FIELD_KEYS = [
  "data_orcamento",
  "tipo_evento",
  "nome_evento",
  "nome_cliente",
  "nome_casal",
  "data_evento",
  "lista_drinks",
  "lista_bebidas",
  "numero_convidados",
  "quantidade_bartenders",
  "quantidade_bar_keeper",
  "quantidade_copeira",
  "quantidade_drinks",
  "investimento_total",
  "forma_pagamento",
  "inicial_1",
  "inicial_2",
] as const;

export const DEFAULT_TEMPLATE_FIELDS: Array<Pick<ProposalTemplateField, "field_key" | "field_label" | "field_type">> = TEMPLATE_FIELD_KEYS.map((key) => ({
  field_key: key,
  field_label: key.replaceAll("_", " "),
  field_type: key.includes("data") ? "data" : key.includes("lista") ? "lista_dinamica" : key.includes("investimento") ? "moeda" : "texto_simples",
}));
