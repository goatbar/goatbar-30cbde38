import React, { useEffect, useState } from "react";
import { eventBudgetService, type EventPlanningItem } from "@/services/event-budget-service";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/lib/format";
import { Plus, Download, Trash2, Save, Loader2 } from "lucide-react";

export function InsumosLevadosTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<EventPlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadItems();
  }, [eventId]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await eventBudgetService.getPlanningItems(eventId);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function importFromOCR() {
    try {
      setLoading(true);
      // 1. Fetch all expenses for this event
      const { data: expenses } = await supabase.from("financial_expenses").select("id").eq("event_id", eventId);
      if (!expenses || expenses.length === 0) return alert("Nenhuma despesa vinculada a este evento.");

      const expenseIds = expenses.map(e => e.id);
      
      // 2. Fetch all items from those expenses
      const { data: expenseItems } = await supabase.from("financial_expense_items").select("*").in("expense_id", expenseIds);
      if (!expenseItems || expenseItems.length === 0) return alert("Nenhum item encontrado nas notinhas deste evento.");

      // 3. Map to Planning Items
      const newItems = expenseItems.map(item => ({
        event_id: eventId,
        source_expense_item_id: item.id,
        item_name: item.product_name,
        category: item.suggested_category || "Outros",
        planned_quantity: item.quantity,
        unit: item.unit,
        estimated_unit_cost: item.unit_price || 0,
        estimated_total_cost: item.total_price || 0,
        origin: "Comprado para evento",
      }));

      // Append new items (filtering out duplicates based on source_expense_item_id if needed)
      const existingSourceIds = new Set(items.map(i => i.source_expense_item_id));
      const filteredNewItems = newItems.filter(n => !existingSourceIds.has(n.source_expense_item_id));

      if (filteredNewItems.length > 0) {
        const added = await eventBudgetService.addPlanningItems(filteredNewItems);
        setItems(prev => [...prev, ...added]);
      } else {
        alert("Todos os itens das notinhas já foram importados.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      // In a real scenario we'd do an upsert or individual updates.
      for (const item of items) {
        if (item.id) {
          await eventBudgetService.updatePlanningItem(item.id, item);
        } else {
          await eventBudgetService.addPlanningItems([item]);
        }
      }
      await loadItems();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id?: string, index?: number) {
    if (id) {
      await eventBudgetService.deletePlanningItem(id);
      setItems(items.filter(i => i.id !== id));
    } else if (index !== undefined) {
      setItems(items.filter((_, i) => i !== index));
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando insumos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold font-display">Insumos Levados (Planejamento)</h2>
        <div className="flex gap-3">
          <button onClick={importFromOCR} className="px-4 py-2 text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl flex items-center gap-2 transition">
            <Download className="h-4 w-4" /> Importar de Notinhas
          </button>
          <button onClick={() => setItems([...items, { event_id: eventId, item_name: "", category: "Insumos", planned_quantity: 1, unit: "un", estimated_unit_cost: 0, estimated_total_cost: 0 }])} className="px-4 py-2 text-sm font-bold border border-border hover:bg-surface rounded-xl flex items-center gap-2 transition">
            <Plus className="h-4 w-4" /> Adicionar Manual
          </button>
          <button onClick={saveAll} disabled={saving} className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl flex items-center gap-2 transition">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Planejamento
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left border-b border-border">
            <tr>
              <th className="p-3 font-bold min-w-[200px]">Item / Produto</th>
              <th className="p-3 font-bold w-[120px]">Categoria</th>
              <th className="p-3 font-bold w-[100px]">Qtd. Levada</th>
              <th className="p-3 font-bold w-[80px]">Unid.</th>
              <th className="p-3 font-bold w-[120px]">Custo Unit.</th>
              <th className="p-3 font-bold w-[120px]">Custo Total</th>
              <th className="p-3 font-bold w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="border-b border-border/50">
                <td className="p-2">
                  <input type="text" value={item.item_name} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].item_name = e.target.value;
                    setItems(newItems);
                  }} className="w-full bg-transparent outline-none p-1 rounded hover:bg-surface focus:bg-surface" placeholder="Nome do item" />
                </td>
                <td className="p-2">
                  <select value={item.category} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].category = e.target.value;
                    setItems(newItems);
                  }} className="w-full bg-transparent outline-none p-1 rounded hover:bg-surface focus:bg-surface">
                    <option value="Insumos">Insumos</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Descartáveis">Descartáveis</option>
                    <option value="Outros">Outros</option>
                  </select>
                </td>
                <td className="p-2">
                  <input type="number" value={item.planned_quantity} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].planned_quantity = Number(e.target.value);
                    newItems[idx].estimated_total_cost = newItems[idx].planned_quantity * newItems[idx].estimated_unit_cost;
                    setItems(newItems);
                  }} className="w-full bg-transparent outline-none p-1 rounded hover:bg-surface focus:bg-surface" />
                </td>
                <td className="p-2">
                  <input type="text" value={item.unit || ""} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].unit = e.target.value;
                    setItems(newItems);
                  }} className="w-full bg-transparent outline-none p-1 rounded hover:bg-surface focus:bg-surface" placeholder="un" />
                </td>
                <td className="p-2">
                  <input type="number" value={item.estimated_unit_cost} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].estimated_unit_cost = Number(e.target.value);
                    newItems[idx].estimated_total_cost = newItems[idx].planned_quantity * newItems[idx].estimated_unit_cost;
                    setItems(newItems);
                  }} className="w-full bg-transparent outline-none p-1 rounded hover:bg-surface focus:bg-surface" />
                </td>
                <td className="p-2 font-bold text-primary">
                  {fmtBRL(item.estimated_total_cost)}
                </td>
                <td className="p-2 text-center">
                  <button onClick={() => removeItem(item.id, idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Nenhum insumo planejado ainda. Adicione manualmente ou importe das notinhas deste evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
