import { z } from "zod";

export const AIClassificationEnum = z.enum([
  "sales_session",
  "operation_report",
  "event_purchase",
  "invoice",
  "receipt",
  "stock_movement",
  "expense",
  "event_note",
  "general_note",
  "unknown",
]);

export const AIClassificationSchema = z.object({
  classification: AIClassificationEnum,
  confidence: z.number().min(0).max(1).default(0.9),
  reason: z.string().optional(),
});

export const PurchaseItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().nonnegative().default(1),
  unit: z.string().nullable().optional(),
  unit_price: z.number().nullable().optional(),
  total_price: z.number().nullable().optional(),
  suggested_category: z.string().nullable().optional(),
});

export const EventPurchaseSchema = z.object({
  supplier: z.string().nullable().optional().default("Fornecedor"),
  supplier_cnpj: z.string().nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  total: z.number().nullable().optional().default(0),
  payment_method: z.string().nullable().optional().default("PIX"),
  category: z.string().nullable().optional().default("Insumos"),
  items: z.array(PurchaseItemSchema).default([]),
  notes: z.string().nullable().optional().default(""),
});

export const SalesSessionItemSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().int().nonnegative().default(1),
  unit_price: z.number().nullable().optional(),
  unit_cost: z.number().nullable().optional(),
});

export const SalesSessionSchema = z.object({
  location: z.string().default("Goat Botequim"),
  date: z.string().nullable().optional(),
  revenue: z.number().nullable().optional().default(0),
  sales: z.array(SalesSessionItemSchema).default([]),
  peak_period: z
    .object({
      start: z.string().nullable().optional(),
      end: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  issues: z.array(z.string()).default([]),
  labor_value: z.number().nullable().optional().default(0),
  labor_quantity: z.number().nullable().optional().default(0),
  labor_names: z.string().nullable().optional().default(""),
  notes: z.string().nullable().optional().default(""),
});

export const OperationReportSchema = z.object({
  location: z.string().default("Geral"),
  date: z.string().nullable().optional(),
  revenue: z.number().nullable().optional(),
  summary: z.string().default(""),
  highlights: z.array(z.string()).default([]),
  issues: z.array(z.string()).default([]),
  notes: z.string().nullable().optional().default(""),
});

export const InvoiceReceiptSchema = z.object({
  supplier_name: z.string().default("Fornecedor"),
  supplier_cnpj: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  issue_date: z.string().nullable().optional(),
  total_value: z.number().nullable().optional().default(0),
  payment_method: z.string().nullable().optional().default("PIX"),
  category: z.string().nullable().optional().default("Insumos"),
  items: z.array(PurchaseItemSchema).default([]),
  taxes: z.number().nullable().optional(),
  notes: z.string().nullable().optional().default(""),
});

export const ExpenseSchema = z.object({
  supplier_name: z.string().default("Diversos"),
  date: z.string().nullable().optional(),
  amount: z.number().nullable().optional().default(0),
  category: z.string().default("Operacional"),
  description: z.string().default("Despesa"),
  payment_method: z.string().default("PIX"),
  notes: z.string().nullable().optional().default(""),
});

export const StockMovementSchema = z.object({
  movement_type: z.enum(["in", "out", "loss"]).default("in"),
  reason: z.string().default("Ajuste de estoque"),
  items: z
    .array(
      z.object({
        product_name: z.string(),
        quantity: z.number(),
        unit: z.string().nullable().optional().default("un"),
      })
    )
    .default([]),
  notes: z.string().nullable().optional().default(""),
});

export const GeneralNoteSchema = z.object({
  title: z.string().default("Anotação"),
  content: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export const EventReferenceSchema = z.object({
  name: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  groom_name: z.string().nullable().optional(),
  bride_name: z.string().nullable().optional(),
  event_name: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  event_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

export const AIStructuredResponseSchema = z.object({
  classification: AIClassificationEnum.default("unknown"),
  classification_confidence: z.number().min(0).max(1).default(0.9),
  extraction_confidence: z.number().min(0).max(1).default(0.85),
  event_reference: EventReferenceSchema.default({}),
  data: z.record(z.unknown()).default({}),
  warnings: z.array(z.string()).default([]),
  missing_fields: z.array(z.string()).default([]),
});

// Gemini Native OpenAPI Schema definition for generationConfig.responseSchema
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    classification: {
      type: "STRING",
      enum: [
        "sales_session",
        "operation_report",
        "event_purchase",
        "invoice",
        "receipt",
        "stock_movement",
        "expense",
        "event_note",
        "general_note",
        "unknown",
      ],
      description: "Classificação primária da mensagem operacional.",
    },
    classification_confidence: {
      type: "NUMBER",
      description: "Confiança na classificação (0.0 a 1.0).",
    },
    extraction_confidence: {
      type: "NUMBER",
      description: "Confiança na extração dos dados (0.0 a 1.0).",
    },
    event_reference: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", nullable: true, description: "Nome do evento ou celebração." },
        client_name: { type: "STRING", nullable: true, description: "Nome do cliente/contratante." },
        bride_name: { type: "STRING", nullable: true, description: "Nome da noiva se mencionado." },
        groom_name: { type: "STRING", nullable: true, description: "Nome do noivo se mencionado." },
        date: { type: "STRING", nullable: true, description: "Data do evento no formato YYYY-MM-DD se informada." },
        location: { type: "STRING", nullable: true, description: "Local do evento." },
      },
      description: "Referências semânticas a um evento.",
    },
    data: {
      type: "OBJECT",
      properties: {
        supplier: { type: "STRING", nullable: true, description: "Nome do fornecedor ou estabelecimento." },
        supplier_name: { type: "STRING", nullable: true, description: "Nome do fornecedor." },
        total: { type: "NUMBER", nullable: true, description: "Valor total em reais." },
        revenue: { type: "NUMBER", nullable: true, description: "Faturamento informado em reais." },
        amount: { type: "NUMBER", nullable: true, description: "Valor de despesa em reais." },
        purchase_date: { type: "STRING", nullable: true, description: "Data da compra (YYYY-MM-DD)." },
        location: { type: "STRING", nullable: true, description: "Unidade física de venda (7Steakhouse, Goat Botequim)." },
        payment_method: { type: "STRING", nullable: true, description: "Forma de pagamento (PIX, Dinheiro, Cartao, Transferencia)." },
        category: { type: "STRING", nullable: true, description: "Categoria (Insumos, Operacional, Fornecedor, Equipe, Outros)." },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "Nome ou descrição do produto." },
              description: { type: "STRING", nullable: true, description: "Descrição adicional do item." },
              quantity: { type: "NUMBER", description: "Quantidade informada." },
              unit: { type: "STRING", nullable: true, description: "Unidade (un, garrafa, caixa, kg, fardo)." },
              unit_price: { type: "NUMBER", nullable: true, description: "Preço unitário se informado." },
              total_price: { type: "NUMBER", nullable: true, description: "Preço total do item se informado." },
            },
            required: ["name", "quantity"],
          },
          description: "Lista de itens ou produtos da compra/nota.",
        },
        sales: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              product: { type: "STRING", description: "Nome do drink vendido." },
              quantity: { type: "NUMBER", description: "Quantidade vendida." },
            },
            required: ["product", "quantity"],
          },
          description: "Drinks vendidos em sessão de ponto fixo.",
        },
        peak_period: {
          type: "OBJECT",
          nullable: true,
          properties: {
            start: { type: "STRING", nullable: true, description: "Horário inicial do pico (HH:MM)." },
            end: { type: "STRING", nullable: true, description: "Horário final do pico (HH:MM)." },
          },
        },
        issues: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Problemas, atrasos ou ocorrências relatadas.",
        },
        notes: { type: "STRING", nullable: true, description: "Observações contextuais adicionais." },
      },
      description: "Dados estruturados de acordo com o tipo de operação.",
    },
    warnings: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Avisos de dados ausentes, estimados ou ambíguos.",
    },
    missing_fields: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Campos esperados que não constavam na mensagem.",
    },
  },
  required: [
    "classification",
    "classification_confidence",
    "extraction_confidence",
    "event_reference",
    "data",
    "warnings",
  ],
};

export function validateStructuredData(
  classification: string,
  rawData: unknown
): { isValid: boolean; data: Record<string, unknown>; error?: string } {
  try {
    const dataObj = typeof rawData === "object" && rawData !== null ? rawData : {};
    switch (classification) {
      case "event_purchase": {
        const parsed = EventPurchaseSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      case "sales_session": {
        const parsed = SalesSessionSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      case "operation_report": {
        const parsed = OperationReportSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      case "invoice":
      case "receipt": {
        const parsed = InvoiceReceiptSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      case "expense": {
        const parsed = ExpenseSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      case "stock_movement": {
        const parsed = StockMovementSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      case "event_note":
      case "general_note": {
        const parsed = GeneralNoteSchema.parse(dataObj);
        return { isValid: true, data: parsed as unknown as Record<string, unknown> };
      }
      default:
        return { isValid: true, data: (dataObj as Record<string, unknown>) || {} };
    }
  } catch (err: any) {
    return {
      isValid: false,
      data: (rawData as Record<string, unknown>) || {},
      error: err?.message || "Falha na validação do schema Zod",
    };
  }
}
