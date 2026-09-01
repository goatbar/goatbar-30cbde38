import { describe, expect, it, vi } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import { contractAddendumService } from "./contract-addendum-service";

describe("contractAddendumService", () => {
  it("1. getEffectiveBudgetVersion usa budget_version_id do contrato quando não há aditivo assinado", async () => {
    const mockSelect = vi.fn().mockImplementation((table: string) => {
      if (table === "contract_addendums") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { budget_version_id: "budget-v1" } }),
        };
      }
      if (table === "event_budget_versions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "budget-v1", version_number: 1 } }),
        };
      }
      return {};
    });

    (supabase.from as any) = mockSelect;

    const res = await contractAddendumService.getEffectiveBudgetVersion("contract-1", "event-1");
    expect(res.budgetVersionId).toBe("budget-v1");
    expect(res.source).toBe("original_contract");
  });

  it("2. getEffectiveBudgetVersion usa updated_budget_version_id do último aditivo ASSINADO", async () => {
    const mockSelect = vi.fn().mockImplementation((table: string) => {
      if (table === "contract_addendums") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: "addendum-1",
                addendum_number: 1,
                status: "signed",
                updated_budget_version_id: "budget-v2",
              },
            ],
          }),
        };
      }
      if (table === "event_budget_versions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: "budget-v2", version_number: 2 } }),
        };
      }
      return {};
    });

    (supabase.from as any) = mockSelect;

    const res = await contractAddendumService.getEffectiveBudgetVersion("contract-1", "event-1");
    expect(res.budgetVersionId).toBe("budget-v2");
    expect(res.source).toBe("signed_addendum");
    expect(res.addendumNumber).toBe(1);
  });

  it("3. resolveLegacyContractBudgetVersion realiza backfill automático quando existe exatamente 1 proposta", async () => {
    const updateFn = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "contract-legacy", event_id: "event-legacy", budget_version_id: null },
          }),
          update: updateFn,
        };
      }
      if (table === "event_budget_versions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: "b-single", version_number: 1 }],
          }),
        };
      }
      return {};
    });

    (supabase.from as any) = mockSelect;

    const res =
      await contractAddendumService.resolveLegacyContractBudgetVersion("contract-legacy");
    expect(res.budgetVersionId).toBe("b-single");
    expect(res.autoResolved).toBe(true);
    expect(updateFn).toHaveBeenCalledWith({ budget_version_id: "b-single" });
  });

  it("4. resolveLegacyContractBudgetVersion exige seleção manual quando existem múltiplas propostas", async () => {
    const mockSelect = vi.fn().mockImplementation((table: string) => {
      if (table === "event_contracts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "contract-legacy", event_id: "event-legacy", budget_version_id: null },
          }),
        };
      }
      if (table === "event_budget_versions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: "b1", version_number: 1 },
              { id: "b2", version_number: 2 },
            ],
          }),
        };
      }
      return {};
    });

    (supabase.from as any) = mockSelect;

    await expect(
      contractAddendumService.resolveLegacyContractBudgetVersion("contract-legacy"),
    ).rejects.toThrow("LEGACY_CONTRACT_REQUIRES_MANUAL_SELECTION");
  });
});
