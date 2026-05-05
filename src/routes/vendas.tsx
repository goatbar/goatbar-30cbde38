import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Plus, ShoppingBag, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/lib/app-store";
import { drinks as allDrinks } from "@/lib/mock-data";

export const Route = createFileRoute("/vendas")({ component: () => <AppShell><VendasPage /></AppShell> });

function VendasPage() {
  const { vendas, addVenda } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState(allDrinks[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [unidade, setUnidade] = useState<"7Steakhouse" | "Goat Botequim">("7Steakhouse");

  const receita = vendas.reduce((a, v) => a + v.precoUnitario * v.quantidade, 0);
  const custo = vendas.reduce((a, v) => a + v.custoUnitario * v.quantidade, 0);
  const lucro = receita - custo;
  const margem = receita > 0 ? ((lucro / receita) * 100).toFixed(1) : "0.0";

  const handleCreate = () => {
    const drink = allDrinks.find((d) => d.id === selectedDrink);
    if (!drink) return;
    addVenda({
      data: new Date().toISOString(),
      unidade,
      drinkId: drink.id,
      drinkNome: drink.nome,
      quantidade: qty,
      precoUnitario: drink.precoVenda,
      custoUnitario: drink.custoUnitario,
    });
    setShowModal(false);
  };

  const recentes = [...vendas].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, 30);

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Histórico de vendas por unidade — 7Steakhouse e Goat Botequim."
        action={
          <PrimaryButton onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" /> Registrar venda
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <StatCard label="Total de vendas" value={String(vendas.length)} icon={<ShoppingBag className="h-4 w-4" />} />
          <StatCard label="Receita total" value={fmtBRL(receita)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Lucro total" value={fmtBRL(lucro)} />
          <StatCard label="Margem média" value={`${margem}%`} />
        </div>

        <SectionCard title="Vendas recentes" subtitle={`Últimas ${recentes.length} transações`}>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {["Data", "Drink", "Unidade", "Qtd", "Receita", "Custo", "Lucro"].map((h) => (
                    <th key={h} className="label-eyebrow px-6 py-3 border-y border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentes.map((v) => (
                  <tr key={v.id} className="border-b border-border/60 hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3">{new Date(v.data).toLocaleDateString("pt-BR")}</td>
                    <td className="px-6 py-3 font-medium">{v.drinkNome}</td>
                    <td className="px-6 py-3 text-muted-foreground">{v.unidade}</td>
                    <td className="px-6 py-3">{v.quantidade}</td>
                    <td className="px-6 py-3">{fmtBRL(v.precoUnitario * v.quantidade)}</td>
                    <td className="px-6 py-3 text-muted-foreground">{fmtBRL(v.custoUnitario * v.quantidade)}</td>
                    <td className="px-6 py-3 text-success font-medium">{fmtBRL((v.precoUnitario - v.custoUnitario) * v.quantidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Registrar venda</h2>
              <button onClick={() => setShowModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-eyebrow block mb-2">Drink</label>
                <select
                  value={selectedDrink}
                  onChange={(e) => setSelectedDrink(e.target.value)}
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm"
                >
                  {allDrinks.filter((d) => d.status === "ativo").map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Unidade</label>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value as any)}
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm"
                >
                  <option value="7Steakhouse">7Steakhouse</option>
                  <option value="Goat Botequim">Goat Botequim</option>
                </select>
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm"
                />
              </div>
              {selectedDrink && (() => {
                const d = allDrinks.find((x) => x.id === selectedDrink);
                if (!d) return null;
                return (
                  <div className="rounded-lg bg-background/60 border border-border p-4 text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-muted-foreground">Receita</span><span className="font-medium">{fmtBRL(d.precoVenda * qty)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><span>{fmtBRL(d.custoUnitario * qty)}</span></div>
                    <div className="flex justify-between text-success"><span>Lucro</span><span className="font-semibold">{fmtBRL((d.precoVenda - d.custoUnitario) * qty)}</span></div>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleCreate}>Registrar</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
