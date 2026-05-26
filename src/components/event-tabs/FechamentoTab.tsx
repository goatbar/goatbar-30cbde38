import React, { useEffect, useState } from "react";
import { eventBudgetService, type EventClosing, type EventClosingItem } from "@/services/event-budget-service";
import { fmtBRL } from "@/lib/format";
import { Save, Loader2, Play } from "lucide-react";

export function FechamentoTab({ eventId }: { eventId: string }) {
  const [closing, setClosing] = useState<Partial<EventClosing>>({
    event_id: eventId,
    revenue_amount: 0,
    total_purchase_cost: 0,
    total_team_cost: 0,
    total_logistics_cost: 0,
    total_consumed_cost: 0,
    total_lost_cost: 0,
    total_event_cost: 0,
    event_profit: 0,
    event_margin: 0,
    status: "Planejado"
  });
  const [items, setItems] = useState<EventClosingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    setLoading(true);
    try {
      const dataClosing = await eventBudgetService.getEventClosing(eventId);
      if (dataClosing) {
        setClosing(dataClosing);
      }
      
      let dataItems = await eventBudgetService.getClosingItems(eventId);
      if (dataItems.length === 0) {
        // Init from planning
        const planningItems = await eventBudgetService.getPlanningItems(eventId);
        dataItems = planningItems.map(pi => ({
          event_id: eventId,
          planning_item_id: pi.id,
          item_name: pi.item_name,
          category: pi.category,
          quantity_taken: pi.planned_quantity,
          quantity_used: 0,
          quantity_returned: 0,
          quantity_lost_or_broken: 0,
          unit: pi.unit,
          unit_cost: pi.estimated_unit_cost,
          consumed_cost: 0,
          lost_cost: 0
        }));
      }
      setItems(dataItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Recalculate totals
  useEffect(() => {
    if (items.length === 0) return;
    const consumed = items.reduce((acc, curr) => acc + (curr.consumed_cost || 0), 0);
    const lost = items.reduce((acc, curr) => acc + (curr.lost_cost || 0), 0);
    
    // Simplification: total event cost = team + logistics + consumed + lost
    // (You might want to tweak this logic depending on exact business rules)
    const totalCost = (Number(closing.total_team_cost) || 0) + 
                      (Number(closing.total_logistics_cost) || 0) + 
                      consumed + lost;
                      
    const revenue = Number(closing.revenue_amount) || 0;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    setClosing(prev => ({
      ...prev,
      total_consumed_cost: consumed,
      total_lost_cost: lost,
      total_event_cost: totalCost,
      event_profit: profit,
      event_margin: margin
    }));
  }, [items, closing.total_team_cost, closing.total_logistics_cost, closing.revenue_amount]);

  async function handleSave() {
    setSaving(true);
    try {
      await eventBudgetService.upsertEventClosing(closing);
      if (items.length > 0) {
        await eventBudgetService.upsertClosingItems(items);
      }
      alert("Fechamento salvo com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar fechamento");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando fechamento...</div>;

  return (
    <div className="space-y-8">
      {/* HEADER E TOTAIS */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold font-display">Fechamento do Evento</h2>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl flex items-center gap-2 transition">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Fechamento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border border-border rounded-xl bg-surface">
          <p className="text-sm text-muted-foreground mb-1">Receita Total</p>
          <input type="number" className="text-xl font-bold bg-transparent outline-none w-full" value={closing.revenue_amount || ""} onChange={e => setClosing({...closing, revenue_amount: Number(e.target.value)})} placeholder="0,00" />
        </div>
        <div className="p-4 border border-border rounded-xl bg-surface">
          <p className="text-sm text-muted-foreground mb-1">Custo Total</p>
          <p className="text-xl font-bold text-red-500">{fmtBRL(closing.total_event_cost || 0)}</p>
        </div>
        <div className="p-4 border border-border rounded-xl bg-surface">
          <p className="text-sm text-muted-foreground mb-1">Lucro</p>
          <p className={`text-xl font-bold ${(closing.event_profit || 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtBRL(closing.event_profit || 0)}</p>
        </div>
        <div className="p-4 border border-border rounded-xl bg-surface">
          <p className="text-sm text-muted-foreground mb-1">Margem</p>
          <p className={`text-xl font-bold ${(closing.event_margin || 0) >= 30 ? "text-emerald-500" : "text-amber-500"}`}>{(closing.event_margin || 0).toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-border rounded-xl bg-surface">
           <label className="text-xs font-bold text-muted-foreground block mb-2">Custo de Equipe (R$)</label>
           <input type="number" className="w-full h-10 px-3 bg-input border border-border rounded-lg outline-none" value={closing.total_team_cost || ""} onChange={e => setClosing({...closing, total_team_cost: Number(e.target.value)})} />
        </div>
        <div className="p-4 border border-border rounded-xl bg-surface">
           <label className="text-xs font-bold text-muted-foreground block mb-2">Custo de Logística (R$)</label>
           <input type="number" className="w-full h-10 px-3 bg-input border border-border rounded-lg outline-none" value={closing.total_logistics_cost || ""} onChange={e => setClosing({...closing, total_logistics_cost: Number(e.target.value)})} />
        </div>
      </div>

      {/* ITEMS FECHAMENTO */}
      <div>
        <h3 className="font-bold mb-4">Uso de Insumos</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-primary/5 text-left border-b border-border">
              <tr>
                <th className="p-3 font-bold min-w-[150px]">Item</th>
                <th className="p-3 font-bold w-[90px]">Levado</th>
                <th className="p-3 font-bold w-[90px]">Usado</th>
                <th className="p-3 font-bold w-[90px]">Devolvido</th>
                <th className="p-3 font-bold w-[90px]">Perda/Quebra</th>
                <th className="p-3 font-bold w-[100px]">Custo Unit.</th>
                <th className="p-3 font-bold w-[100px]">Custo Consumo</th>
                <th className="p-3 font-bold w-[100px]">Custo Perda</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="p-2">{item.item_name}</td>
                  <td className="p-2 font-bold">{item.quantity_taken} {item.unit}</td>
                  <td className="p-2">
                    <input type="number" value={item.quantity_used} onChange={e => {
                      const v = Number(e.target.value);
                      const newItems = [...items];
                      newItems[idx].quantity_used = v;
                      newItems[idx].consumed_cost = v * newItems[idx].unit_cost;
                      setItems(newItems);
                    }} className="w-full bg-input outline-none p-1 rounded border border-border" />
                  </td>
                  <td className="p-2">
                    <input type="number" value={item.quantity_returned} onChange={e => {
                      const newItems = [...items];
                      newItems[idx].quantity_returned = Number(e.target.value);
                      setItems(newItems);
                    }} className="w-full bg-input outline-none p-1 rounded border border-border" />
                  </td>
                  <td className="p-2">
                    <input type="number" value={item.quantity_lost_or_broken} onChange={e => {
                      const v = Number(e.target.value);
                      const newItems = [...items];
                      newItems[idx].quantity_lost_or_broken = v;
                      newItems[idx].lost_cost = v * newItems[idx].unit_cost;
                      setItems(newItems);
                    }} className="w-full bg-input outline-none p-1 rounded border border-border text-red-500" />
                  </td>
                  <td className="p-2">{fmtBRL(item.unit_cost)}</td>
                  <td className="p-2 font-medium">{fmtBRL(item.consumed_cost)}</td>
                  <td className="p-2 font-medium text-red-500">{fmtBRL(item.lost_cost)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Nenhum item carregado. O fechamento requer que haja insumos planejados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* OBSERVACOES DE MELHORIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-2">Observações Gerais</label>
          <textarea className="w-full h-24 p-3 rounded-lg bg-input border border-border outline-none resize-none" value={closing.general_notes || ""} onChange={e => setClosing({...closing, general_notes: e.target.value})} placeholder="Resumo de como foi o evento..." />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-2">Pontos de Melhoria (Erros)</label>
          <textarea className="w-full h-24 p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 outline-none resize-none" value={closing.improvement_points || ""} onChange={e => setClosing({...closing, improvement_points: e.target.value})} placeholder="O que faltou? O que deu errado?..." />
        </div>
      </div>

    </div>
  );
}
