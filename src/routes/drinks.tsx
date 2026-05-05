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
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("ativo");
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);

  const blankDrink: Drink = {
    id: "new",
    nome: "",
    categoria: "Whiskey",
    descricao: "Novo drink cadastrado manualmente.",
    ingredientes: [],
    custoUnitario: 0,
    precoVenda7Steakhouse: 0,
    precoVendaGoatBotequim: 0,
    status: "ativo",
    disponibilidade: ["Eventos", "7Steakhouse", "Goat Botequim"]
  };

  const CATEGORIAS = ["Todas", ...Array.from(new Set(allDrinks.map((d) => d.categoria)))];

  const filtrados = allDrinks.filter((d) => {
    const matchBusca = d.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoria === "Todas" || d.categoria === categoria;
    const matchStatus = statusFilter === "todos" || d.status === statusFilter;
    return matchBusca && matchCategoria && matchStatus;
  });

  const ativos = allDrinks.filter((d) => d.status === "ativo");
  const custoMedio = ativos.length ? ativos.reduce((a, d) => a + d.custoUnitario, 0) / ativos.length : 0;
  const margemMedia = ativos.length ? ativos.reduce((a, d) => a + ((d.precoVenda7Steakhouse - d.custoUnitario) / d.precoVenda7Steakhouse) * 100, 0) / ativos.length : 0;

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
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["todos", "ativo", "inativo"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 h-10 text-sm capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
              >
                {s === "todos" ? "Todos" : s === "ativo" ? "Ativos" : "Inativos"}
              </button>
            ))}
          </div>
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
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0 ${d.status === "ativo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {d.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-8">{d.descricao}</p>
        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-3 gap-y-3 gap-x-2 text-xs">
          <div>
            <div className="text-muted-foreground">Custo Unitário</div>
            <div className="font-medium mt-0.5">{fmtBRL(d.custoUnitario)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">7Steakhouse</div>
            <div className="font-medium mt-0.5 flex flex-col gap-0.5">
              <span>{fmtBRL(d.precoVenda7Steakhouse)}</span>
              <span className={`text-[9px] ${margem7S >= 50 ? "text-success" : margem7S >= 35 ? "text-warning" : "text-destructive"}`}>MG: {margem7S.toFixed(0)}%</span>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Goat Botequim</div>
            <div className="font-medium mt-0.5 flex flex-col gap-0.5">
              <span>{fmtBRL(d.precoVendaGoatBotequim)}</span>
              <span className={`text-[9px] ${margemGB >= 50 ? "text-success" : margemGB >= 35 ? "text-warning" : "text-destructive"}`}>MG: {margemGB.toFixed(0)}%</span>
            </div>
          </div>
        </div>
        {d.ingredientes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {d.ingredientes.slice(0, 3).map((ing, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-primary/10 text-[10px] text-primary font-medium">
                {ing.nome}
              </span>
            ))}
            {d.ingredientes.length > 3 && (
              <span className="px-2 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                +{d.ingredientes.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditModal({ drink, onClose, onSave }: { drink: Drink, onClose: () => void, onSave: (id: string, payload: Partial<Drink>) => void }) {
  const [nome, setNome] = useState(drink.nome);
  const [categoria, setCategoria] = useState(drink.categoria);
  const [steak, setSteak] = useState(drink.precoVenda7Steakhouse);
  const [bot, setBot] = useState(drink.precoVendaGoatBotequim);
  const [ingredientes, setIngredientes] = useState([...drink.ingredientes]);

  const CATEGORIAS_SUGERIDAS = ["Whiskey", "Rum", "Vodka", "Campari", "Cachaça", "Espumante", "Mocktail"];
  const allCategories = Array.from(new Set([...CATEGORIAS_SUGERIDAS]));

  const addIngredient = () => {
    setIngredientes([...ingredientes, { nome: "", custo: 0 }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredientes(ingredientes.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: "nome" | "custo", val: any) => {
    const copy = [...ingredientes];
    if (field === "custo") copy[idx].custo = val < 0 ? 0 : val;
    else copy[idx].nome = val;
    setIngredientes(copy);
  };

  const totalCusto = ingredientes.reduce((acc, curr) => acc + curr.custo, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="font-display text-lg font-semibold">{drink.id === "new" ? "Cadastrar Novo Drink" : "Custo e Precificação"}</h2>
            <p className="text-xs text-muted-foreground">{drink.id === "new" ? "Preencha as informações abaixo" : drink.nome}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow block mb-2">Nome do Drink</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
              />
            </div>
            <div>
              <label className="label-eyebrow block mb-2">Categoria</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
              >
                {!allCategories.includes(drink.categoria) && (
                  <option value={drink.categoria} disabled>{drink.categoria} (Antiga)</option>
                )}
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <hr className="border-border" />
          {/* Ficha Técnica e Custos */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
              Ficha Técnica (Ingredientes)
              <GhostButton onClick={addIngredient} className="h-7 text-xs px-2"><Plus className="h-3 w-3" /> Adicionar</GhostButton>
            </h3>
            <div className="space-y-2">
              {ingredientes.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center border border-dashed border-border rounded-lg">Nenhum ingrediente cadastrado.</p>}
              {ingredientes.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input 
                    type="text" 
                    value={ing.nome} 
                    onChange={e => updateIngredient(idx, "nome", e.target.value)} 
                    placeholder="Nome do ingrediente"
                    className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none" 
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-3 top-2 text-muted-foreground text-xs">R$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={ing.custo} 
                      onChange={e => updateIngredient(idx, "custo", Number(e.target.value))} 
                      className="w-full h-9 pl-8 pr-2 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none" 
                    />
                  </div>
                  <button onClick={() => removeIngredient(idx)} className="h-9 w-9 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-md shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-3 mt-4 rounded-lg bg-primary/5 border border-primary/20 text-sm flex justify-between items-center text-primary">
              <span className="font-medium">Custo Total Atualizado</span>
              <span className="font-semibold text-lg">{fmtBRL(totalCusto)}</span>
            </div>
          </div>

          <hr className="border-border" />

          {/* Venda Units */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow block mb-2">Venda (7Steakhouse)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={steak}
                  onChange={e => setSteak(Number(e.target.value))}
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-right">
                Margem: {steak > 0 ? (((steak - totalCusto) / steak) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div>
              <label className="label-eyebrow block mb-2">Venda (Goat Botequim)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={bot}
                  onChange={e => setBot(Number(e.target.value))}
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-right">
                Margem: {bot > 0 ? (((bot - totalCusto) / bot) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border sticky bottom-0 z-10">
          <GhostButton onClick={onClose}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => onSave(drink.id, { nome, categoria, ingredientes, precoVenda7Steakhouse: steak, precoVendaGoatBotequim: bot })}>Salvar Alterações</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
