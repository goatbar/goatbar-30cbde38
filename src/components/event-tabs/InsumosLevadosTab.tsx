import React, { useEffect, useState } from "react";
import { eventBudgetService, type EventPlanningItem } from "@/services/event-budget-service";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL } from "@/lib/format";
import { Plus, Download, Trash2, Save, Loader2, Package, ChevronDown, ChevronUp, AlertCircle, HelpCircle } from "lucide-react";

const CATEGORIES = [
  { id: "Insumos", label: "Insumos Gerais", icon: "📦", color: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20" },
  { id: "Copos", label: "Copos (Tipos)", icon: "🍷", color: "from-pink-500/20 to-pink-600/5 text-pink-400 border-pink-500/20" },
  { id: "Bebidas", label: "Bebidas", icon: "🍾", color: "from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20" },
  { id: "Decoração", label: "Decoração", icon: "🌸", color: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20" },
  { id: "Mão de Obra", label: "Mão de Obra", icon: "👥", color: "from-teal-500/20 to-teal-600/5 text-teal-400 border-teal-500/20" },
  { id: "Frutas", label: "Frutas", icon: "🍓", color: "from-red-500/20 to-red-600/5 text-red-400 border-red-500/20" },
  { id: "Outros", label: "Outros", icon: "🏷️", color: "from-slate-500/20 to-slate-600/5 text-slate-400 border-slate-500/20" },
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
      packageInfo: { is_package: false, package_qty: 4, units_per_package: 100, package_price: 10, package_unit: "pacote" },
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
    packageInfo: { is_package: false, package_qty: 4, units_per_package: 100, package_price: 10, package_unit: "pacote" },
    userNotes: notes,
  };
}

function serializeNotes(packageInfo: PackageInfo, userNotes: string): string {
  if (!packageInfo.is_package) return userNotes;
  return JSON.stringify({
    ...packageInfo,
    original_notes: userNotes,
  });
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

export function InsumosLevadosTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<EventPlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedPackages, setExpandedPackages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadItems();
  }, [eventId]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await eventBudgetService.getPlanningItems(eventId);
      const normalizedData = data.map(item => ({
        ...item,
        category: normalizeCategory(item.category)
      }));
      setItems(normalizedData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function importFromOCR() {
    try {
      setLoading(true);
      const { data: expenses } = await (supabase as any).from("financial_expenses").select("id").eq("event_id", eventId);
      if (!expenses || expenses.length === 0) return alert("Nenhuma despesa vinculada a este evento.");

      const expenseIds = expenses.map((e: any) => e.id);
      const { data: expenseItems } = await (supabase as any).from("financial_expense_items").select("*").in("expense_id", expenseIds);
      if (!expenseItems || expenseItems.length === 0) return alert("Nenhum item encontrado nas notinhas deste evento.");

      const newItems = expenseItems.map(item => {
        const cat = normalizeCategory(item.suggested_category);
        return {
          event_id: eventId,
          source_expense_item_id: item.id,
          item_name: item.product_name,
          category: cat,
          planned_quantity: Number(item.quantity) || 1,
          unit: item.unit || "un",
          estimated_unit_cost: Number(item.unit_price) || 0,
          estimated_total_cost: Number(item.total_price) || 0,
          origin: "Comprado para evento",
          notes: "",
        };
      });

      const existingSourceIds = new Set(items.map(i => i.source_expense_item_id));
      const filteredNewItems = newItems.filter(n => !existingSourceIds.has(n.source_expense_item_id));

      if (filteredNewItems.length > 0) {
        const added = await eventBudgetService.addPlanningItems(filteredNewItems);
        const normalizedAdded = added.map(item => ({
          ...item,
          category: normalizeCategory(item.category)
        }));
        setItems(prev => [...prev, ...normalizedAdded]);
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
      for (const item of items) {
        if (item.id) {
          await eventBudgetService.updatePlanningItem(item.id, item);
        } else {
          await eventBudgetService.addPlanningItems([item]);
        }
      }
      await loadItems();
      alert("Planejamento de insumos salvo com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar o planejamento.");
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

  function handleAddItem(category: string) {
    const defaultUnit = category === "Mão de Obra" ? "diária" : category === "Frutas" ? "kg" : "un";
    const newItem: EventPlanningItem = {
      event_id: eventId,
      item_name: "",
      category: category,
      planned_quantity: 1,
      unit: defaultUnit,
      estimated_unit_cost: 0,
      estimated_total_cost: 0,
      notes: "",
    };
    setItems([...items, newItem]);
    // Expand the package settings automatically for a new item if it's Insumos or Copos
    setExpandedPackages(prev => ({
      ...prev,
      [items.length]: false
    }));
  }

  function updateItemPackage(idx: number, isPackage: boolean, packQty: number, unitsPerPack: number, packPrice: number, packUnit: string) {
    const newItems = [...items];
    const item = newItems[idx];
    const { userNotes } = parseNotes(item.notes);

    const packageInfo: PackageInfo = {
      is_package: isPackage,
      package_qty: packQty,
      units_per_package: unitsPerPack,
      package_price: packPrice,
      package_unit: packUnit
    };

    item.notes = serializeNotes(packageInfo, userNotes);

    if (isPackage) {
      item.planned_quantity = packQty * unitsPerPack;
      item.estimated_unit_cost = unitsPerPack > 0 ? packPrice / unitsPerPack : 0;
      item.estimated_total_cost = packQty * packPrice;
      item.unit = "un";
    } else {
      // Re-enable direct calculation
      item.estimated_total_cost = item.planned_quantity * item.estimated_unit_cost;
    }

    setItems(newItems);
  }

  function updateItemNotes(idx: number, text: string) {
    const newItems = [...items];
    const item = newItems[idx];
    const { packageInfo } = parseNotes(item.notes);
    item.notes = serializeNotes(packageInfo, text);
    setItems(newItems);
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando insumos...</div>;

  // Group items
  const groupedItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = items.filter(item => item.category === cat.id);
    return acc;
  }, {} as Record<string, EventPlanningItem[]>);

  // Global Total
  const globalTotal = items.reduce((acc, curr) => acc + (curr.estimated_total_cost || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Planejamento de Insumos Levados
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Planeje tudo que levará para o evento. Use a <strong>Compra em Pacote</strong> para calcular itens comprados em lote.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={importFromOCR} className="px-4 py-2.5 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 rounded-xl flex items-center gap-1.5 transition">
            <Download className="h-4 w-4" /> Importar das Notinhas
          </button>
          <button onClick={saveAll} disabled={saving} className="px-5 py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-primary/10">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Planejamento
          </button>
        </div>
      </div>

      {/* CARD DE RESUMO GERAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Custo Estimado Total</div>
          <div className="text-2xl font-bold font-display text-primary">{fmtBRL(globalTotal)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Total de Itens Planejados</div>
          <div className="text-2xl font-bold font-display">{items.length} itens</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-surface/50 p-3 rounded-xl border border-border/50">
          <AlertCircle className="h-4 w-4 text-primary shrink-0" />
          <span>Itens de <strong>Copos</strong> e <strong>Mão de Obra</strong> agora contam com espaços específicos para descrições.</span>
        </div>
      </div>

      {/* SEÇÕES DE CATEGORIA */}
      <div className="space-y-6">
        {CATEGORIES.map(cat => {
          const categoryItems = groupedItems[cat.id] || [];
          const categoryTotal = categoryItems.reduce((acc, curr) => acc + (curr.estimated_total_cost || 0), 0);
          
          return (
            <div key={cat.id} className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Category Header */}
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <h3 className="font-bold text-sm tracking-wide">{cat.label}</h3>
                    <p className="text-[10px] text-muted-foreground">{categoryItems.length} itens planejados</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase block font-bold tracking-wider">Subtotal</span>
                    <span className="font-bold text-sm text-primary">{fmtBRL(categoryTotal)}</span>
                  </div>
                  <button 
                    onClick={() => handleAddItem(cat.id)} 
                    className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors flex items-center gap-1 text-xs font-bold border border-border/80 hover:border-primary/20 bg-surface"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>
              </div>

              {/* Category Content */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-muted/10 border-b border-border/50 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <tr>
                      <th className="p-3 pl-5 min-w-[200px]">Item / Produto</th>
                      <th className="p-3 min-w-[200px]">Observações / Detalhes (Espaço Copa/Insumo)</th>
                      <th className="p-3 w-[120px]">Qtd. Levada</th>
                      <th className="p-3 w-[70px]">Unid.</th>
                      <th className="p-3 w-[120px]">Custo Unit.</th>
                      <th className="p-3 w-[120px]">Custo Total</th>
                      <th className="p-3 w-[100px] text-center">Configurações</th>
                      <th className="p-3 pr-5 w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.map((item) => {
                      // Find real index in global items list
                      const globalIdx = items.findIndex(i => i === item);
                      const { packageInfo, userNotes } = parseNotes(item.notes);
                      const isExpanded = expandedPackages[globalIdx] || false;

                      return (
                        <React.Fragment key={globalIdx}>
                          {/* MAIN ROW */}
                          <tr className={`border-b border-border/50 hover:bg-muted/5 transition-colors ${packageInfo.is_package ? 'bg-primary/[0.01]' : ''}`}>
                            {/* Product Name */}
                            <td className="p-3 pl-5">
                              <input 
                                type="text" 
                                value={item.item_name} 
                                onChange={e => {
                                  const newItems = [...items];
                                  newItems[globalIdx].item_name = e.target.value;
                                  setItems(newItems);
                                }} 
                                className="w-full bg-transparent outline-none py-1.5 px-2 rounded-lg border border-transparent hover:border-border hover:bg-input focus:bg-input focus:border-primary font-medium" 
                                placeholder={cat.id === "Copos" ? "Ex: Copo de Acrílico Personalizado" : "Ex: Nome do item"} 
                              />
                            </td>
                            {/* Notes/Details */}
                            <td className="p-3">
                              <input 
                                type="text" 
                                value={userNotes} 
                                onChange={e => updateItemNotes(globalIdx, e.target.value)} 
                                className="w-full bg-transparent outline-none py-1.5 px-2 rounded-lg border border-transparent hover:border-border hover:bg-input focus:bg-input focus:border-primary text-muted-foreground" 
                                placeholder={cat.id === "Copos" ? "Ex: 350ml, transparente com logo prata..." : "Observações adicionais..."} 
                              />
                            </td>
                            {/* Quantity */}
                            <td className="p-3 font-semibold">
                              {packageInfo.is_package ? (
                                <div className="space-y-1">
                                  <div className="text-xs font-bold text-primary">{item.planned_quantity} {item.unit}</div>
                                  <div className="text-[10px] text-muted-foreground bg-primary/10 inline-block px-1.5 py-0.5 rounded font-medium border border-primary/20">
                                    {packageInfo.package_qty} {packageInfo.package_unit}s x {packageInfo.units_per_package}
                                  </div>
                                </div>
                              ) : (
                                <input 
                                  type="number" 
                                  value={item.planned_quantity} 
                                  onChange={e => {
                                    const newItems = [...items];
                                    newItems[globalIdx].planned_quantity = Number(e.target.value);
                                    newItems[globalIdx].estimated_total_cost = newItems[globalIdx].planned_quantity * newItems[globalIdx].estimated_unit_cost;
                                    setItems(newItems);
                                  }} 
                                  className="w-20 bg-transparent outline-none py-1 px-2 rounded border border-border/80 focus:border-primary text-foreground" 
                                />
                              )}
                            </td>
                            {/* Unit */}
                            <td className="p-3">
                              <input 
                                type="text" 
                                value={item.unit || ""} 
                                disabled={packageInfo.is_package}
                                onChange={e => {
                                  const newItems = [...items];
                                  newItems[globalIdx].unit = e.target.value;
                                  setItems(newItems);
                                }} 
                                className="w-12 bg-transparent outline-none py-1 px-1.5 rounded border border-border/80 focus:border-primary text-center disabled:opacity-50" 
                                placeholder="un" 
                              />
                            </td>
                            {/* Unit Cost */}
                            <td className="p-3">
                              {packageInfo.is_package ? (
                                <div className="space-y-1">
                                  <div className="font-bold">{fmtBRL(item.estimated_unit_cost)}</div>
                                  <div className="text-[9px] text-muted-foreground">
                                    {fmtBRL(packageInfo.package_price)} / {packageInfo.package_unit}
                                  </div>
                                </div>
                              ) : (
                                <input 
                                  type="number" 
                                  value={item.estimated_unit_cost} 
                                  step="0.01"
                                  onChange={e => {
                                    const newItems = [...items];
                                    newItems[globalIdx].estimated_unit_cost = Number(e.target.value);
                                    newItems[globalIdx].estimated_total_cost = newItems[globalIdx].planned_quantity * newItems[globalIdx].estimated_unit_cost;
                                    setItems(newItems);
                                  }} 
                                  className="w-24 bg-transparent outline-none py-1 px-2 rounded border border-border/80 focus:border-primary" 
                                />
                              )}
                            </td>
                            {/* Total Cost */}
                            <td className="p-3 font-bold text-foreground">
                              {fmtBRL(item.estimated_total_cost)}
                            </td>
                            {/* Config button */}
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => setExpandedPackages(prev => ({ ...prev, [globalIdx]: !isExpanded }))}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1.5 transition-all ${
                                  packageInfo.is_package 
                                    ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" 
                                    : "border-border bg-surface text-muted-foreground hover:text-foreground hover:border-border-strong"
                                }`}
                              >
                                <Package className="h-3 w-3" /> 
                                {packageInfo.is_package ? "Lote: Ativo" : "Config. Lote"}
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            </td>
                            {/* Action Trash */}
                            <td className="p-3 pr-5 text-center">
                              <button onClick={() => removeItem(item.id, globalIdx)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDED PACKAGE INFO ACCORDION */}
                          {isExpanded && (
                            <tr className="bg-primary/[0.02] border-b border-border/50">
                              <td colSpan={8} className="p-4 pl-8">
                                <div className="bg-surface rounded-xl border border-primary/20 p-4 shadow-sm space-y-4 max-w-3xl">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Package className="h-4 w-4 text-primary" />
                                      <h4 className="font-bold text-xs">Configurador de Compra em Lote / Pacote</h4>
                                    </div>
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Habilitar cálculo por lote</span>
                                      <input 
                                        type="checkbox" 
                                        checked={packageInfo.is_package} 
                                        onChange={e => {
                                          updateItemPackage(
                                            globalIdx, 
                                            e.target.checked, 
                                            packageInfo.package_qty, 
                                            packageInfo.units_per_package, 
                                            packageInfo.package_price, 
                                            packageInfo.package_unit
                                          );
                                        }}
                                        className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary focus:ring-1"
                                      />
                                    </label>
                                  </div>

                                  {packageInfo.is_package ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Quantidade de Pacotes</label>
                                        <input 
                                          type="number" 
                                          min="1"
                                          value={packageInfo.package_qty} 
                                          onChange={e => updateItemPackage(globalIdx, true, Number(e.target.value), packageInfo.units_per_package, packageInfo.package_price, packageInfo.package_unit)}
                                          className="w-full h-8 px-2.5 bg-input border border-border rounded-lg outline-none focus:border-primary text-xs" 
                                          placeholder="Ex: 4"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Unid. do Pacote</label>
                                        <input 
                                          type="text" 
                                          value={packageInfo.package_unit} 
                                          onChange={e => updateItemPackage(globalIdx, true, packageInfo.package_qty, packageInfo.units_per_package, packageInfo.package_price, e.target.value)}
                                          className="w-full h-8 px-2.5 bg-input border border-border rounded-lg outline-none focus:border-primary text-xs text-center" 
                                          placeholder="Ex: pacote, caixa, fardo"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Itens por Pacote</label>
                                        <input 
                                          type="number" 
                                          min="1"
                                          value={packageInfo.units_per_package} 
                                          onChange={e => updateItemPackage(globalIdx, true, packageInfo.package_qty, Number(e.target.value), packageInfo.package_price, packageInfo.package_unit)}
                                          className="w-full h-8 px-2.5 bg-input border border-border rounded-lg outline-none focus:border-primary text-xs" 
                                          placeholder="Ex: 100"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase">Custo por Pacote (R$)</label>
                                        <input 
                                          type="number" 
                                          min="0"
                                          step="0.01"
                                          value={packageInfo.package_price} 
                                          onChange={e => updateItemPackage(globalIdx, true, packageInfo.package_qty, packageInfo.units_per_package, Number(e.target.value), packageInfo.package_unit)}
                                          className="w-full h-8 px-2.5 bg-input border border-border rounded-lg outline-none focus:border-primary text-xs" 
                                          placeholder="Ex: 10.00"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-dashed border-border flex items-center gap-2">
                                      <HelpCircle className="h-4 w-4 text-muted-foreground/60" />
                                      <span>Este item está configurado como <strong>Compra Unitária Direta</strong>. Habilite o lote acima para calcular as quantidades com base em pacotes ou fardos e obter maior exatidão no fechamento.</span>
                                    </div>
                                  )}

                                  {packageInfo.is_package && (
                                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-3 text-xs text-primary font-medium flex items-center justify-between">
                                      <span>Cálculo do Lote:</span>
                                      <div className="flex gap-4">
                                        <span>Total: <strong className="font-bold">{packageInfo.package_qty * packageInfo.units_per_package} canudos</strong></span>
                                        <span>Custo Unitário real: <strong className="font-bold">{fmtBRL(packageInfo.units_per_package > 0 ? packageInfo.package_price / packageInfo.units_per_package : 0)}/un</strong></span>
                                        <span>Investimento total: <strong className="font-bold">{fmtBRL(packageInfo.package_qty * packageInfo.package_price)}</strong></span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {categoryItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground/60 italic">
                          Nenhum planejado nesta categoria. Clique em "+ Adicionar" acima para começar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

