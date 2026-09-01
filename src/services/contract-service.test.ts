import { describe, expect, it } from "vitest";

import { extractClientEventTime } from "./contract-service";

describe("extractClientEventTime", () => {
  it("extrai o horário do resumo enviado pelo cliente", () => {
    const notes = [
      "Data do Evento: 23/01/2027",
      "Horário: 16:00",
      "Convidados: 200",
      "Forma de Pagamento: 30% na assinatura",
    ].join("\n");

    expect(extractClientEventTime(notes)).toBe("16:00");
  });

  it("aceita o horário salvo em notas estruturadas", () => {
    expect(extractClientEventTime({ horario: " 18:30 " })).toBe("18:30");
  });

  it("retorna vazio quando o cliente não informou o horário", () => {
    expect(extractClientEventTime("Convidados: 200")).toBe("");
  });
});

import { vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { eventContractsService } from "./contract-service";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("eventContractsService.getOrCreateContractForEvent", () => {
  it("BUG A — cria novo contrato draft quando todos os contratos existentes estão cancelados (activeContracts = 0)", async () => {
    const mockSelectContracts = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: "old-cancelled-1", status: "cancelled", created_at: "2026-01-01T00:00:00Z" }],
          error: null,
        }),
      }),
    });

    const mockInsertContract = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "new-draft-contract-uuid", status: "draft", version: 1 },
          error: null,
        }),
      }),
    });

    (supabase.from as any) = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: mockSelectContracts,
          insert: mockInsertContract,
        };
      }
      return {};
    });

    const contract = await eventContractsService.getOrCreateContractForEvent("event-with-cancelled-contracts");
    expect(contract.id).toBe("new-draft-contract-uuid");
    expect(contract.status).toBe("draft");
    expect(mockInsertContract).toHaveBeenCalled();
  });

  it("BUG B — lança erro se o contractId fornecido não pertencer ao evento", async () => {
    (supabase.from as any) = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error("Row not found") }),
          }),
        }),
      }),
    });

    await expect(
      eventContractsService.getOrCreateContractForEvent("event-A", "contract-from-event-B"),
    ).rejects.toThrow('Contrato com id "contract-from-event-B" não pertence a este evento ou não foi encontrado.');
  });
});
