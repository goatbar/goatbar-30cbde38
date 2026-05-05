import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatusBadge, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { useAppStore } from "@/lib/app-store";
import { Plus, Download, FileText, Wine, Users, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/contratos")({
  component: () => (
    <AppShell>
      <ContratosPage />
    </AppShell>
  ),
});

const tabs = [
  { id: "contratos", label: "Contratos Gerados", icon: FileText },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "socios", label: "Sócios Assinantes", icon: Users },
  { id: "copos", label: "Copos / Utensílios", icon: Wine },
];

function ContratosPage() {
  const [activeTab, setActiveTab] = useState("contratos");
  const { eventContracts, contractTemplates, contractSigners, glasswares, eventos, eventContractClientDatas } = useAppStore();

  return (
    <>
      <PageHeader
        breadcrumb="Documentos"
        title="Contratos"
        subtitle="Gestão de modelos, assinaturas e utilitários de contrato."
      />

      <div className="px-8 py-7 grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Sidebar */}
        <aside className="xl:col-span-3 space-y-2">
          {tabs.map((s) => {
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
        </aside>

        {/* Conteúdo */}
        <div className="xl:col-span-9 space-y-5">
          {activeTab === "contratos" && (
            <SectionCard title="Contratos Gerados" subtitle="Histórico de contratos vinculados aos eventos">
              {eventContracts.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  Nenhum contrato gerado ainda. Acesse um evento para gerar o primeiro contrato.
                </div>
              ) : (
                <div className="space-y-4">
                  {eventContracts.map(ec => {
                    const evento = eventos.find(e => e.id === ec.eventId);
                    const client = eventContractClientDatas.find(c => c.eventId === ec.eventId);
                    const template = contractTemplates.find(t => t.id === ec.templateId);
                    
                    return (
                      <div key={ec.id} className="p-5 border border-border bg-surface rounded-xl flex flex-col md:flex-row justify-between gap-5">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium">{client?.clientName || "Cliente Desconhecido"}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium tracking-wider ${ec.status === "assinado" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{ec.status.replace("_", " ")}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">{evento?.nome} • {new Date(evento?.data || "").toLocaleDateString("pt-BR")}</div>
                          <div className="text-xs text-muted-foreground mt-2">Template: {template?.name} (v{ec.version})</div>
                        </div>
                        <div className="flex flex-col gap-2 justify-center">
                          <GhostButton className="h-8 text-xs"><Download className="h-3 w-3" /> Contrato PDF</GhostButton>
                          {ec.status === "assinado" && <GhostButton className="h-8 text-xs text-success hover:bg-success/10"><CheckCircle2 className="h-3 w-3" /> Certificado</GhostButton>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {activeTab === "templates" && (
            <SectionCard title="Templates de Contrato" subtitle="Modelos base para geração" action={<PrimaryButton className="h-9 px-3 text-sm"><Plus className="h-4 w-4" /> Novo Template</PrimaryButton>}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contractTemplates.map(t => (
                  <div key={t.id} className="p-4 border border-border rounded-xl bg-surface">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm">{t.name}</div>
                      {t.isDefault && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">Padrão</span>}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase">{t.fileType}</div>
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {t.variablesSchema.slice(0, 3).map(v => <span key={v} className="text-[10px] px-1.5 py-0.5 bg-background border border-border rounded">{v}</span>)}
                      {t.variablesSchema.length > 3 && <span className="text-[10px] px-1.5 py-0.5 bg-background border border-border rounded">+{t.variablesSchema.length - 3}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {activeTab === "socios" && (
            <SectionCard title="Sócios Assinantes" subtitle="Representantes autorizados pela GOAT Bar" action={<PrimaryButton className="h-9 px-3 text-sm"><Plus className="h-4 w-4" /> Novo Sócio</PrimaryButton>}>
              <div className="space-y-3">
                {contractSigners.map(s => (
                  <div key={s.id} className={`p-4 border rounded-xl flex justify-between items-center ${s.isActive ? 'border-border bg-surface' : 'border-border/50 bg-background opacity-60'}`}>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {s.name} <span className="text-xs font-normal text-muted-foreground">({s.role})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{s.email} • {s.phone}</div>
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${s.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{s.isActive ? "Ativo" : "Inativo"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {activeTab === "copos" && (
            <SectionCard title="Copos e Utensílios" subtitle="Tabela de valores de reposição para quebras" action={<PrimaryButton className="h-9 px-3 text-sm"><Plus className="h-4 w-4" /> Novo Copo</PrimaryButton>}>
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="label-eyebrow px-6 py-3 border-y border-border">Nome</th>
                      <th className="label-eyebrow px-6 py-3 border-y border-border">Tipo</th>
                      <th className="label-eyebrow px-6 py-3 border-y border-border">Reposição</th>
                      <th className="label-eyebrow px-6 py-3 border-y border-border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glasswares.map((g) => (
                      <tr key={g.id} className="border-b border-border/60">
                        <td className="px-6 py-3.5 font-medium">{g.name}</td>
                        <td className="px-6 py-3.5">{g.type}</td>
                        <td className="px-6 py-3.5">{fmtBRL(g.replacementValue)}</td>
                        <td className="px-6 py-3.5">
                          <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${g.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{g.isActive ? "Ativo" : "Inativo"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </>
  );
}
