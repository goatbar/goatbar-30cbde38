import { useEffect, useMemo, useState } from "react";
import {
  contratos as seedContratos,
  eventos as seedEventos,
  parametros as seedParametros,
  vendas as seedVendas,
  drinks as seedDrinks,
  contractTemplates as seedContractTemplates,
  contractSigners as seedContractSigners,
  glasswares as seedGlasswares,
  eventContracts as seedEventContracts,
  eventContractClientDatas as seedEventContractClientDatas,
  contractHistories as seedContractHistories,
  contractSignatureHistories as seedContractSignatureHistories,
  type Drink,
  type Contrato,
  type Evento,
  type ParametroCalculo,
  type Venda,
  type ContractTemplate,
  type ContractSigner,
  type Glassware,
  type EventContract,
  type EventContractClientData,
  type ContractHistory,
  type ContractSignatureHistory,
} from "@/lib/mock-data";

const STORAGE_KEY = "goatbar-functional-store-v5";

type AppStore = {
  vendas: Venda[];
  eventos: Evento[];
  contratos: Contrato[];
  parametros: ParametroCalculo[];
  drinks: Drink[];
  contractTemplates: ContractTemplate[];
  contractSigners: ContractSigner[];
  glasswares: Glassware[];
  eventContracts: EventContract[];
  eventContractClientDatas: EventContractClientData[];
  contractHistories: ContractHistory[];
  contractSignatureHistories: ContractSignatureHistory[];
};

function seedStore(): AppStore {
  return {
    vendas: structuredClone(seedVendas),
    eventos: structuredClone(seedEventos),
    contratos: structuredClone(seedContratos),
    parametros: structuredClone(seedParametros),
    drinks: structuredClone(seedDrinks),
    contractTemplates: structuredClone(seedContractTemplates),
    contractSigners: structuredClone(seedContractSigners),
    glasswares: structuredClone(seedGlasswares),
    eventContracts: structuredClone(seedEventContracts),
    eventContractClientDatas: structuredClone(seedEventContractClientDatas),
    contractHistories: structuredClone(seedContractHistories),
    contractSignatureHistories: structuredClone(seedContractSignatureHistories),
  };
}

function readStore(): AppStore {
  if (typeof window === "undefined") return seedStore();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedStore();
  try {
    const parsed = JSON.parse(raw) as AppStore;
    return {
      vendas: parsed.vendas ?? seedVendas,
      eventos: parsed.eventos ?? seedEventos,
      contratos: parsed.contratos ?? seedContratos,
      parametros: parsed.parametros ?? seedParametros,
      drinks: parsed.drinks ?? seedDrinks,
      contractTemplates: parsed.contractTemplates ?? seedContractTemplates,
      contractSigners: parsed.contractSigners ?? seedContractSigners,
      glasswares: parsed.glasswares ?? seedGlasswares,
      eventContracts: parsed.eventContracts ?? seedEventContracts,
      eventContractClientDatas: parsed.eventContractClientDatas ?? seedEventContractClientDatas,
      contractHistories: parsed.contractHistories ?? seedContractHistories,
      contractSignatureHistories: parsed.contractSignatureHistories ?? seedContractSignatureHistories,
    };
  } catch {
    return seedStore();
  }
}

export function useAppStore() {
  const [store, setStore] = useState<AppStore>(() => readStore());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const actions = useMemo(
    () => ({
      addVenda(input: Omit<Venda, "id">) {
        setStore((prev) => ({
          ...prev,
          vendas: [{ ...input, id: `v${Date.now()}` }, ...prev.vendas],
        }));
      },
      addEvento(input: Omit<Evento, "id">) {
        setStore((prev) => ({
          ...prev,
          eventos: [{ ...input, id: `e${Date.now()}` }, ...prev.eventos],
        }));
      },
      addContrato(input: Omit<Contrato, "id" | "criadoEm">) {
        setStore((prev) => ({
          ...prev,
          contratos: [{ ...input, id: `c${Date.now()}`, criadoEm: new Date().toISOString() }, ...prev.contratos],
        }));
      },
      updateEvento(id: string, payload: Partial<Evento>) {
        setStore((prev) => ({
          ...prev,
          eventos: prev.eventos.map((e) => (e.id === id ? { ...e, ...payload } : e)),
        }));
      },
      updateParametros(updated: ParametroCalculo[]) {
        setStore((prev) => ({ ...prev, parametros: updated }));
      },
      updateDrink(id: string, payload: Partial<Drink>) {
        setStore((prev) => ({
          ...prev,
          drinks: prev.drinks.map((d) => {
            if (d.id !== id) return d;
            const updated = { ...d, ...payload };
            if (payload.ingredientes) {
              updated.custoUnitario = Number(payload.ingredientes.reduce((a, i) => a + i.custo, 0).toFixed(2));
            }
            return updated;
          }),
        }));
      },
      addEventContract(input: Omit<EventContract, "id">) {
        setStore((prev) => ({
          ...prev,
          eventContracts: [{ ...input, id: `ec${Date.now()}` }, ...prev.eventContracts],
        }));
      },
      updateEventContract(id: string, payload: Partial<EventContract>) {
        setStore((prev) => ({
          ...prev,
          eventContracts: prev.eventContracts.map((ec) => (ec.id === id ? { ...ec, ...payload } : ec)),
        }));
      },
      addEventContractClientData(input: Omit<EventContractClientData, "id">) {
        setStore((prev) => ({
          ...prev,
          eventContractClientDatas: [{ ...input, id: `ecd${Date.now()}` }, ...prev.eventContractClientDatas],
        }));
      },
      addContractHistory(input: Omit<ContractHistory, "id">) {
        setStore((prev) => ({
          ...prev,
          contractHistories: [{ ...input, id: `ch${Date.now()}` }, ...prev.contractHistories],
        }));
      },
      addContractSignatureHistory(input: Omit<ContractSignatureHistory, "id">) {
        setStore((prev) => ({
          ...prev,
          contractSignatureHistories: [{ ...input, id: `csh${Date.now()}` }, ...prev.contractSignatureHistories],
        }));
      },
    }),
    [],
  );

  return { ...store, ...actions };
}
