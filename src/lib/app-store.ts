import { useEffect, useMemo, useState } from "react";
import { saveImage } from "@/lib/image-store";
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
  financialSessions as seedFinancialSessions,
  inventoryItems as seedInventoryItems,
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
  type FinancialSession,
  type InventoryItem,
} from "@/lib/mock-data";

const STORAGE_KEY = "goatbar-functional-store-v11";
const STORE_SYNC_EVENT = "goatbar-store-sync";

function writeStore(store: AppStore) {
  if (typeof window === "undefined") return;
  const sanitized: AppStore = {
    ...store,
    drinks: store.drinks.map((d) => {
      if (d.imagem && d.imagem.startsWith("data:")) {
        return { ...d, imagem: `idb:` };
      }
      return d;
    }),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  window.dispatchEvent(new CustomEvent(STORE_SYNC_EVENT));
}


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
  financialSessions: FinancialSession[];
  inventoryItems: InventoryItem[];
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
    financialSessions: structuredClone(seedFinancialSessions),
    inventoryItems: structuredClone(seedInventoryItems),
  };
}


function readLegacyFunctionalStores(): AppStore[] {
  if (typeof window === "undefined") return [];

  const keys = Object.keys(window.localStorage)
    .filter((key) => key.startsWith("goatbar-functional-store-v") && key !== STORAGE_KEY);

  const parsed = keys
    .map((key) => window.localStorage.getItem(key))
    .filter(Boolean)
    .map((raw) => {
      try {
        return JSON.parse(raw as string) as AppStore;
      } catch {
        return null;
      }
    })
    .filter((v): v is AppStore => Boolean(v));

  return parsed;
}

function mergeById<T extends { id: string }>(...lists: T[][]): T[] {
  const map = new Map<string, T>();
  lists.flat().forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function recoverFromMockDb(store: AppStore): AppStore {
  if (typeof window === "undefined") return store;
  const raw = window.localStorage.getItem("goatbar_mock_db_v1");
  if (!raw) return store;

  try {
    const mock = JSON.parse(raw);
    const recoveredInventory = (Array.isArray(mock?.inventory) ? mock.inventory : []).map((item: any) => ({
      id: item.id ?? `inv${Date.now()}${Math.random()}`,
      nome: item.name ?? item.nome ?? "Item",
      quantidadeTotal: Number(item.quantity ?? item.quantidadeTotal ?? 0),
      observacoes: item.observacoes ?? "",
    }));

    const recoveredVendas = (Array.isArray(mock?.sales) ? mock.sales : []).map((sale: any) => ({
      id: sale.id ?? `v${Date.now()}${Math.random()}`,
      data: sale.date ?? new Date().toISOString(),
      local: "Goat Botequim",
      itens: [],
      totalReceita: Number(sale.total_revenue ?? 0),
      totalCusto: Number(sale.total_cost ?? 0),
      lucro: Number(sale.total_revenue ?? 0) - Number(sale.total_cost ?? 0),
      repassePercentual: 0,
      valorRepasse: 0,
      lucroLiquido: Number(sale.total_revenue ?? 0) - Number(sale.total_cost ?? 0),
    }));

    return {
      ...store,
      inventoryItems: store.inventoryItems.length > 0 ? store.inventoryItems : recoveredInventory,
      vendas: store.vendas.length > 0 ? store.vendas : recoveredVendas,
    };
  } catch {
    return store;
  }
}
function readStore(): AppStore {
  if (typeof window === "undefined") return seedStore();

  const activeRaw = window.localStorage.getItem(STORAGE_KEY);
  const legacyStores = readLegacyFunctionalStores();

  const safeParse = (raw: string | null): AppStore | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AppStore;
    } catch {
      return null;
    }
  };

  const activeStore = safeParse(activeRaw);
  const base = activeStore ?? seedStore();

  const merged: AppStore = {
    ...base,
    vendas: mergeById(base.vendas ?? [], ...legacyStores.map((s) => s.vendas ?? [])),
    eventos: mergeById(base.eventos ?? [], ...legacyStores.map((s) => s.eventos ?? [])),
    contratos: mergeById(base.contratos ?? [], ...legacyStores.map((s) => s.contratos ?? [])),
    parametros: base.parametros ?? seedParametros,
    drinks: mergeById(base.drinks ?? [], ...legacyStores.map((s) => s.drinks ?? [])),
    contractTemplates: mergeById(base.contractTemplates ?? [], ...legacyStores.map((s) => s.contractTemplates ?? [])),
    contractSigners: mergeById(base.contractSigners ?? [], ...legacyStores.map((s) => s.contractSigners ?? [])),
    glasswares: mergeById(base.glasswares ?? [], ...legacyStores.map((s) => s.glasswares ?? [])),
    eventContracts: mergeById(base.eventContracts ?? [], ...legacyStores.map((s) => s.eventContracts ?? [])),
    eventContractClientDatas: mergeById(base.eventContractClientDatas ?? [], ...legacyStores.map((s) => s.eventContractClientDatas ?? [])),
    contractHistories: mergeById(base.contractHistories ?? [], ...legacyStores.map((s) => s.contractHistories ?? [])),
    contractSignatureHistories: mergeById(base.contractSignatureHistories ?? [], ...legacyStores.map((s) => s.contractSignatureHistories ?? [])),
    financialSessions: mergeById(base.financialSessions ?? [], ...legacyStores.map((s) => s.financialSessions ?? [])),
    inventoryItems: mergeById(base.inventoryItems ?? [], ...legacyStores.map((s) => s.inventoryItems ?? [])),
  };

  return recoverFromMockDb(merged);
}


export function useAppStore() {
  const [store, setStore] = useState<AppStore>(() => readStore());

  // One-time migration: move any Base64 images already stored in localStorage
  // to IndexedDB, then update the store with the idb: reference.
  useEffect(() => {
    const hasBlobImages = store.drinks.some(
      (d) => d.imagem && d.imagem.startsWith("data:")
    );
    if (!hasBlobImages) return;

    const migrate = async () => {
      const migratedDrinks = await Promise.all(
        store.drinks.map(async (d) => {
          if (d.imagem && d.imagem.startsWith("data:")) {
            await saveImage(d.id, d.imagem);
            return { ...d, imagem: `idb:${d.id}` };
          }
          return d;
        })
      );
      setStore((prev) => ({ ...prev, drinks: migratedDrinks }));
    };

    migrate().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      writeStore(store);
    } catch (e) {
      if (e instanceof Error && e.name === "QuotaExceededError") {
        console.error("LocalStorage quota exceeded!");
        alert(
          "Erro de armazenamento: o espaço local está cheio.\n" +
          "Tente remover registros antigos ou usar imagens menores."
        );
      } else {
        console.error("Falha ao salvar store:", e);
      }
    }
  }, [store]);

  useEffect(() => {
    const syncStore = () => setStore(readStore());
    window.addEventListener("storage", syncStore);
    window.addEventListener(STORE_SYNC_EVENT, syncStore);
    return () => {
      window.removeEventListener("storage", syncStore);
      window.removeEventListener(STORE_SYNC_EVENT, syncStore);
    };
  }, []);

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
            // Recalculate custoUnitario from insumos if provided
            const insumoSource = payload.insumos ?? payload.ingredientes;
            if (insumoSource && insumoSource.length > 0) {
              updated.custoUnitario = Number(insumoSource.reduce((a: number, i: { custo: number }) => a + i.custo, 0).toFixed(2));
            }
            return updated;
          }),
        }));
      },
      addDrink(input: Omit<Drink, "id"> & { _presetId?: string }) {
        setStore((prev) => {
          const { _presetId, ...rest } = input as any;
          const insumoSource = (rest.insumos ?? rest.ingredientes ?? []) as { custo: number }[];
          const newDrink: Drink = {
            ...rest,
            id: _presetId ?? `d${Date.now()}`,
            custoUnitario: Number(insumoSource.reduce((a: number, i: { custo: number }) => a + i.custo, 0).toFixed(2))
          };
          return {
            ...prev,
            drinks: [newDrink, ...prev.drinks],
          };
        });
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
      addFinancialSession(input: Omit<FinancialSession, "id">) {
        setStore((prev) => ({
          ...prev,
          financialSessions: [{ ...input, id: `fs${Date.now()}` }, ...prev.financialSessions],
        }));
      },
      updateFinancialSession(id: string, payload: Partial<FinancialSession>) {
        setStore((prev) => ({
          ...prev,
          financialSessions: prev.financialSessions.map((fs) => (fs.id === id ? { ...fs, ...payload } : fs)),
        }));
      },
      deleteFinancialSession(id: string) {
        setStore((prev) => ({
          ...prev,
          financialSessions: prev.financialSessions.filter((fs) => fs.id !== id),
        }));
      },
      addInventoryItem(input: Omit<InventoryItem, "id">) {
        setStore((prev) => ({
          ...prev,
          inventoryItems: [{ ...input, id: `inv${Date.now()}` }, ...prev.inventoryItems],
        }));
      },
      updateInventoryItem(id: string, payload: Partial<InventoryItem>) {
        setStore((prev) => ({
          ...prev,
          inventoryItems: prev.inventoryItems.map((inv) => (inv.id === id ? { ...inv, ...payload } : inv)),
        }));
      },
      deleteInventoryItem(id: string) {
        setStore((prev) => ({
          ...prev,
          inventoryItems: prev.inventoryItems.filter((inv) => inv.id !== id),
        }));
      },
    }),
    [],
  );

  return { ...store, ...actions };
}
