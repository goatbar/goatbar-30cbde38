import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard } from "@/components/ui-bits";
import { goatbarService } from "@/services/goatbar-service";
import { fmtBRL } from "@/lib/format";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: () => <AppShell><Dashboard /></AppShell> });

function Dashboard() {
  const [sales, setSales] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [drinks, setDrinks] = useState<any[]>([]);
  useEffect(() => { (async()=>{ setSales(await goatbarService.listSales()); setEvents(await goatbarService.listEvents()); setDrinks(await goatbarService.listDrinks()); })(); }, []);
  const revenue = sales.reduce((a,s)=>a+s.total_revenue,0) + events.reduce((a,e)=>a+e.total_price,0);
  const cost = sales.reduce((a,s)=>a+s.total_cost,0) + events.reduce((a,e)=>a+e.total_cost,0);
  const profit = revenue-cost;
  return <><PageHeader title="Dashboard" subtitle="Dados locais (modo mock)" />
  <div className="px-8 py-7 space-y-7"><div className="grid grid-cols-4 gap-5"><StatCard label="Total revenue" value={fmtBRL(revenue)} /><StatCard label="Total cost" value={fmtBRL(cost)} /><StatCard label="Total profit" value={fmtBRL(profit)} /><StatCard label="Eventos ativos" value={String(events.length)} /></div>
  <SectionCard title="Most profitable drinks">{[...drinks].sort((a,b)=>(b.price-b.cost)-(a.price-a.cost)).slice(0,5).map((d)=><div key={d.id} className="p-2 flex items-center justify-between"><div className="flex items-center gap-3"><img src={d.image} alt={d.name} className="h-10 w-10 rounded object-cover" onError={(e)=>{ e.currentTarget.src = "/drinks/old-fashioned.jpg"; }} /><span>{d.name}</span></div><span>{fmtBRL(d.price-d.cost)}</span></div>)}</SectionCard></div></>;
}
