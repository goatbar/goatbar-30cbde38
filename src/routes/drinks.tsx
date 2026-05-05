import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatCard } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Wine, TrendingUp, Search } from "lucide-react";
import { useState } from "react";
import { drinks as allDrinks, type Drink } from "@/lib/mock-data";

export const Route = createFileRoute("/drinks")({ component: () => <AppShell><DrinksPage /></AppShell> });

const CATEGORIAS = ["Todas", ...Array.from(new Set(allDrinks.map((d) => d.categoria)))];

function DrinksPage() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("ativo");

  const filtrados = allDrinks.filter((d) => {
    const matchBusca = d.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoria === "Todas" || d.categoria === categoria;
    const matchStatus = statusFilter === "todos" || d.status === statusFilter;
    return matchBusca && matchCategoria && matchStatus;
  });

  const ativos = allDrinks.filter((d) => d.status === "ativo");
  const custoMedio = ativos.length ? ativos.reduce((a, d) => a + d.custoUnitario, 0) / ativos.length : 0;
  const margemMedia = ativos.length ? ativos.reduce((a, d) => a + ((d.precoVenda - d.custoUnitario) / d.precoVenda) * 100, 0) / ativos.length : 0;

  return (
    <>
      <PageHeader title="Drinks" subtitle="Catálogo completo com fichas técnicas e precificação." />

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
            {filtrados.map((d) => <DrinkCard key={d.id} drink={d} />)}
            {filtrados.length === 0 && (
              <div className="col-span-full text-center py-10 text-sm text-muted-foreground">
                Nenhum drink encontrado com os filtros atuais.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function DrinkCard({ drink: d }: { drink: Drink }) {
  const margem = ((d.precoVenda - d.custoUnitario) / d.precoVenda) * 100;
  return (
    <div className={`rounded-xl border transition-all ${d.status === "inativo" ? "border-border opacity-60" : "border-border hover:border-border-strong"} bg-surface/50`}>
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
            <div className="font-display font-semibold text-sm">{d.nome}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{d.categoria}</div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${d.status === "ativo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {d.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{d.descricao}</p>
        <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Custo</div>
            <div className="font-medium mt-0.5">{fmtBRL(d.custoUnitario)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Preço</div>
            <div className="font-medium mt-0.5">{fmtBRL(d.precoVenda)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Margem</div>
            <div className={`font-medium mt-0.5 ${margem >= 50 ? "text-success" : margem >= 35 ? "text-warning" : "text-destructive"}`}>
              {margem.toFixed(0)}%
            </div>
          </div>
        </div>
        {d.ingredientes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {d.ingredientes.slice(0, 3).map((ing) => (
              <span key={ing} className="px-2 py-0.5 rounded bg-primary/10 text-[10px] text-primary font-medium">
                {ing}
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
