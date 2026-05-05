import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton } from "@/components/ui-bits";
import { tiposEvento } from "@/lib/mock-data";
import { useAppStore } from "@/lib/app-store";
import { useEffect, useMemo, useState } from "react";
import { Save, Settings as SettingsIcon, Sliders, Calendar, Layers, FileText, Building2 } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <AppShell>
      <ConfigPage />
    </AppShell>
  ),
});

const sections = [
  { id: "diretrizes", label: "Diretrizes de cálculo", icon: Sliders, active: true },
  { id: "tipos", label: "Tipos de evento", icon: Calendar },
  { id: "categorias", label: "Categorias de drinks", icon: Layers },
  { id: "templates", label: "Templates de contrato", icon: FileText },
  { id: "unidades", label: "Unidades de negócio", icon: Building2 },
];

function ConfigPage() {
  const { parametros, updateParametros } = useAppStore();
  const [draft, setDraft] = useState(parametros);
  const [activeTab, setActiveTab] = useState("diretrizes");
  const grupos = useMemo(() => Array.from(new Set(draft.map((p) => p.grupo))), [draft]);

  return (
    <>
      <PageHeader
        breadcrumb="Sistema"
        title="Configurações"
        subtitle="Diretrizes editáveis aplicadas automaticamente em todos os cálculos."
        action={
          <PrimaryButton onClick={() => { updateParametros(draft); window.alert("Configurações salvas com sucesso."); }}>
            <Save className="h-4 w-4" /> Salvar alterações
          </PrimaryButton>
        }
      />

      <div className="px-8 py-7 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Sidebar interna */}
        <aside className="xl:col-span-3 space-y-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all ${
                  activeTab === s.id
                    ? "bg-primary/10 border-primary text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
          <div className="card-premium p-5 mt-5">
            <SettingsIcon className="h-5 w-5 text-primary mb-3" />
            <div className="font-display text-sm font-semibold">Aplicação automática</div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Estas diretrizes alimentam o cálculo de eventos, vendas e relatórios.
            </p>
          </div>
        </aside>

        <div className="xl:col-span-9 space-y-5">
          {activeTab === "diretrizes" && grupos.map((g) => (
            <SectionCard key={g} title={`Diretrizes · ${g}`} subtitle="Editáveis em tempo real">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {draft
                  .filter((p) => p.grupo === g)
                  .map((p) => (
                    <ParamField key={p.id} label={p.label} value={p.valor} unidade={p.unidade} hint={p.descricao}
                      onChange={(next) => setDraft((prev) => prev.map((item) => item.id === p.id ? { ...item, valor: next } : item))} />
                  ))}
              </div>
            </SectionCard>
          ))}

          {activeTab === "tipos" && (
            <SectionCard title="Tipos de evento" subtitle="Parâmetros de consumo por categoria">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      {["Tipo", "Doses/pessoa", "Gelo (kg)/pessoa", "Insumos R$/pessoa", "Equipe/50 pessoas"].map((h) => (
                        <th key={h} className="label-eyebrow px-6 py-3 border-y border-border">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiposEvento.map((t) => (
                      <tr key={t.id} className="border-b border-border/60">
                        <td className="px-6 py-3.5 font-medium">{t.nome}</td>
                        <td className="px-6 py-3.5">{t.consumoBebidaPessoa}</td>
                        <td className="px-6 py-3.5">{t.geloKgPessoa}</td>
                        <td className="px-6 py-3.5">R$ {t.insumosPessoa.toFixed(2)}</td>
                        <td className="px-6 py-3.5">{t.equipePor50}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {["categorias", "templates", "unidades"].includes(activeTab) && (
            <SectionCard title={sections.find(s => s.id === activeTab)?.label || ""} subtitle="Em desenvolvimento">
              <div className="py-12 text-center text-muted-foreground text-sm">
                Módulo em construção. Disponível na próxima versão.
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}

function ParamField({ label, value, unidade, hint, onChange }: { label: string; value: number; unidade: string; hint?: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <div className="mt-2 flex items-center rounded-lg bg-input border border-border focus-within:border-primary transition-colors">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const normalized = draft.replace(",", ".");
            const parsed = Number(normalized);
            if (!Number.isNaN(parsed)) onChange(parsed);
            setDraft(String(Number.isNaN(parsed) ? value : parsed));
          }}
          className="flex-1 bg-transparent px-4 py-2.5 text-sm focus:outline-none"
        />
        <span className="px-3 text-xs text-muted-foreground border-l border-border">{unidade}</span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}
