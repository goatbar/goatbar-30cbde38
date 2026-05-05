import { useEffect, useMemo, useState } from "react";
import {
  contratos as seedContratos,
  eventos as seedEventos,
  parametros as seedParametros,
  vendas as seedVendas,
  type Contrato,
  type Evento,
  type ParametroCalculo,
  type Venda,
} from "@/lib/mock-data";

const STORAGE_KEY = "goatbar-functional-store-v3";

type AppStore = {
  vendas: Venda[];
  eventos: Evento[];
  contratos: Contrato[];
  parametros: ParametroCalculo[];
};

function seedStore(): AppStore {
  return {
    vendas: structuredClone(seedVendas),
    eventos: structuredClone(seedEventos),
    contratos: structuredClone(seedContratos),
    parametros: structuredClone(seedParametros),
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
    }),
    [],
  );

  return { ...store, ...actions };
}
