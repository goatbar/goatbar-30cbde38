import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Wine, TrendingUp, Search, Edit3, X, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { type Drink } from "@/lib/mock-data";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/drinks")({ component: () => <AppShell><DrinksPage /></AppShell> });

function DrinksPage() {
  const { drinks: allDrinks, updateDrink, addDrink } = useAppStore();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);

  const blankDrink: Drink = {
    id: "new",
    nome: "",
    categoria: "Whisky",
    descricao: "",
    custoUnitario: 0,
    modalityConfig: {
      evento: { active: true, cost: 0 },
      steakhouse: { active: false, cost: 0, price: 0 },
      goatbotequim: { active: false, cost: 0, price: 0 }
    }
  };

  const CATEGORIAS = ["Todas", ...Array.from(new Set(allDrinks.map((d) => d.categoria)))];

  const filtrados = allDrinks.filter((d) => {
    const matchBusca = d.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoria === "Todas" || d.categoria === categoria;
    return matchBusca && matchCategoria;
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  const ativos = allDrinks.filter((d) => d.modalityConfig?.evento?.active);
  const custoMedio = ativos.length ? ativos.reduce((a, d) => a + d.custoUnitario, 0) / ativos.length : 0;
  const margemMedia = 45; // Valor ilustrativo consolidado

  const handleSaveDrink = (id: string, updatePayload: Partial<Drink>) => {
    if (id === "new") {
      addDrink({ ...blankDrink, ...updatePayload } as Omit<Drink, "id">);
    } else {
      updateDrink(id, updatePayload);
    }
    setEditingDrink(null);
  };

  return (
    <>
      <PageHeader 
        title="Drinks" 
        subtitle="Catálogo completo com fichas técnicas e precificação."
        action={<PrimaryButton onClick={() => setEditingDrink(blankDrink)}><Plus className="h-4 w-4 mr-2" /> Novo Drink</PrimaryButton>}
      />

      <div className="px-8 py-7 space-y-7">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard label="Total no catálogo" value={String(allDrinks.length)} icon={<Wine className="h-4 w-4" />} />
          <StatCard label="Custo médio" value={fmtBRL(custoMedio)} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard label="Margem média" value={`${margemMedia.toFixed(1)}%`} />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 h-10 px-4 rounded-lg border border-border bg-surface flex-1 min-w-48 max-w-64">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Buscar drink..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent text-sm focus:outline-none flex-1"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="h-10 px-4 rounded-lg border border-border bg-surface text-sm focus:border-primary focus:outline-none"
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <SectionCard title="Catálogo" subtitle={`${filtrados.length} drinks`}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map((d) => <DrinkCard key={d.id} drink={d} onEdit={() => setEditingDrink(d)} />)}
            {filtrados.length === 0 && (
               <div className="col-span-full text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                 Nenhum drink encontrado com os filtros atuais.
               </div>
            )}
          </div>
        </SectionCard>
      </div>

      {editingDrink && (
        <EditModal 
          drink={editingDrink} 
          onClose={() => setEditingDrink(null)} 
          onSave={handleSaveDrink} 
        />
      )}
    </>
  );
}

function DrinkCard({ drink: d, onEdit }: { drink: Drink, onEdit: () => void }) {
  const margem7S = ((d.precoVenda7Steakhouse - d.custoUnitario) / d.precoVenda7Steakhouse) * 100;
  const margemGB = ((d.precoVendaGoatBotequim - d.custoUnitario) / d.precoVendaGoatBotequim) * 100;
  
  return (
    <div className={`rounded-xl border transition-all ${d.status === "inativo" ? "border-border opacity-60" : "border-border hover:border-border-strong"} bg-surface/50 group relative`}>
      <button onClick={onEdit} className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-primary z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Edit3 className="h-4 w-4" />
      </button>

      {d.imagem ? (
        <img
          src={d.imagem}
          alt={d.nome}
          className="w-full h-40 object-cover rounded-t-xl"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-40 rounded-t-xl bg-primary/10 flex items-center justify-center">
          <Wine className="h-10 w-10 text-primary/40" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display font-semibold text-sm pr-6">{d.nome}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{d.categoria}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-8">{d.descricao}</p>
        
        {d.insumos && d.insumos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60 bg-surface/30 rounded-lg p-2 -mx-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5 flex justify-between items-center">
              <span>Ficha Técnica (Insumos)</span>
              <span className="text-muted-foreground opacity-60">Total: {fmtBRL(d.custoUnitario)}</span>
            </div>
            <ul className="space-y-1">
              {d.insumos.map((i, idx) => (
                <li key={idx} className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{i.nome}</span>
                  <span className="font-medium">{fmtBRL(i.custo)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-3 gap-y-3 gap-x-2 text-xs">
          <div>
            <div className="text-muted-foreground">Evento (Custo)</div>
            <div className="font-medium mt-0.5">{fmtBRL(d.custoUnitario)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">7Steakhouse</div>
            <div className="font-medium mt-0.5 flex flex-col gap-0.5">
              <span>{d.modalityConfig?.steakhouse?.active ? fmtBRL(d.modalityConfig.steakhouse.price || 0) : "---"}</span>
              {d.modalityConfig?.steakhouse?.active && (
                <span className={`text-[9px] ${margem7S >= 50 ? "text-success" : "text-warning"}`}>MG: {margem7S.toFixed(0)}%</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Goat Botequim</div>
            <div className="font-medium mt-0.5 flex flex-col gap-0.5">
              <span>{d.modalityConfig?.goatbotequim?.active ? (d.modalityConfig.goatbotequim.price ? fmtBRL(d.modalityConfig.goatbotequim.price) : "S/ Preço") : "---"}</span>
              {d.modalityConfig?.goatbotequim?.active && d.modalityConfig.goatbotequim.price && (
                <span className={`text-[9px] ${margemGB >= 50 ? "text-success" : "text-warning"}`}>MG: {margemGB.toFixed(0)}%</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1">
          {d.modalityConfig?.evento?.active && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[9px] text-amber-600 font-bold uppercase">Evento</span>}
          {d.modalityConfig?.steakhouse?.active && <span className="px-2 py-0.5 rounded bg-success/10 text-[9px] text-success font-bold uppercase">Steakhouse</span>}
          {d.modalityConfig?.goatbotequim?.active && <span className="px-2 py-0.5 rounded bg-primary/10 text-[9px] text-primary font-bold uppercase">Botequim</span>}
        </div>
      </div>
    </div>
  );
}

function EditModal({ drink, onClose, onSave }: { drink: Drink, onClose: () => void, onSave: (id: string, payload: Partial<Drink>) => void }) {
  const [nome, setNome] = useState(drink.nome);
  const [categoria, setCategoria] = useState(drink.categoria);
  const [descricao, setDescricao] = useState(drink.descricao || "");
  const [imagem, setImagem] = useState(drink.imagem || "");
  const [config, setConfig] = useState(drink.modalityConfig);
  const [insumos, setInsumos] = useState<{nome: string, custo: number}[]>(drink.insumos || []);
  const insumosTotal = insumos.reduce((a, b) => a + b.custo, 0);

  const CATEGORIAS_SUGERIDAS = ["Whisky", "Rum", "Vodka", "Campari", "Cachaça", "Espumante", "Mocktail", "Gin", "Tequila", "Doses"];
  const allCategories = Array.from(new Set([...CATEGORIAS_SUGERIDAS]));

  const updateModality = (key: keyof typeof config, field: keyof ModalityConfig, val: any) => {
    setConfig({
      ...config,
      [key]: { ...config[key], [field]: val }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="font-display text-lg font-semibold">{drink.id === "new" ? "Cadastrar Novo Item" : "Gestão Multimodalidade"}</h2>
            <p className="text-xs text-muted-foreground">{nome || "Novo Item"}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        
        <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow block mb-2">Nome</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
            </div>
            <div>
              <label className="label-eyebrow block mb-2">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm">
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-eyebrow block mb-2">Imagem (Upload)</label>
              <input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                      setImagem(reader.result);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }} className="w-full h-10 px-4 pt-1.5 rounded-lg bg-input border border-border text-sm file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-eyebrow block mb-2">Descrição Curta</label>
              <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
            </div>
          </div>

          {/* Configuração por Modalidade */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Canais de Venda e Precificação</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {/* EVENTO */}
              <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Modalidade: Evento</span>
                  <input type="checkbox" checked={config.evento.active} onChange={e => updateModality("evento", "active", e.target.checked)} className="h-4 w-4" />
                </div>
                {config.evento.active && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground block">Insumos (Ficha Técnica)</label>
                        <GhostButton onClick={() => setInsumos([...insumos, { nome: "", custo: 0 }])} className="h-6 text-[10px] px-2"><Plus className="h-3 w-3 mr-1" /> Adicionar Insumo</GhostButton>
                      </div>
                      <div className="space-y-2">
                        {insumos.map((i, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Nome do insumo"
                              value={i.nome}
                              onChange={e => {
                                const arr = [...insumos];
                                arr[idx].nome = e.target.value;
                                setInsumos(arr);
                              }}
                              className="flex-1 h-8 px-3 rounded-md bg-input border border-border text-xs focus:border-primary focus:outline-none"
                            />
                            <input
                              type="number"
                              placeholder="R$"
                              value={i.custo || ""}
                              onChange={e => {
                                const arr = [...insumos];
                                arr[idx].custo = Number(e.target.value);
                                setInsumos(arr);
                              }}
                              className="w-24 h-8 px-3 rounded-md bg-input border border-border text-xs focus:border-primary focus:outline-none"
                            />
                            <button onClick={() => setInsumos(insumos.filter((_, iidx) => iidx !== idx))} className="h-8 w-8 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {insumos.length === 0 && <div className="text-[11px] text-muted-foreground italic">Nenhum insumo detalhado.</div>}
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-border pt-2">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block">Custo Total / Custo Evento (R$)</label>
                      <div className="font-bold text-sm text-primary">{fmtBRL(insumosTotal)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* STEAKHOUSE */}
              <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Modalidade: 7Steakhouse</span>
                  <input type="checkbox" checked={config.steakhouse.active} onChange={e => updateModality("steakhouse", "active", e.target.checked)} className="h-4 w-4" />
                </div>
                {config.steakhouse.active && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Custo Operacional (R$)</label>
                      <input type="number" value={config.steakhouse.cost} onChange={e => updateModality("steakhouse", "cost", Number(e.target.value))} className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Preço de Venda (R$)</label>
                      <input type="number" value={config.steakhouse.price} onChange={e => updateModality("steakhouse", "price", Number(e.target.value))} className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm font-bold text-primary" />
                    </div>
                  </div>
                )}
              </div>

              {/* BOTEQUIM */}
              <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Modalidade: Goat Botequim</span>
                  <input type="checkbox" checked={config.goatbotequim.active} onChange={e => updateModality("goatbotequim", "active", e.target.checked)} className="h-4 w-4" />
                </div>
                {config.goatbotequim.active && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Custo Drinks (R$)</label>
                      <input type="number" value={config.goatbotequim.cost} onChange={e => updateModality("goatbotequim", "cost", Number(e.target.value))} className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Preço de Venda (Opcional R$)</label>
                      <input type="number" value={config.goatbotequim.price} onChange={e => updateModality("goatbotequim", "price", Number(e.target.value))} className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm" placeholder="Ex: Doses" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border sticky bottom-0 z-10">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => onSave(drink.id, { nome, categoria, imagem, descricao, modalityConfig: config, custoUnitario: config.evento.active && insumos.length > 0 ? insumosTotal : config.evento.cost, insumos })}>Salvar Item</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
