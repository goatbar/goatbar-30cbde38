import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton } from "@/components/ui-bits";
import { goatbarService } from "@/services/goatbar-service";
import { fmtBRL } from "@/lib/format";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/eventos")({ component: () => <AppShell><EventosPage /></AppShell> });

function EventosPage() {
  const [events, setEvents] = useState<any[]>([]);
  const load = async () => setEvents(await goatbarService.listEvents());
  useEffect(()=>{load();},[]);
  const totalPrice = events.reduce((a,e)=>a+e.total_price,0);
  const totalCost = events.reduce((a,e)=>a+e.total_cost,0);
  return <><PageHeader title="Eventos" action={<PrimaryButton onClick={async ()=>{
    await goatbarService.createEvent({ client_name:"Cliente", event_type:"Corporativo", date:new Date().toISOString().slice(0,10), guests:100, duration:6, total_cost:3000, total_price:9000, total_profit:6000 });
    await load();
  }}><Plus className="h-4 w-4" /> Create event</PrimaryButton>} />
  <div className="px-8 py-7 space-y-7"><div className="grid grid-cols-3 gap-5"><StatCard label="Eventos" value={String(events.length)} /><StatCard label="Receita" value={fmtBRL(totalPrice)} /><StatCard label="Lucro" value={fmtBRL(totalPrice-totalCost)} /></div>
  <SectionCard title="Pipeline">{events.map((e)=><div className="p-3 border rounded mb-2" key={e.id}>{e.client_name ?? "Cliente"} · {e.event_type ?? "Evento"} · {new Date(e.date).toLocaleDateString("pt-BR")}</div>)}</SectionCard></div></>;
}
