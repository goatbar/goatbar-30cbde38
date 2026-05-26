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
export type OverflowControl = "clip" | "ellipsis" | "wrap";

export interface ProposalTemplateField {
  id?: string;
  template_id: string;
  technical_name: string;
  label: string;
  field_type: TemplateFieldType;
  page: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  font_family: string;
  font_size: number;
  color_hex: string;
  alignment: FieldAlign;
  font_weight: FieldWeight;
  line_height: number;
  auto_resize: boolean;
  overflow_control: OverflowControl;
  arc_angle?: number | null;
  arc_radius?: number | null;
  image_fit?: "contain" | "cover" | "stretch" | null;
}

export const DEFAULT_TEMPLATE_FIELDS: Array<Pick<ProposalTemplateField, "technical_name" | "label" | "field_type">> = [
  { technical_name: "data_orcamento", label: "Data Orçamento", field_type: "data" },
  { technical_name: "nome_evento", label: "Nome Evento", field_type: "texto_simples" },
  { technical_name: "data_evento", label: "Data Evento", field_type: "data" },
  { technical_name: "lista_drinks", label: "Lista Drinks", field_type: "lista_dinamica" },
  { technical_name: "lista_bebidas", label: "Lista Bebidas", field_type: "lista_dinamica" },
  { technical_name: "numero_convidados", label: "Nº Convidados", field_type: "numero" },
  { technical_name: "qtde_bartenders", label: "Qtd Bartenders", field_type: "numero" },
  { technical_name: "qtde_bar_keeper", label: "Qtd Bar Keeper", field_type: "numero" },
  { technical_name: "qtde_copeira", label: "Qtd Copeira", field_type: "numero" },
  { technical_name: "valor_total", label: "Valor Total", field_type: "moeda" },
  { technical_name: "qtde_variedades", label: "Qtd Variedades", field_type: "numero" },
  { technical_name: "forma_pagamento", label: "Forma Pagamento", field_type: "texto_multiline" },
];
