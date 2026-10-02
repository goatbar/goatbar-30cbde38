import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { migrateLegacyStoreToSupabase } from "@/lib/migration";
import { Package, Plus, Search, Edit2, Trash2, X, ArrowRightLeft, Loader2 } from "lucide-react";
import { financialService, type FinancialModality } from "@/services/financial-service";

export const Route = createFileRoute("/inventario")({
  component: () => (
    <AppShell>
      <InventoryPage />
    </AppShell>
  ),
});

function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [allocationItem, setAllocationItem] = useState<any | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationForm, setAllocationForm] = useState<{
    quantity: number;
    modality: FinancialModality;
    event_id: string;
    notes: string;
  }>({ quantity: 1, modality: "7 Steak House", event_id: "", notes: "" });

  const [formNome, setFormNome] = useState("");
  const [formQtd, setFormQtd] = useState(0);
  const [formObs, setFormObs] = useState("");

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const { data, error } = await supabase
          .from("inventory")
          .select("id, name, category, quantity, unit, cost_per_unit, updated_at")
          .order("updated_at", { ascending: false });
        if (error) throw error;

        if (data) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            nome: item.name ?? "Item",
            quantidadeTotal: Number(item.quantity ?? 0),
            observacoes: "",
            categoria: item.category ?? "Outros",
            unidade: item.unit ?? "un",
            custoUnitario: Number(item.cost_per_unit ?? 0),
          }));
          setInventoryItems(mapped);
        }

        const { data: eventsData, error: eventsError } = await (supabase as any)
          .from("events")
          .select("id, client_name, event_name, date, status")
          .order("date", { ascending: false });
        if (eventsError) throw eventsError;
        setEventsList((eventsData || []).filter((ev: any) =>
          ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(String(ev.status || "").toUpperCase())
        ));
      } catch (e) {
        console.error("Falha ao carregar inventário do Supabase.", {
          table: "inventory",
          query: "select id,name,quantity,updated_at order by updated_at",
          error: e,
        });
      }
    };

    migrateLegacyStoreToSupabase().finally(loadInventory);
  }, []);

  const filteredItems = inventoryItems.filter((i) =>
    i.nome.toLowerCase().includes(search.toLowerCase()),
  );

  const handleEdit = (item: (typeof inventoryItems)[0]) => {
    setEditingId(item.id);
    setFormNome(item.nome);
    setFormQtd(item.quantidadeTotal);
    setFormObs(item.observacoes);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formNome.trim()) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from("inventory")
          .update({ name: formNome, quantity: formQtd, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        setInventoryItems((prev) =>
          prev.map((i) =>
            i.id === editingId
              ? { ...i, nome: formNome, quantidadeTotal: formQtd, observacoes: formObs }
              : i,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("inventory")
          // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
          .insert({ name: formNome, quantity: formQtd })
          .select("id")
          .single();
        if (error) throw error;
        setInventoryItems((prev) => [
          { id: data.id, nome: formNome, quantidadeTotal: formQtd, observacoes: formObs },
          ...prev,
        ]);
      }
    } catch (e) {
      console.error("Erro ao salvar item no Supabase.", {
        table: "inventory",
        payload: { id: editingId, formNome, formQtd, formObs },
        error: e,
      });
      alert("Erro ao salvar item. Verifique conexão/Supabase e tente novamente.");
      return;
    }

    setShowModal(false);
  };

  const openAllocation = (item: any) => {
    setAllocationItem(item);
    setAllocationForm({ quantity: 1, modality: "7 Steak House", event_id: "", notes: "" });
  };

  const handleAllocate = async () => {
    if (!allocationItem) return;
    if (allocationForm.quantity <= 0) return alert("Informe uma quantidade válida.");
    if (allocationForm.quantity > Number(allocationItem.quantidadeTotal || 0)) {
      return alert("A quantidade é maior que o saldo disponível em estoque.");
    }
    if ((allocationForm.modality === "Evento" || allocationForm.modality === "Degustação") && !allocationForm.event_id) {
      return alert("Selecione o evento relacionado.");
    }

    setAllocationLoading(true);
    try {
      await financialService.allocateInventoryCost({
        inventory_id: allocationItem.id,
        quantity: allocationForm.quantity,
        destination_modality: allocationForm.modality,
        event_id: allocationForm.event_id || undefined,
        notes: allocationForm.notes || undefined,
      });

      setInventoryItems((prev) => prev.map((item) =>
        item.id === allocationItem.id
          ? { ...item, quantidadeTotal: Number(item.quantidadeTotal || 0) - allocationForm.quantity }
          : item
      ));
      setAllocationItem(null);
    } catch (e) {
      console.error("Erro ao direcionar estoque.", e);
      alert("Não foi possível direcionar o estoque. Verifique o saldo e tente novamente.");
    } finally {
      setAllocationLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este item?")) return;

    try {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
      setInventoryItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error("Erro ao excluir item no Supabase.", { table: "inventory", id, error: e });
      alert("Erro ao excluir item.");
      return;
    }
  };

  return (
    <>
      <PageHeader
        title="Inventário"
        subtitle="Controle de estoque e locação de itens"
        action={
          <PrimaryButton
            onClick={() => {
              setEditingId(null);
              setFormNome("");
              setFormQtd(0);
              setFormObs("");
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo Item
          </PrimaryButton>
        }
      />

      <div className="px-4 lg:px-8 py-5 lg:py-7 space-y-5 lg:space-y-7">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar itens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-surface border border-border text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <SectionCard title="Itens Cadastrados">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl border border-border bg-background/40 hover:border-border-strong transition-all flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{item.nome}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Estoque: {item.quantidadeTotal} {item.unidade || "un"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Custo unitário: R$ {Number(item.custoUnitario || 0).toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openAllocation(item)}
                      disabled={Number(item.quantidadeTotal || 0) <= 0}
                      title="Direcionar estoque para uma modalidade"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-surface/50 rounded-lg p-3 text-xs text-muted-foreground flex-1 whitespace-pre-wrap border border-border/50">
                  {item.observacoes || "Nenhuma observação ou local de armazenamento informado."}
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                Nenhum item encontrado no inventário.
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {allocationItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="font-display text-lg font-semibold">Direcionar estoque</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {allocationItem.nome} · saldo {allocationItem.quantidadeTotal} {allocationItem.unidade || "un"}
                </p>
              </div>
              <button
                onClick={() => setAllocationItem(null)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="label-eyebrow block mb-2">Quantidade</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  max={allocationItem.quantidadeTotal}
                  value={allocationForm.quantity}
                  onChange={(e) => setAllocationForm((p) => ({ ...p, quantity: Number(e.target.value || 0) }))}
                  className="w-full h-11 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Direcionar para</label>
                <select
                  value={allocationForm.modality}
                  onChange={(e) => {
                    const modality = e.target.value as FinancialModality;
                    setAllocationForm((p) => ({
                      ...p,
                      modality,
                      event_id: modality === "Evento" || modality === "Degustação" ? p.event_id : "",
                    }));
                  }}
                  className="w-full h-11 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none"
                >
                  <option value="Evento">Evento</option>
                  <option value="Goat Botequim">Goat Botequim</option>
                  <option value="7 Steak House">7 Steak House</option>
                  <option value="Degustação">Degustação</option>
                  <option value="Ativo">Ativo</option>
                </select>
              </div>

              {(allocationForm.modality === "Evento" || allocationForm.modality === "Degustação") && (
                <div>
                  <label className="label-eyebrow block mb-2">
                    {allocationForm.modality === "Degustação" ? "Evento da degustação" : "Evento relacionado"}
                  </label>
                  <select
                    value={allocationForm.event_id}
                    onChange={(e) => setAllocationForm((p) => ({ ...p, event_id: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {eventsList.map((ev: any) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.event_name || ev.client_name} - {ev.date}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="rounded-xl border border-border bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">Custo que será alocado à modalidade</div>
                <div className="text-xl font-bold mt-1">
                  R$ {(Number(allocationItem.custoUnitario || 0) * Number(allocationForm.quantity || 0)).toFixed(2).replace(".", ",")}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Esta operação gera custo gerencial, mas não uma nova saída de caixa.
                </div>
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Observação</label>
                <textarea
                  value={allocationForm.notes}
                  onChange={(e) => setAllocationForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="w-full p-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none resize-none"
                  placeholder="Ex: 2 garrafas direcionadas para operação semanal"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border rounded-b-2xl">
              <GhostButton onClick={() => setAllocationItem(null)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleAllocate} disabled={allocationLoading}>
                {allocationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Direcionar
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">
                {editingId ? "Editar Item" : "Novo Item no Inventário"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="label-eyebrow block mb-2">Nome do item</label>
                <input
                  type="text"
                  placeholder="Ex: Vodka"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Quantidade total do item</label>
                <input
                  type="number"
                  placeholder="Ex: 20"
                  value={formQtd || ""}
                  onChange={(e) => setFormQtd(Number(e.target.value))}
                  className="w-full h-11 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="label-eyebrow block mb-2">
                  Observações / Locais de armazenamento
                </label>
                <textarea
                  placeholder="Ex:&#10;- Estoque casa: 8 unidades&#10;- 7 Steakhouse: 5 unidades"
                  value={formObs}
                  onChange={(e) => setFormObs(e.target.value)}
                  rows={6}
                  className="w-full p-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border rounded-b-2xl">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleSave}>Salvar</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


