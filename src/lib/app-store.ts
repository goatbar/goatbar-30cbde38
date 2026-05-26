import { useEffect, useMemo, useState } from "react";
import { saveImage, loadImage, deleteImage } from "@/lib/image-store";
import { supabase } from "@/integrations/supabase/client";
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
  delete (sanitized as any).loadingDrinks;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  window.dispatchEvent(new CustomEvent(STORE_SYNC_EVENT));
}

type AppStore = {
  vendas: Venda[];
  eventos: Evento[];
  contratos: Contrato[];
  parametros: ParametroCalculo[];
  drinks: Drink[];
  loadingDrinks?: boolean;
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

  const keys = Object.keys(window.localStorage).filter(
    (key) => key.startsWith("goatbar-functional-store-v") && key !== STORAGE_KEY,
  );

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
    const recoveredInventory = (Array.isArray(mock?.inventory) ? mock.inventory : []).map(
      (item: any) => ({
        id: item.id ?? `inv${Date.now()}${Math.random()}`,
        nome: item.name ?? item.nome ?? "Item",
        quantidadeTotal: Number(item.quantity ?? item.quantidadeTotal ?? 0),
        observacoes: item.observacoes ?? "",
      }),
    );

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
  const shouldMergeLegacyStores = !activeStore;
  const legacySources = shouldMergeLegacyStores ? legacyStores : [];

  const merged: AppStore = {
    ...base,
    vendas: mergeById(base.vendas ?? [], ...legacySources.map((s) => s.vendas ?? [])),
    eventos: mergeById(base.eventos ?? [], ...legacySources.map((s) => s.eventos ?? [])),
    contratos: mergeById(base.contratos ?? [], ...legacySources.map((s) => s.contratos ?? [])),
    parametros: base.parametros ?? seedParametros,
    drinks: mergeById(base.drinks ?? [], ...legacySources.map((s) => s.drinks ?? [])),
    contractTemplates: mergeById(
      base.contractTemplates ?? [],
      ...legacySources.map((s) => s.contractTemplates ?? []),
    ),
    contractSigners: mergeById(
      base.contractSigners ?? [],
      ...legacySources.map((s) => s.contractSigners ?? []),
    ),
    glasswares: mergeById(base.glasswares ?? [], ...legacySources.map((s) => s.glasswares ?? [])),
    eventContracts: mergeById(
      base.eventContracts ?? [],
      ...legacySources.map((s) => s.eventContracts ?? []),
    ),
    eventContractClientDatas: mergeById(
      base.eventContractClientDatas ?? [],
      ...legacySources.map((s) => s.eventContractClientDatas ?? []),
    ),
    contractHistories: mergeById(
      base.contractHistories ?? [],
      ...legacySources.map((s) => s.contractHistories ?? []),
    ),
    contractSignatureHistories: mergeById(
      base.contractSignatureHistories ?? [],
      ...legacySources.map((s) => s.contractSignatureHistories ?? []),
    ),
    financialSessions: mergeById(
      base.financialSessions ?? [],
      ...legacySources.map((s) => s.financialSessions ?? []),
    ),
    inventoryItems: mergeById(
      base.inventoryItems ?? [],
      ...legacySources.map((s) => s.inventoryItems ?? []),
    ),
  };

  return recoverFromMockDb(merged);
}

// Global store and pub-sub state logic
let globalStore: AppStore = readStore();
let hasFetchedDrinks = false;
let isFetchingDrinks = false;
const subscribers = new Set<(store: AppStore) => void>();

function setGlobalStore(updater: AppStore | ((prev: AppStore) => AppStore)) {
  const nextStore = typeof updater === "function" ? updater(globalStore) : updater;
  globalStore = nextStore;
  subscribers.forEach((callback) => callback(globalStore));
  try {
    writeStore(globalStore);
  } catch (e) {
    console.error("Failed to write to localStorage:", e);
  }
}

// Sync across tabs
if (typeof window !== "undefined") {
  const syncFromLocalStorage = () => {
    const fresh = readStore();
    setGlobalStore({ ...fresh, loadingDrinks: globalStore.loadingDrinks });
  };
  window.addEventListener("storage", syncFromLocalStorage);
  window.addEventListener(STORE_SYNC_EVENT, syncFromLocalStorage);
}

// Helper to convert base64 data URL to Blob
export function base64ToBlob(base64: string): { blob: Blob; mime: string } {
  const arr = base64.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return { blob: new Blob([u8arr], { type: mime }), mime };
}

// Upload image to Supabase Storage and return public URL
export async function uploadDrinkImage(drinkId: string, base64OrUrl: string): Promise<string> {
  if (!base64OrUrl.startsWith("data:")) {
    return base64OrUrl;
  }

  const { blob, mime } = base64ToBlob(base64OrUrl);
  const ext = mime.split("/")[1] || "png";
  const fileName = `${drinkId}_${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("drink_images")
    .upload(fileName, blob, {
      contentType: mime,
      upsert: true,
    });

  if (error) {
    console.error("Error uploading image to Supabase:", error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("drink_images")
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function deleteDrinkImage(imageUrl: string) {
  try {
    if (!imageUrl || !imageUrl.includes("/storage/v1/object/public/drink_images/")) {
      return;
    }
    const parts = imageUrl.split("/drink_images/");
    if (parts.length > 1) {
      const fileName = decodeURIComponent(parts[1]);
      await supabase.storage.from("drink_images").remove([fileName]);
    }
  } catch (e) {
    console.error("Failed to delete image from Supabase Storage:", e);
  }
}

// Background Supabase Sync Functions
async function syncDrinkToSupabase(id: string, payload: Partial<Drink>) {
  try {
    let imageUrl = payload.imagem;
    if (imageUrl) {
      if (imageUrl.startsWith("idb:")) {
        const key = imageUrl.slice(4);
        const base64 = await loadImage(key);
        if (base64) {
          imageUrl = await uploadDrinkImage(id, base64);
          await deleteImage(key);
        }
      } else if (imageUrl.startsWith("data:")) {
        imageUrl = await uploadDrinkImage(id, imageUrl);
      }
    }

    const { data: existing } = await supabase
      .from("drinks")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    const dbPayload = {
      id,
      nome: payload.nome,
      categoria: payload.categoria,
      descricao: payload.descricao,
      custo_unitario: payload.custoUnitario,
      insumos: payload.insumos ? payload.insumos : undefined,
      modality_config: payload.modalityConfig ? payload.modalityConfig : undefined,
      imagem: imageUrl,
    };

    const cleanPayload = Object.fromEntries(
      Object.entries(dbPayload).filter(([_, v]) => v !== undefined)
    );

    if (existing) {
      await supabase
        .from("drinks")
        .update(cleanPayload)
        .eq("id", id);
    } else {
      const insertPayload = {
        id,
        nome: payload.nome ?? "Sem nome",
        categoria: payload.categoria ?? "Geral",
        descricao: payload.descricao ?? "",
        custo_unitario: payload.custoUnitario ?? 0,
        insumos: payload.insumos ?? [],
        modality_config: payload.modalityConfig ?? {},
        imagem: imageUrl ?? null,
        ...cleanPayload
      };
      await supabase.from("drinks").insert(insertPayload);
    }

    if (imageUrl && imageUrl !== payload.imagem) {
      // Dispatch update to global store
      setGlobalStore((prev) => ({
        ...prev,
        drinks: prev.drinks.map((d) => (d.id === id ? { ...d, imagem: imageUrl } : d)),
      }));
    }
  } catch (e) {
    console.error("Error syncing drink to Supabase:", e);
  }
}

async function deleteDrinkFromSupabase(id: string) {
  try {
    const { data: drink } = await supabase
      .from("drinks")
      .select("imagem")
      .eq("id", id)
      .maybeSingle();

    if (drink?.imagem) {
      await deleteDrinkImage(drink.imagem);
    }

    await supabase.from("drinks").delete().eq("id", id);
  } catch (e) {
    console.error("Error deleting drink from Supabase:", e);
  }
}

export function useAppStore() {
  const [store, setStore] = useState<AppStore>(globalStore);

  // Load drinks from Supabase on mount (ONCE globally)
  useEffect(() => {
    setStore(globalStore);
    subscribers.add(setStore);

    if (!hasFetchedDrinks && !isFetchingDrinks) {
      isFetchingDrinks = true;
      setGlobalStore((prev) => ({ ...prev, loadingDrinks: true }));

      supabase
        .from("drinks")
        .select("*")
        .order("nome", { ascending: true })
        .then(({ data, error }) => {
          isFetchingDrinks = false;
          if (error) {
            console.error("Failed to load drinks from Supabase:", error);
            setGlobalStore((prev) => ({ ...prev, loadingDrinks: false }));
            return;
          }

          hasFetchedDrinks = true;

          if (data && data.length > 0) {
            const parsedDrinks = data.map((d: any) => {
              let parsedInsumos = [];
              try {
                parsedInsumos = typeof d.insumos === "string" ? JSON.parse(d.insumos) : (d.insumos || []);
              } catch (err) {
                parsedInsumos = d.insumos || [];
              }

              let parsedConfig = {};
              try {
                parsedConfig = typeof d.modality_config === "string" ? JSON.parse(d.modality_config) : (d.modality_config || {});
              } catch (err) {
                parsedConfig = d.modality_config || {};
              }

              return {
                id: d.id,
                nome: d.nome,
                categoria: d.categoria || "Geral",
                descricao: d.descricao || "",
                custoUnitario: Number(d.custo_unitario || 0),
                insumos: parsedInsumos,
                modalityConfig: parsedConfig,
                imagem: d.imagem,
              } as Drink;
            });

            // Check if any drinks have local IndexedDB images to migrate to Supabase Storage
            parsedDrinks.forEach((d) => {
              if (d.imagem && d.imagem.startsWith("idb:")) {
                const key = d.imagem.slice(4);
                loadImage(key).then(async (base64) => {
                  if (base64) {
                    try {
                      const publicUrl = await uploadDrinkImage(d.id, base64);
                      await supabase.from("drinks").update({ imagem: publicUrl }).eq("id", d.id);
                      setGlobalStore((prev) => ({
                        ...prev,
                        drinks: prev.drinks.map((x) => (x.id === d.id ? { ...x, imagem: publicUrl } : x)),
                      }));
                      await deleteImage(key);
                    } catch (err) {
                      console.error("Migration of local image failed for drink:", d.id, err);
                    }
                  }
                });
              }
            });

            setGlobalStore((prev) => ({
              ...prev,
              drinks: parsedDrinks,
              loadingDrinks: false,
            }));
          } else {
            console.log("Supabase drinks table is empty. Seeding default drinks...");
            const initialDrinks = readStore().drinks;
            
            setGlobalStore((prev) => ({
              ...prev,
              drinks: initialDrinks,
              loadingDrinks: false,
            }));

            for (const d of initialDrinks) {
              syncDrinkToSupabase(d.id, d);
            }
          }
        })
        .catch((err) => {
          isFetchingDrinks = false;
          console.error("Failed to load drinks from Supabase:", err);
          setGlobalStore((prev) => ({ ...prev, loadingDrinks: false }));
        });
    }

    return () => {
      subscribers.delete(setStore);
    };
  }, []);

  // One-time migration: move any Base64 images already stored in localStorage
  // to IndexedDB, then update the store with the idb: reference.
  useEffect(() => {
    const migrate = async () => {
      const current = readStore();
      const hasBlobImages = current.drinks.some((d) => d.imagem && d.imagem.startsWith("data:"));
      if (!hasBlobImages) return;

      const migratedDrinks = await Promise.all(
        current.drinks.map(async (d) => {
          if (d.imagem && d.imagem.startsWith("data:")) {
            await saveImage(d.id, d.imagem);
            return { ...d, imagem: `idb:${d.id}` };
          }
          return d;
        }),
      );

      setGlobalStore((prev) => {
        const prevMap = new Map(prev.drinks.map((d) => [d.id, d]));
        const nextDrinks = migratedDrinks.map((d) => prevMap.get(d.id) ?? d);
        return { ...prev, drinks: nextDrinks };
      });
    };

    migrate().catch(console.error);
  }, []);

  const actions = useMemo(
    () => ({
      addVenda(input: Omit<Venda, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          vendas: [{ ...input, id: `v${Date.now()}` }, ...prev.vendas],
        }));
      },
      addEvento(input: Omit<Evento, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          eventos: [{ ...input, id: `e${Date.now()}` }, ...prev.eventos],
        }));
      },
      addContrato(input: Omit<Contrato, "id" | "criadoEm">) {
        setGlobalStore((prev) => ({
          ...prev,
          contratos: [
            { ...input, id: `c${Date.now()}`, criadoEm: new Date().toISOString() },
            ...prev.contratos,
          ],
        }));
      },
      updateEvento(id: string, payload: Partial<Evento>) {
        setGlobalStore((prev) => ({
          ...prev,
          eventos: prev.eventos.map((e) => (e.id === id ? { ...e, ...payload } : e)),
        }));
      },
      updateParametros(updated: ParametroCalculo[]) {
        setGlobalStore((prev) => ({ ...prev, parametros: updated }));
      },
      updateDrink(id: string, payload: Partial<Drink>) {
        let updatedDrink: Drink | null = null;
        setGlobalStore((prev) => {
          const nextDrinks = prev.drinks.map((d) => {
            if (d.id !== id) return d;
            const updated = { ...d, ...payload };
            // BUG 2 fix: priority for custoUnitario:
            // 1. Sum of insumos (if any are provided with a positive total)
            // 2. payload.custoUnitario (explicit value from the form)
            // 3. Keep the existing value (never overwrite with zero inadvertently)
            const insumoSource = payload.insumos ?? payload.ingredientes;
            if (insumoSource && insumoSource.length > 0) {
              const insumosTotal = Number(
                insumoSource.reduce((a: number, i: { custo: number }) => a + i.custo, 0).toFixed(2),
              );
              if (insumosTotal > 0) {
                updated.custoUnitario = insumosTotal;
              } else if (payload.custoUnitario !== undefined && payload.custoUnitario > 0) {
                updated.custoUnitario = payload.custoUnitario;
              }
              // else: keep existing d.custoUnitario (already in `updated` via spread)
            } else if (payload.custoUnitario !== undefined && payload.custoUnitario > 0) {
              updated.custoUnitario = payload.custoUnitario;
            }
            updatedDrink = updated;
            return updated;
          });
          return { ...prev, drinks: nextDrinks };
        });

        if (updatedDrink) {
          syncDrinkToSupabase(id, updatedDrink);
        }
      },
      addDrink(input: Omit<Drink, "id"> & { _presetId?: string }) {
        let newDrink: Drink | null = null;
        setGlobalStore((prev) => {
          const { _presetId, ...rest } = input as any;
          const insumoSource = (rest.insumos ?? rest.ingredientes ?? []) as { custo: number }[];
          const drink: Drink = {
            ...rest,
            id: _presetId ?? `d${Date.now()}`,
            custoUnitario: Number(
              insumoSource.reduce((a: number, i: { custo: number }) => a + i.custo, 0).toFixed(2),
            ),
          };
          newDrink = drink;
          return {
            ...prev,
            drinks: [drink, ...prev.drinks],
          };
        });

        if (newDrink) {
          syncDrinkToSupabase((newDrink as Drink).id, newDrink);
        }
      },
      deleteDrink(id: string) {
        setGlobalStore((prev) => ({
          ...prev,
          drinks: prev.drinks.filter((d) => d.id !== id),
        }));
        deleteDrinkFromSupabase(id);
      },
      addEventContract(input: Omit<EventContract, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          eventContracts: [{ ...input, id: `ec${Date.now()}` }, ...prev.eventContracts],
        }));
      },
      updateEventContract(id: string, payload: Partial<EventContract>) {
        setGlobalStore((prev) => ({
          ...prev,
          eventContracts: prev.eventContracts.map((ec) =>
            ec.id === id ? { ...ec, ...payload } : ec,
          ),
        }));
      },
      addEventContractClientData(input: Omit<EventContractClientData, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          eventContractClientDatas: [
            { ...input, id: `ecd${Date.now()}` },
            ...prev.eventContractClientDatas,
          ],
        }));
      },
      addContractHistory(input: Omit<ContractHistory, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          contractHistories: [{ ...input, id: `ch${Date.now()}` }, ...prev.contractHistories],
        }));
      },
      addContractSignatureHistory(input: Omit<ContractSignatureHistory, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          contractSignatureHistories: [
            { ...input, id: `csh${Date.now()}` },
            ...prev.contractSignatureHistories,
          ],
        }));
      },
      addFinancialSession(input: Omit<FinancialSession, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          financialSessions: [{ ...input, id: `fs${Date.now()}` }, ...prev.financialSessions],
        }));
      },
      updateFinancialSession(id: string, payload: Partial<FinancialSession>) {
        setGlobalStore((prev) => ({
          ...prev,
          financialSessions: prev.financialSessions.map((fs) =>
            fs.id === id ? { ...fs, ...payload } : fs,
          ),
        }));
      },
      deleteFinancialSession(id: string) {
        setGlobalStore((prev) => ({
          ...prev,
          financialSessions: prev.financialSessions.filter((fs) => fs.id !== id),
        }));
      },
      addInventoryItem(input: Omit<InventoryItem, "id">) {
        setGlobalStore((prev) => ({
          ...prev,
          inventoryItems: [{ ...input, id: `inv${Date.now()}` }, ...prev.inventoryItems],
        }));
      },
      updateInventoryItem(id: string, payload: Partial<InventoryItem>) {
        setGlobalStore((prev) => ({
          ...prev,
          inventoryItems: prev.inventoryItems.map((inv) =>
            inv.id === id ? { ...inv, ...payload } : inv,
          ),
        }));
      },
      deleteInventoryItem(id: string) {
        setGlobalStore((prev) => ({
          ...prev,
          inventoryItems: prev.inventoryItems.filter((inv) => inv.id !== id),
        }));
      },
    }),
    [],
  );

  return { ...store, ...actions };
}
