import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { useAppStore } from "@/lib/app-store";
import { useState } from "react";
import { Package, Plus, Search, Edit2, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/inventario")({
  component: () => (
    <AppShell>
      <InventoryPage />
    </AppShell>
  ),
});

function InventoryPage() {
  const { inventoryItems, addInventoryItem, updateInventoryItem, deleteInventoryItem } = useAppStore();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formNome, setFormNome] = useState("");
  const [formQtd, setFormQtd] = useState(0);
  const [formObs, setFormObs] = useState("");

  const filteredItems = inventoryItems.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()));

  const handleEdit = (item: typeof inventoryItems[0]) => {
    setEditingId(item.id);
    setFormNome(item.nome);
    setFormQtd(item.quantidadeTotal);
    setFormObs(item.observacoes);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formNome.trim()) return;
    if (editingId) {
      updateInventoryItem(editingId, { nome: formNome, quantidadeTotal: formQtd, observacoes: formObs });
    } else {
      addInventoryItem({ nome: formNome, quantidadeTotal: formQtd, observacoes: formObs });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este item?")) {
      deleteInventoryItem(id);
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
                        Estoque: {item.quantidadeTotal} {item.quantidadeTotal === 1 ? "unidade" : "unidades"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                <label className="label-eyebrow block mb-2">Observações / Locais de armazenamento</label>
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
