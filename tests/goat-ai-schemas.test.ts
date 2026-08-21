import { describe, it, expect } from "vitest";
import {
  AIClassificationSchema,
  EventPurchaseSchema,
  SalesSessionSchema,
  OperationReportSchema,
  InvoiceReceiptSchema,
  ExpenseSchema,
  StockMovementSchema,
  GeneralNoteSchema,
  AIStructuredResponseSchema,
  validateStructuredData,
} from "../supabase/functions/_shared/goat-ai/schemas";

describe("Goat AI Structured Schemas & Validation", () => {
  it("validates AIClassificationSchema", () => {
    const classification = AIClassificationSchema.parse({
      classification: "event_purchase",
      confidence: 0.98,
    });
    expect(classification.classification).toBe("event_purchase");
    expect(classification.confidence).toBe(0.98);
  });

  it("validates event purchase schema with default values", () => {
    const raw = {
      supplier: "Assaí Atacadista",
      total: 780.5,
      items: [
        { name: "Gin Tanqueray", quantity: 4, unit_price: 120, total_price: 480 },
        { name: "Vodka Absolut", quantity: 3, unit_price: 100, total_price: 300 },
      ],
    };

    const parsed = EventPurchaseSchema.parse(raw);
    expect(parsed.supplier).toBe("Assaí Atacadista");
    expect(parsed.total).toBe(780.5);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.payment_method).toBe("PIX");
    expect(parsed.category).toBe("Insumos");
  });

  it("validates sales session schema", () => {
    const raw = {
      location: "7Steakhouse",
      revenue: 4850,
      sales: [
        { product: "Old Fashioned", quantity: 18, unit_price: 35, unit_cost: 12 },
        { product: "Negroni", quantity: 12, unit_price: 32, unit_cost: 10 },
      ],
      issues: ["Demora no primeiro atendimento"],
    };

    const parsed = SalesSessionSchema.parse(raw);
    expect(parsed.location).toBe("7Steakhouse");
    expect(parsed.revenue).toBe(4850);
    expect(parsed.sales).toHaveLength(2);
    expect(parsed.issues).toContain("Demora no primeiro atendimento");
  });

  it("validates invoice and receipt schema", () => {
    const raw = {
      supplier_name: "Atacadão",
      invoice_number: "NF-00912",
      total_value: 1827.43,
      items: [{ name: "Caixa de Tônica", quantity: 10, unit_price: 35, total_price: 350 }],
    };

    const parsed = InvoiceReceiptSchema.parse(raw);
    expect(parsed.supplier_name).toBe("Atacadão");
    expect(parsed.invoice_number).toBe("NF-00912");
    expect(parsed.total_value).toBe(1827.43);
  });

  it("validates general note schema", () => {
    const raw = {
      title: "Recado Operacional",
      content: "Lembrar de comprar gelo para o bar 2",
      tags: ["urgente", "bar2"],
    };

    const parsed = GeneralNoteSchema.parse(raw);
    expect(parsed.title).toBe("Recado Operacional");
    expect(parsed.tags).toHaveLength(2);
  });

  it("validates full AIStructuredResponseSchema", () => {
    const full = AIStructuredResponseSchema.parse({
      classification: "event_purchase",
      classification_confidence: 0.99,
      extraction_confidence: 0.95,
      event_reference: {
        name: "Casamento Fernanda e Lucas",
        bride_name: "Fernanda",
      },
      data: {
        supplier: "Assaí",
        total: 780,
      },
    });

    expect(full.classification).toBe("event_purchase");
    expect(full.event_reference.bride_name).toBe("Fernanda");
  });

  it("handles invalid schema safely via validateStructuredData helper", () => {
    const result = validateStructuredData("event_purchase", {
      supplier: "Fornecedor",
      total: 100,
    });
    expect(result.isValid).toBe(true);
    expect(result.data.supplier).toBe("Fornecedor");

    const genericResult = validateStructuredData("unknown", { custom: 123 });
    expect(genericResult.isValid).toBe(true);
  });
});
