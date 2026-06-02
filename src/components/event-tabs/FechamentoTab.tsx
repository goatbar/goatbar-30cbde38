import React, { useEffect, useState } from "react";
import { eventBudgetService, type EventClosing, type EventClosingItem } from "@/services/event-budget-service";
import { fmtBRL } from "@/lib/format";
import { Save, Loader2, CheckCircle2, AlertTriangle, ArrowRight, HelpCircle, Landmark, ShoppingBag, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

const CATEGORIES = [
  { id: "Insumos", label: "Insumos Gerais", icon: "📦", bg: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  { id: "Copos", label: "Copos (Tipos)", icon: "🍷", bg: "bg-pink-500/10 border-pink-500/20 text-pink-400" },
  { id: "Bebidas", label: "Bebidas", icon: "🍾", bg: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
  { id: "Decoração", label: "Decoração", icon: "🌸", bg: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
  { id: "Mão de Obra", label: "Mão de Obra", icon: "👥", bg: "bg-teal-500/10 border-teal-500/20 text-teal-400" },
  { id: "Frutas", label: "Frutas", icon: "🍓", bg: "bg-red-500/10 border-red-500/20 text-red-400" },
  { id: "Outros", label: "Outros", icon: "🏷️", bg: "bg-slate-500/10 border-slate-500/20 text-slate-400" },
];

interface PackageInfo {
  is_package: boolean;
  package_qty: number;
  units_per_package: number;
  package_price: number;
  package_unit: string;
}

function parseNotes(notes: string | undefined): { packageInfo: PackageInfo; userNotes: string } {
  if (!notes) {
    return {
      packageInfo: { is_package: false, package_qty: 1, units_per_package: 1, package_price: 0, package_unit: "pacote" },
      userNotes: "",
    };
  }
  try {
    if (notes.startsWith("{") && notes.endsWith("}")) {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === "object" && "is_package" in parsed) {
        return {
          packageInfo: {
            is_package: !!parsed.is_package,
            package_qty: Number(parsed.package_qty) || 1,
            units_per_package: Number(parsed.units_per_package) || 1,
            package_price: Number(parsed.package_price) || 0,
            package_unit: parsed.package_unit || "pacote",
          },
          userNotes: parsed.original_notes || "",
        };
      }
    }
  } catch (e) {}
  return {
    packageInfo: { is_package: false, package_qty: 1, units_per_package: 1, package_price: 0, package_unit: "pacote" },
    userNotes: notes,
  };
}

function normalizeCategory(cat?: string): string {
  if (!cat) return "Outros";
  if (cat === "Descartáveis" || cat === "Insumos") return "Insumos";
  if (cat === "Bebidas") return "Bebidas";
  if (cat === "Alimentação") return "Outros";
  if (cat === "Copos") return "Copos";
  if (cat === "Decoração" || cat === "Decoracao") return "Decoração";
  if (cat === "Mão de Obra" || cat === "Mao de Obra" || cat === "Mão de obra") return "Mão de Obra";
  if (cat === "Frutas") return "Frutas";
  return cat;
}

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
          category: normalizeCategory(pi.category),
          quantity_taken: pi.planned_quantity,
          quantity_used: 0,
          quantity_returned: pi.planned_quantity, // Initial state: everything returned until noted otherwise
          quantity_lost_or_broken: 0,
          unit: pi.unit || "un",
          unit_cost: pi.estimated_unit_cost,
          consumed_cost: 0,
          lost_cost: 0,
          notes: pi.notes // Copy notes where JSON packageInfo lives
        }));
      } else {
        // Normalize categories for loaded items too
        dataItems = dataItems.map(item => ({
          ...item,
          category: normalizeCategory(item.category)
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
    const purchaseTotal = items.reduce((acc, curr) => acc + (curr.quantity_taken * curr.unit_cost), 0);
    
    // Total Event Cost = team + logistics + consumed + lost
    const totalCost = (Number(closing.total_team_cost) || 0) + 
                      (Number(closing.total_logistics_cost) || 0) + 
                      consumed + lost;
                      
    const revenue = Number(closing.revenue_amount) || 0;
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    setClosing(prev => ({
      ...prev,
      total_purchase_cost: purchaseTotal,
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
      await eventBudgetService.upsertEventClosing({
        ...closing,
        status: "Fechado"
      });
      if (items.length > 0) {
        await eventBudgetService.upsertClosingItems(items);
      }
      alert("Fechamento salvo e concluído com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar fechamento");
    } finally {
      setSaving(false);
    }
  }

  // Balancing logic for quantities
  function updateItemQuantities(idx: number, field: "used" | "returned" | "lost", value: number) {
    const newItems = [...items];
    const item = newItems[idx];
    const taken = item.quantity_taken;

    if (field === "used") {
      item.quantity_used = value;
      const rem = taken - value;
      if (rem >= item.quantity_lost_or_broken) {
        item.quantity_returned = rem - item.quantity_lost_or_broken;
      } else {
        item.quantity_lost_or_broken = Math.max(0, rem);
        item.quantity_returned = 0;
      }
    } else if (field === "returned") {
      item.quantity_returned = value;
      const rem = taken - item.quantity_used - value;
      item.quantity_lost_or_broken = Math.max(0, rem);
    } else if (field === "lost") {
      item.quantity_lost_or_broken = value;
      const rem = taken - item.quantity_used - value;
      item.quantity_returned = Math.max(0, rem);
    }

    // Recalculate costs
    item.consumed_cost = item.quantity_used * item.unit_cost;
    item.lost_cost = item.quantity_lost_or_broken * item.unit_cost;

    setItems(newItems);
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando fechamento...</div>;

  // Group items by category
  const groupedItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = items.filter(item => item.category === cat.id);
    return acc;
  }, {} as Record<string, EventClosingItem[]>);

  // Find all items that are packaged buys for explanation purposes
  const packagedItems = items.filter(item => {
    const { packageInfo } = parseNotes(item.notes);
    return packageInfo.is_package;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER PRINCIPAL */}
      <div className="flex justify-between items-center bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Fechamento do Evento
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Lance os dados reais consumidos. O sistema calcula a diferença e os custos reais de operação.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl flex items-center gap-2 transition shadow-lg shadow-primary/10">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Concluir Fechamento
        </button>
      </div>

      {/* METRICAS PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 border border-border rounded-2xl bg-surface shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Receita Realizada</p>
          <div className="flex items-center gap-1.5 bg-input px-3 py-1.5 rounded-xl border border-border mt-1">
            <span className="text-xs text-muted-foreground font-bold">R$</span>
            <input type="number" className="text-lg font-bold bg-transparent outline-none w-full text-foreground" value={closing.revenue_amount || ""} onChange={e => setClosing({...closing, revenue_amount: Number(e.target.value)})} placeholder="0,00" />
          </div>
        </div>
        <div className="p-5 border border-border rounded-2xl bg-surface shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Custo Real Final</p>
            <p className="text-xl font-bold text-red-500 mt-2">{fmtBRL(closing.total_event_cost || 0)}</p>
          </div>
          <div className="text-[9px] text-muted-foreground/80 mt-1">
            Soma: Equipe + Logística + Consumo + Perdas
          </div>
        </div>
        <div className="p-5 border border-border rounded-2xl bg-surface shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Lucro Realizado</p>
          <p className={`text-xl font-bold mt-2.5 ${(closing.event_profit || 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>{fmtBRL(closing.event_profit || 0)}</p>
          <div className="text-[9px] text-muted-foreground/80 mt-1">
            Faturamento menos Custo Real
          </div>
        </div>
        <div className="p-5 border border-border rounded-2xl bg-surface shadow-sm">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Margem Realizada</p>
          <p className={`text-xl font-bold mt-2.5 ${(closing.event_margin || 0) >= 30 ? "text-emerald-500" : "text-amber-500"}`}>{(closing.event_margin || 0).toFixed(1)}%</p>
          <div className="text-[9px] text-muted-foreground/80 mt-1">
            Meta operacional: 35%
          </div>
        </div>
      </div>

      {/* CUSTOS ADICIONAIS OPERACIONAIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 p-5 rounded-2xl border border-border">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Custo Real de Equipe (Mão de Obra Adicional - R$)</label>
          <input type="number" className="w-full h-10 px-3 bg-surface border border-border rounded-xl outline-none focus:border-primary text-sm font-medium mt-1.5" value={closing.total_team_cost || ""} onChange={e => setClosing({...closing, total_team_cost: Number(e.target.value)})} placeholder="Ex: Diárias extras, transportes equipe" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Custo de Logística Real (Combustível / Frete - R$)</label>
          <input type="number" className="w-full h-10 px-3 bg-surface border border-border rounded-xl outline-none focus:border-primary text-sm font-medium mt-1.5" value={closing.total_logistics_cost || ""} onChange={e => setClosing({...closing, total_logistics_cost: Number(e.target.value)})} placeholder="Ex: Gelo, Frete estrutural, combustível" />
        </div>
      </div>

      {/* PAINEL EXPLICATIVO DE COMPRA EM PACIENTES / LOTES */}
      {packagedItems.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
            <h4 className="font-bold text-sm text-primary">Detalhamento Financeiro Inteligente (Lotes e Sobras)</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Identificamos insumos comprados em pacote/lote no planejamento. O fechamento calculou a parte proporcional que foi de fato gasta no evento, e a parte que retorna para o seu estoque (economizada), reduzindo o seu custo real:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {packagedItems.map((item, idx) => {
              const { packageInfo, userNotes } = parseNotes(item.notes);
              const initialCost = item.quantity_taken * item.unit_cost;
              const savedCost = item.quantity_returned * item.unit_cost;
              const consumedCost = item.consumed_cost;
              const lostCost = item.lost_cost;
              
              return (
                <div key={idx} className="bg-surface p-4 rounded-xl border border-border/80 flex flex-col justify-between space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-xs font-bold block">{item.item_name}</strong>
                      <span className="text-[10px] text-muted-foreground font-medium block">
                        Lote: {packageInfo.package_qty} pct x {packageInfo.units_per_package} = {item.quantity_taken} canudos a {fmtBRL(packageInfo.package_price)}/pct
                      </span>
                    </div>
                    <span className="text-[10px] bg-primary/15 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold uppercase">
                      Lote Ativo
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-b border-border/50 py-3 text-center">
                    <div>
                      <span className="text-[8px] text-muted-foreground uppercase font-bold block">1. Custo Total Compra</span>
                      <span className="text-xs font-bold text-slate-500">{fmtBRL(initialCost)}</span>
                    </div>
                    <div className="border-l border-r border-border/50">
                      <span className="text-[8px] text-primary uppercase font-bold block">2. Gasto Real Evento</span>
                      <span className="text-xs font-extrabold text-primary">{fmtBRL(consumedCost)}</span>
                      <span className="text-[8px] text-muted-foreground block font-medium">{item.quantity_used} un gasta</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-emerald-500 uppercase font-bold block">3. Retorno ao Estoque</span>
                      <span className="text-xs font-bold text-emerald-500">{fmtBRL(savedCost)}</span>
                      <span className="text-[8px] text-muted-foreground block font-medium">{item.quantity_returned} un salva</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground italic flex gap-1.5 items-center">
                    <HelpCircle className="h-3.5 w-3.5 text-primary" />
                    <span>
                      Sua compra de <strong>{fmtBRL(initialCost)}</strong> gerou um custo real de <strong>{fmtBRL(consumedCost)}</strong> neste evento. A economia de <strong>{fmtBRL(savedCost)}</strong> foi salva no estoque.
                      {lostCost > 0 && <span className="text-red-500 font-bold block mt-1">Aviso: R$ {fmtBRL(lostCost)} foram perdidos em {item.quantity_lost_or_broken} unidades quebras/perdas.</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* USO DE INSUMOS DETALHADO POR CATEGORIAS */}
      <div className="space-y-6">
        <h3 className="font-bold text-sm font-display flex items-center gap-1.5">
          <ShoppingBag className="h-4.5 w-4.5 text-primary" /> Uso de Insumos Planejados por Categoria
        </h3>

        {CATEGORIES.map(cat => {
          const categoryItems = groupedItems[cat.id] || [];
          if (categoryItems.length === 0) return null;

          const catInitial = categoryItems.reduce((acc, curr) => acc + (curr.quantity_taken * curr.unit_cost), 0);
          const catConsumed = categoryItems.reduce((acc, curr) => acc + (curr.consumed_cost || 0), 0);
          const catLost = categoryItems.reduce((acc, curr) => acc + (curr.lost_cost || 0), 0);
          const catReturned = categoryItems.reduce((acc, curr) => acc + (curr.quantity_returned * curr.unit_cost), 0);

          return (
            <div key={cat.id} className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Category Subheader */}
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <h4 className="font-bold text-xs tracking-wide">{cat.label}</h4>
                    <p className="text-[9px] text-muted-foreground">{categoryItems.length} insumos levados</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-6 text-right">
                  <div>
                    <span className="text-[8px] text-muted-foreground uppercase font-bold block">1. Levado</span>
                    <span className="font-bold text-xs text-slate-500">{fmtBRL(catInitial)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-primary uppercase font-bold block">2. Gasto Real</span>
                    <span className="font-bold text-xs text-primary">{fmtBRL(catConsumed)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-emerald-500 uppercase font-bold block">3. Estoque</span>
                    <span className="font-bold text-xs text-emerald-500">{fmtBRL(catReturned)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-red-500 uppercase font-bold block">4. Perdas</span>
                    <span className="font-bold text-xs text-red-500">{fmtBRL(catLost)}</span>
                  </div>
                </div>
              </div>

              {/* Table of items */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/10 border-b border-border/50 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <tr>
                      <th className="p-3 pl-5 min-w-[150px]">Item / Produto</th>
                      <th className="p-3 min-w-[150px]">Observações / Detalhes</th>
                      <th className="p-3 w-[120px]">1. Qtd Levada</th>
                      <th className="p-3 w-[110px]">2. Qtd Usada (Real)</th>
                      <th className="p-3 w-[110px]">3. Qtd Retornada</th>
                      <th className="p-3 w-[110px]">4. Perda / Quebra</th>
                      <th className="p-3 w-[100px]">Custo Unit.</th>
                      <th className="p-3 w-[100px] text-primary">Custo Consumo</th>
                      <th className="p-3 pr-5 w-[100px] text-red-500">Custo Perda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.map((item) => {
                      const globalIdx = items.findIndex(i => i === item);
                      const { packageInfo, userNotes } = parseNotes(item.notes);

                      return (
                        <tr key={globalIdx} className={`border-b border-border/50 hover:bg-muted/5 transition-colors ${packageInfo.is_package ? 'bg-primary/[0.01]' : ''}`}>
                          {/* Item Name */}
                          <td className="p-3 pl-5 font-semibold">
                            {item.item_name}
                            {packageInfo.is_package && (
                              <div className="text-[9px] text-primary font-bold flex items-center gap-1.5 mt-0.5">
                                <ShoppingBag className="h-2.5 w-2.5" /> Compra em Pacote
                              </div>
                            )}
                          </td>
                          {/* Notes */}
                          <td className="p-3 text-muted-foreground italic text-[11px] max-w-[200px] truncate" title={userNotes}>
                            {userNotes || "--"}
                          </td>
                          {/* Taken */}
                          <td className="p-3">
                            <span className="font-medium bg-muted px-2 py-0.5 rounded border border-border/50 text-slate-500">
                              {item.quantity_taken} {item.unit}
                            </span>
                          </td>
                          {/* Used */}
                          <td className="p-3">
                            <div className="flex items-center rounded-lg bg-input border border-border focus-within:border-primary px-1.5 py-0.5">
                              <input type="number" min="0" max={item.quantity_taken} value={item.quantity_used} onChange={e => updateItemQuantities(globalIdx, "used", Number(e.target.value))} className="w-14 bg-transparent outline-none py-1 px-1 font-bold text-center" />
                              <span className="text-[9px] text-muted-foreground uppercase border-l border-border pl-1.5 font-bold ml-1">{item.unit}</span>
                            </div>
                          </td>
                          {/* Returned */}
                          <td className="p-3">
                            <div className="flex items-center rounded-lg bg-input border border-border focus-within:border-primary px-1.5 py-0.5">
                              <input type="number" min="0" max={item.quantity_taken} value={item.quantity_returned} onChange={e => updateItemQuantities(globalIdx, "returned", Number(e.target.value))} className="w-14 bg-transparent outline-none py-1 px-1 font-bold text-center text-emerald-500" />
                              <span className="text-[9px] text-muted-foreground uppercase border-l border-border pl-1.5 font-bold ml-1">{item.unit}</span>
                            </div>
                          </td>
                          {/* Lost */}
                          <td className="p-3">
                            <div className="flex items-center rounded-lg bg-input border border-border focus-within:border-primary px-1.5 py-0.5">
                              <input type="number" min="0" max={item.quantity_taken} value={item.quantity_lost_or_broken} onChange={e => updateItemQuantities(globalIdx, "lost", Number(e.target.value))} className="w-14 bg-transparent outline-none py-1 px-1 font-bold text-center text-red-500" />
                              <span className="text-[9px] text-muted-foreground uppercase border-l border-border pl-1.5 font-bold ml-1">{item.unit}</span>
                            </div>
                          </td>
                          {/* Unit Cost */}
                          <td className="p-3 font-medium text-slate-500">
                            {fmtBRL(item.unit_cost)}
                          </td>
                          {/* Consumed Cost */}
                          <td className="p-3 font-bold text-primary">
                            {fmtBRL(item.consumed_cost)}
                          </td>
                          {/* Lost Cost */}
                          <td className="p-3 pr-5 font-bold text-red-500">
                            {fmtBRL(item.lost_cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="p-10 text-center border-2 border-dashed border-border rounded-2xl bg-surface/50 text-muted-foreground italic">
            Nenhum insumo ou item planejado na aba de planejamento para este evento. O fechamento requer que haja insumos planejados previamente na aba "Insumos Levados".
          </div>
        )}
      </div>

      {/* OBSERVACOES E PONTOS DE MELHORIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Observações Gerais da Operação</label>
          <textarea className="w-full h-28 p-3.5 rounded-xl bg-input border border-border outline-none resize-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium mt-2" value={closing.general_notes || ""} onChange={e => setClosing({...closing, general_notes: e.target.value})} placeholder="Escreva os principais destaques, aprendizados e notas sobre a entrega do evento..." />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-2">
          <label className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">Pontos de Atenção ou Falhas (Erros Operacionais)</label>
          <textarea className="w-full h-28 p-3.5 rounded-xl bg-red-500/[0.02] border border-red-500/20 text-red-950 dark:text-red-200 outline-none resize-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm font-medium mt-2" value={closing.improvement_points || ""} onChange={e => setClosing({...closing, improvement_points: e.target.value})} placeholder="Escreva o que faltou, quebras fora do padrão, atrasos de equipe ou erros a serem corrigidos no próximo..." />
        </div>
      </div>
    </div>
  );
}

