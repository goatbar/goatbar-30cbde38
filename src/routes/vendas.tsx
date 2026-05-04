import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton } from "@/components/ui-bits";
import { goatbarService } from "@/services/goatbar-service";
import { fmtBRL } from "@/lib/format";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/vendas")({ component: () => <AppShell><VendasPage /></AppShell> });

function VendasPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [drinks, setDrinks] = useState<any[]>([]);
  const load = async () => { setSales(await goatbarService.listSales()); setDrinks(await goatbarService.listDrinks()); };
  useEffect(() => { load(); }, []);
  const receita = sales.reduce((a,s)=>a+s.total_revenue,0); const custo = sales.reduce((a,s)=>a+s.total_cost,0); const lucro = receita-custo;
  return <><PageHeader title="Vendas" action={<PrimaryButton onClick={async ()=>{
    const d = drinks[0]; if (!d) return;
    await goatbarService.createSale({ location:"7steakhouse", items:[{ drink_id:d.id, quantity:1, price:d.price, cost:d.cost }]});
    await load();
  }}><Plus className="h-4 w-4" /> Add sale</PrimaryButton>} />
  <div className="px-8 py-7 space-y-7"><div className="grid grid-cols-3 gap-5"><StatCard label="Receita" value={fmtBRL(receita)} /><StatCard label="Custo" value={fmtBRL(custo)} /><StatCard label="Lucro" value={fmtBRL(lucro)} /></div>
  <SectionCard title="Histórico">{sales.map((s)=><div key={s.id} className="p-3 border rounded mb-2">{new Date(s.date).toLocaleDateString("pt-BR")} · {s.location} · {fmtBRL(s.total_revenue)}</div>)}</SectionCard></div></>;
}
