// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useAppStore } from "@/lib/app-store";
import { getSignatureProvider } from "@/services/signature-provider";

import { renderHook, act } from "@testing-library/react";

describe("Frontend Runtime & Store Resilience (Prevenção de Stack Overflow)", () => {
  it("garante que atualizações no app-store não disparam recursão infinita", () => {
    const { result } = renderHook(() => useAppStore());
    expect(result.current.drinks).toBeDefined();

    act(() => {
      result.current.updateParametros([...result.current.parametros]);
      result.current.addEvento({
        nome: "Teste Stack Overflow",
        cliente: "Cliente Teste",
        telefone: "11999999999",
        data: "2026-10-10",
        local: "São Paulo",
        cidade: "SP",
        tipo: "Casamento",
        convidados: 100,
        drinks: [],
        observacoes: "",
        status: "prospeccao",
        drinksPorPessoa: 5,
        markupAdicionalDrinks: 10,
        equipe: {
          bartender: { qtd: 2, valorUnitario: 300 },
          keeper: { qtd: 1, valorUnitario: 250 },
          copeira: { qtd: 0, valorUnitario: 0 },
        },
        gelo: { pacotesOverride: 10, valorUnitario: 25 },
        viagem: { incluir: false, valor: 0 },
        gastosDiversos: [],
        lucroDesejado: 1000,
        pagamento: { formaPagamento: "Pix", percentualPago: 0 },
        coposVinculados: {},
        historicoAlteracoes: [],
        historicoNegociacao: [],
        valorNegociado: 5000,
        custoPrevisto: 3000,
        desconto: 0,
        descontoMotivo: "",
      });
    });

    expect(result.current.eventos.length).toBeGreaterThan(0);
  });

  it("garante que getSignatureProvider não contém auto-recursão", () => {
    const assinafy = getSignatureProvider("assinafy");
    expect(assinafy.name).toBe("assinafy");
    expect(typeof assinafy.createRequest).toBe("function");
    expect(typeof assinafy.getSignatureLink).toBe("function");
    expect(typeof assinafy.syncStatus).toBe("function");

    const zapSign = getSignatureProvider("zapsign");
    expect(zapSign.name).toBe("ZapSign");
    expect(typeof zapSign.createRequest).toBe("function");
    expect(typeof zapSign.getSignatureLink).toBe("function");
  });

  it("garante que getSignatureLink retorna string sem recursão", async () => {
    const provider = getSignatureProvider("assinafy");
    const link = await provider.getSignatureLink("doc-123", "");
    expect(link).toBe("");
  });
});
