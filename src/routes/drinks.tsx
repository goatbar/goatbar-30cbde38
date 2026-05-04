import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatCard, PrimaryButton } from "@/components/ui-bits";
import { goatbarService } from "@/services/goatbar-service";
import { fmtBRL2 } from "@/lib/format";
import { Plus, Wine, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/drinks")({ component: () => <AppShell><DrinksPage /></AppShell> });

function DrinksPage() {
  const [drinks, setDrinks] = useState<any[]>([]);
  useEffect(() => { goatbarService.listDrinks().then(setDrinks); }, []);
  const custoMedio = drinks.length ? drinks.reduce((a, d) => a + d.cost, 0) / drinks.length : 0;

  return <>
    <PageHeader title="Drinks" subtitle="Catálogo real conectado ao Supabase." action={<PrimaryButton onClick={async () => {
      await goatbarService.createDrink({ name: `Novo Drink ${Date.now()}`, cost: 12, price: 35 });
      setDrinks(await goatbarService.listDrinks());
    }}><Plus className="h-4 w-4" /> Novo drink</PrimaryButton>} />
    <div className="px-8 py-7 space-y-7">
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="Total" value={String(drinks.length)} icon={<Wine className="h-4 w-4" />} />
        <StatCard label="Custo médio" value={fmtBRL2(custoMedio)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Margem média" value={`${drinks.length ? ((drinks.reduce((a,d)=>a+((d.price-d.cost)/d.price),0)/drinks.length)*100).toFixed(1) : "0.0"}%`} icon={<TrendingUp className="h-4 w-4" />} />
      </div>
      <SectionCard title="Catálogo">
        <div className="space-y-2">{drinks.map((d)=><div key={d.id} className="p-3 border rounded flex justify-between"><span>{d.name}</span><span>{fmtBRL2(d.price)} · custo {fmtBRL2(d.cost)}</span></div>)}</div>
      </SectionCard>
    </div>
  </>;
}
