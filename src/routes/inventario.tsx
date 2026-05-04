import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { goatbarService } from "@/services/goatbar-service";
import { fmtBRL2 } from "@/lib/format";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/inventario")({ component: () => <AppShell><InventoryPage /></AppShell> });

function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const load = async()=>{ setItems(await goatbarService.listInventory()); setMoves(await goatbarService.listInventoryMovements());};
  useEffect(()=>{load();},[]);
  const totalValue = items.reduce((a,i)=>a + i.quantity * i.cost_per_unit, 0);
  return <><PageHeader title="Inventário" action={<PrimaryButton onClick={async()=>{ await goatbarService.createInventory({ name:`Insumo ${Date.now()}`, category:"geral", quantity:10, unit:"un", cost_per_unit:5 }); await load();}}>Add item</PrimaryButton>} />
  <div className="px-8 py-7 space-y-7"><StatCard label="Valor total" value={fmtBRL2(totalValue)} />
  <SectionCard title="Itens">{items.map((i)=><div key={i.id} className="p-3 border rounded flex justify-between mb-2"><span>{i.name} ({i.quantity} {i.unit})</span><div className="flex gap-2"><GhostButton onClick={async()=>{await goatbarService.updateInventoryQuantity(i.id,1,"manual","in"); await load();}}>+1</GhostButton><GhostButton onClick={async()=>{await goatbarService.updateInventoryQuantity(i.id,1,"manual","out"); await load();}}>-1</GhostButton></div></div>)}</SectionCard>
  <SectionCard title="Movimentações">{moves.slice(0,20).map((m)=><div key={m.id} className="p-2 border-b">{m.type} · {m.quantity} · {m.source}</div>)}</SectionCard></div></>;
}
