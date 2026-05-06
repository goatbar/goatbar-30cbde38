import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, StatusBadge, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import { Plus, Download, FileText, Wine, Users, CheckCircle2, Loader2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { 
  contractTemplatesService, 
  contractSignersService, 
  glasswareService, 
  eventContractsService,
  type ContractTemplate,
  type ContractSigner,
  type Glassware
} from "@/services/contract-service";

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
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  // Estados Reais
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [signers, setSigners] = useState<ContractSigner[]>([]);
  const [glasswareList, setGlasswareList] = useState<Glassware[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Estados dos Modais
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [showGlasswareModal, setShowGlasswareModal] = useState(false);

  // Estados de Formulário
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "", is_default: false });
  const [newSigner, setNewSigner] = useState({ name: "", email: "", phone: "", role: "", cpf: "", address: "" });
  const [newGlassware, setNewGlassware] = useState({ name: "", type: "Taça", replacement_value: 0 });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tps, sigs, glasses] = await Promise.all([
        contractTemplatesService.listTemplates(),
        contractSignersService.listSigners(),
        glasswareService.listGlassware()
      ]);
      setTemplates(tps);
      setSigners(sigs);
      setGlasswareList(glasses);
      // Aqui carregaríamos os contratos vinculados se houvesse uma listagem global
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

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
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-xl">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando dados do sistema...</p>
            </div>
          ) : (
            <>
              {activeTab === "contratos" && (
                <SectionCard 
                  title="Contratos Gerados" 
                  subtitle="Histórico de contratos vinculados aos eventos"
                  action={
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Buscar por cliente..." 
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        className="pl-9 pr-4 py-1.5 rounded-lg border border-border bg-background text-xs focus:border-primary focus:outline-none w-48"
                      />
                    </div>
                  }
                >
                  {contracts.length === 0 ? (
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
                    ))}
                </div>
              )}
            </SectionCard>
          )}

             {activeTab === "templates" && (
            <SectionCard 
              title="Templates de Contrato" 
              subtitle="Modelos base para geração" 
              action={<PrimaryButton onClick={() => setShowTemplateModal(true)} className="h-9 px-3 text-sm"><Plus className="h-4 w-4" /> Novo Template</PrimaryButton>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(t => (
                  <div key={t.id} className="p-4 border border-border rounded-xl bg-surface relative group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-sm">{t.name}</div>
                      {t.is_default && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">Padrão</span>}
                    </div>
                    <div className="text-xs text-muted-foreground uppercase">{t.file_type}</div>
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {t.variables_schema?.slice(0, 3).map(v => <span key={v} className="text-[10px] px-1.5 py-0.5 bg-background border border-border rounded">{v}</span>)}
                      {t.variables_schema?.length > 3 && <span className="text-[10px] px-1.5 py-0.5 bg-background border border-border rounded">+{t.variables_schema.length - 3}</span>}
                    </div>
                    {!t.is_default && (
                      <button 
                        onClick={async () => {
                          await contractTemplatesService.setDefaultTemplate(t.id);
                          loadData();
                        }}
                        className="absolute bottom-4 right-4 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity underline"
                      >
                        Tornar Padrão
                      </button>
                    )}
                  </div>
                ))}
                {templates.length === 0 && <div className="col-span-2 text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">Nenhum template cadastrado.</div>}
              </div>
            </SectionCard>
          )}

          {activeTab === "socios" && (
            <SectionCard 
              title="Sócios Assinantes" 
              subtitle="Representantes autorizados pela GOAT Bar" 
              action={<PrimaryButton onClick={() => setShowSignerModal(true)} className="h-9 px-3 text-sm"><Plus className="h-4 w-4" /> Novo Sócio</PrimaryButton>}
            >
              <div className="space-y-3">
                {signers.map(s => (
                  <div key={s.id} className={`p-4 border rounded-xl flex justify-between items-center ${s.is_active ? 'border-border bg-surface' : 'border-border/50 bg-background opacity-60'}`}>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {s.name} <span className="text-xs font-normal text-muted-foreground">({s.role})</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{s.email} • {s.phone}</div>
                    </div>
                    <div>
                      <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${s.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{s.is_active ? "Ativo" : "Inativo"}</span>
                    </div>
                  </div>
                ))}
                {signers.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-xl">Nenhum sócio cadastrado.</div>}
              </div>
            </SectionCard>
          )}

          {activeTab === "copos" && (
            <SectionCard 
              title="Copos e Utensílios" 
              subtitle="Tabela de valores de reposição para quebras" 
              action={<PrimaryButton onClick={() => setShowGlasswareModal(true)} className="h-9 px-3 text-sm"><Plus className="h-4 w-4" /> Novo Copo</PrimaryButton>}
            >
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
                    {glasswareList.map((g) => (
                      <tr key={g.id} className="border-b border-border/60">
                        <td className="px-6 py-3.5 font-medium">{g.name}</td>
                        <td className="px-6 py-3.5">{g.type}</td>
                        <td className="px-6 py-3.5">{fmtBRL(g.replacement_value)}</td>
                        <td className="px-6 py-3.5">
                          <span className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${g.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>{g.is_active ? "Ativo" : "Inativo"}</span>
                        </td>
                      </tr>
                    ))}
                    {glasswareList.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Nenhum copo cadastrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
          </>
          )}
        </div>
      </div>

      {/* --- MODAIS DE CRUD --- */}

      {/* Modal de Template */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Novo Template de Contrato</h2>
              <button onClick={() => setShowTemplateModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-eyebrow block mb-2">Nome do Template</label>
                <input 
                  type="text" 
                  value={newTemplate.name} 
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  placeholder="Ex: Contrato de Eventos Padrão" 
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none" 
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Descrição</label>
                <textarea 
                  value={newTemplate.description} 
                  onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
                  rows={2} 
                  className="w-full px-4 py-2 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none resize-none" 
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Arquivo (DOCX ou PDF)</label>
                <input 
                  type="file" 
                  accept=".docx,.pdf"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="is_default" 
                  checked={newTemplate.is_default}
                  onChange={e => setNewTemplate({...newTemplate, is_default: e.target.checked})}
                />
                <label htmlFor="is_default" className="text-sm text-muted-foreground">Definir como padrão para novos eventos</label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowTemplateModal(false)}>Cancelar</GhostButton>
              <PrimaryButton 
                onClick={async () => {
                  if (!newTemplate.name || !selectedFile) return alert("Preencha o nome e selecione o arquivo.");
                  setUploading(true);
                  try {
                    const { publicUrl, filePath } = await contractTemplatesService.uploadTemplateFile(selectedFile);
                    await contractTemplatesService.createTemplate({
                      ...newTemplate,
                      file_url: publicUrl,
                      file_path: filePath,
                      file_type: selectedFile.name.split(".").pop() || "",
                      status: "active",
                      variables_schema: ["nome_cliente", "valor_total_evento", "data_evento"]
                    });
                    setShowTemplateModal(false);
                    loadData();
                  } catch (e) {
                    alert("Erro ao salvar template.");
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Salvar Template
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sócio */}
      {showSignerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Novo Sócio Assinante</h2>
              <button onClick={() => setShowSignerModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label-eyebrow block mb-2">Nome Completo</label>
                  <input type="text" value={newSigner.name} onChange={e => setNewSigner({...newSigner, name: e.target.value})} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                </div>
                <div>
                  <label className="label-eyebrow block mb-2">CPF</label>
                  <input type="text" value={newSigner.cpf} onChange={e => setNewSigner({...newSigner, cpf: e.target.value})} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                </div>
                <div>
                  <label className="label-eyebrow block mb-2">Cargo</label>
                  <input type="text" value={newSigner.role} onChange={e => setNewSigner({...newSigner, role: e.target.value})} placeholder="Ex: Sócio Diretor" className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="label-eyebrow block mb-2">E-mail</label>
                  <input type="email" value={newSigner.email} onChange={e => setNewSigner({...newSigner, email: e.target.value})} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowSignerModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={async () => {
                await contractSignersService.createSigner(newSigner);
                setShowSignerModal(false);
                loadData();
              }}>Salvar Sócio</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Copo */}
      {showGlasswareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Novo Copo / Utensílio</h2>
              <button onClick={() => setShowGlasswareModal(false)} className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-eyebrow block mb-2">Nome do Item</label>
                <input type="text" value={newGlassware.name} onChange={e => setNewGlassware({...newGlassware, name: e.target.value})} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Tipo</label>
                <select value={newGlassware.type} onChange={e => setNewGlassware({...newGlassware, type: e.target.value})} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm">
                  <option value="Taça">Taça</option>
                  <option value="Copo">Copo</option>
                  <option value="Utensílio">Utensílio</option>
                </select>
              </div>
              <div>
                <label className="label-eyebrow block mb-2">Valor de Reposição (R$)</label>
                <input type="number" value={newGlassware.replacement_value} onChange={e => setNewGlassware({...newGlassware, replacement_value: Number(e.target.value)})} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowGlasswareModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={async () => {
                await glasswareService.createGlassware(newGlassware);
                setShowGlasswareModal(false);
                loadData();
              }}>Salvar Item</PrimaryButton>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
