import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { 
  Plus, 
  Trash2, 
  Star, 
  Upload, 
  Eye, 
  RefreshCw, 
  Check, 
  X, 
  Loader2, 
  FileText, 
  AlertTriangle 
} from "lucide-react";
import { useState, useEffect } from "react";
import { TemplateMapperEditor } from "@/components/TemplateMapperEditor";
import { 
  proposalTemplatesService, 
  type ProposalTemplate 
} from "@/services/proposal-service";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/modelos")({
  component: () => (
    <AppShell>
      <ModelosPage />
    </AppShell>
  ),
});

function ModelosPage() {
  const { user } = useAuth();
  const role = (user?.user_metadata?.role as string | undefined)?.toLowerCase() ?? "admin";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  
  // Modals / Actions states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState<ProposalTemplate | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mapperTemplate, setMapperTemplate] = useState<ProposalTemplate | null>(null);
  
  // New template form
  const [newName, setNewName] = useState("");
  const [newEventType, setNewEventType] = useState<"casamento" | "aniversario" | "comemoracao">("casamento");
  const [newIsDefault, setNewIsDefault] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await proposalTemplatesService.listTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Erro ao buscar modelos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newName.trim()) return alert("Por favor, digite o nome do modelo.");
    if (!selectedFile) return alert("Por favor, selecione um arquivo PDF.");
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      return alert("Apenas arquivos PDF são aceitos.");
    }

    setUploading(true);
    try {
      const { publicUrl } = await proposalTemplatesService.uploadTemplateFile(selectedFile);
      const created = await proposalTemplatesService.createTemplate({
        name: newName,
        event_type: newEventType,
        file_url: publicUrl,
        is_active: true,
        is_default: newIsDefault,
      });

      if (newIsDefault) {
        await proposalTemplatesService.setDefaultTemplate(created.id, newEventType);
      }

      setShowAddModal(false);
      setNewName("");
      setSelectedFile(null);
      setNewIsDefault(false);
      loadTemplates();
    } catch (error) {
      console.error("Erro ao salvar modelo:", error);
      alert("Erro ao enviar arquivo ou salvar no banco de dados.");
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceTemplate = async (template: ProposalTemplate) => {
    if (!selectedFile) return alert("Por favor, selecione um arquivo PDF.");
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      return alert("Apenas arquivos PDF são aceitos.");
    }

    setUploading(true);
    try {
      const { publicUrl } = await proposalTemplatesService.uploadTemplateFile(selectedFile);
      await proposalTemplatesService.updateTemplate(template.id, {
        file_url: publicUrl,
      });
      setShowReplaceModal(null);
      setSelectedFile(null);
      loadTemplates();
    } catch (error) {
      console.error("Erro ao substituir modelo:", error);
      alert("Erro ao substituir modelo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este modelo permanentemente?")) return;
    try {
      await proposalTemplatesService.deleteTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error("Erro ao deletar modelo:", error);
      alert("Erro ao excluir modelo.");
    }
  };

  const handleToggleActive = async (template: ProposalTemplate) => {
    try {
      await proposalTemplatesService.updateTemplate(template.id, {
        is_active: !template.is_active,
      });
      loadTemplates();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  };

  const handleSetDefault = async (template: ProposalTemplate) => {
    try {
      await proposalTemplatesService.setDefaultTemplate(template.id, template.event_type);
      loadTemplates();
    } catch (error) {
      console.error("Erro ao definir padrão:", error);
    }
  };

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case "casamento":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-primary/20 text-primary border border-primary/20 font-medium">Casamento</span>;
      case "aniversario":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/20 font-medium">Aniversário</span>;
      case "comemoracao":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium">Comemoração</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-400 font-medium">{type}</span>;
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb="Sistema"
        title="Modelos de Proposta"
        subtitle="Gerencie os arquivos PDF de base visual fixa para a proposta comercial de cada tipo de evento."
        action={
          isAdmin && (
            <PrimaryButton onClick={() => setShowAddModal(true)} className="h-10 px-4">
              <Plus className="h-4 w-4 mr-2" /> Adicionar Modelo
            </PrimaryButton>
          )
        }
      />

      <div className="page-container space-y-6">
        {!isAdmin && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-400 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Apenas administradores podem gerenciar, substituir ou desativar os modelos de proposta.</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-xl">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground font-medium">Buscando modelos de proposta comercial...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <div 
                key={template.id} 
                className={`flex flex-col justify-between p-5 border bg-surface rounded-2xl transition-all duration-300 ${
                  template.is_active 
                    ? "border-border hover:border-primary/40 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]" 
                    : "border-border-strong/30 opacity-60 hover:opacity-80"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    {getEventTypeBadge(template.event_type)}
                    <div className="flex items-center gap-2">
                      {template.is_default && (
                        <span className="flex items-center gap-1 text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded border border-primary/30">
                          <Star className="h-3 w-3 fill-primary" /> Padrão
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        template.is_active 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {template.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-display font-semibold text-lg text-foreground mb-1 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    {template.name}
                  </h3>
                  
                  <p className="text-xs text-muted-foreground truncate mb-4">
                    PDF Original: {template.file_url ? template.file_url.split("/").pop() : "Sem arquivo"}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5 pt-4 border-t border-border/60">
                  <div className="flex gap-2 w-full">
                    {template.file_url ? (
                      <a 
                        href={template.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" /> Ver PDF Base
                      </a>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground h-9 border border-dashed border-border rounded-lg">
                        Sem visualização
                      </div>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setMapperTemplate(template)}
                          className="flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-all"
                          title="Mapear campos"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setShowReplaceModal(template)}
                          className="flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-all"
                          title="Substituir PDF"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex gap-1.5">
                        {!template.is_default && template.is_active && (
                          <button
                            onClick={() => handleSetDefault(template)}
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            <Star className="h-3 w-3" /> Tornar Padrão
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleToggleActive(template)}
                          className={`flex items-center gap-1 text-[11px] font-medium hover:underline ${
                            template.is_active ? "text-muted-foreground" : "text-success"
                          }`}
                        >
                          {template.is_active ? "Desativar" : "Ativar"}
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-[11px] text-danger hover:underline font-medium flex items-center gap-0.5"
                      >
                        <Trash2 className="h-3 w-3" /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="col-span-full py-16 text-center border border-dashed border-border rounded-2xl bg-surface flex flex-col items-center justify-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h4 className="font-display font-semibold text-lg text-foreground mb-1">Nenhum modelo cadastrado</h4>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Adicione modelos PDF fixos para gerar propostas comerciais preenchidas automaticamente.
                </p>
                {isAdmin && (
                  <PrimaryButton onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Cadastrar Primeiro Modelo
                  </PrimaryButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- ADD TEMPLATE MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold text-foreground">Adicionar Modelo de Proposta</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedFile(null);
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="label-eyebrow block mb-2">Nome do Modelo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Proposta Casamento Premium 2026"
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Tipo de Evento</label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as any)}
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none transition-colors"
                >
                  <option value="casamento">Casamento</option>
                  <option value="aniversario">Aniversário</option>
                  <option value="comemoracao">Comemoração / Outros</option>
                </select>
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Arquivo PDF Base</label>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-5 bg-background/50 hover:bg-background/80 transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-foreground">
                    {selectedFile ? selectedFile.name : "Clique para selecionar o PDF"}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    Apenas arquivos .pdf são suportados
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newIsDefault"
                  checked={newIsDefault}
                  onChange={(e) => setNewIsDefault(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary bg-input"
                />
                <label htmlFor="newIsDefault" className="text-xs font-medium text-muted-foreground select-none">
                  Definir este modelo como padrão para este tipo de evento
                </label>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => {
                setShowAddModal(false);
                setSelectedFile(null);
              }}>
                Cancelar
              </GhostButton>
              <PrimaryButton
                onClick={handleAddTemplate}
                disabled={uploading}
                className="h-10 px-4"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Salvar Modelo
                  </>
                )}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* --- REPLACE TEMPLATE MODAL --- */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold text-foreground">Substituir Arquivo PDF</h2>
              <button
                onClick={() => {
                  setShowReplaceModal(null);
                  setSelectedFile(null);
                }}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                  Substituir o PDF do modelo <strong className="text-foreground">{showReplaceModal.name}</strong>. Os orçamentos futuros usarão o novo design. Os metadados continuarão iguais.
                </p>
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Novo Arquivo PDF Base</label>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-5 bg-background/50 hover:bg-background/80 transition-colors relative cursor-pointer group">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-foreground">
                    {selectedFile ? selectedFile.name : "Clique para selecionar o novo PDF"}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    Apenas arquivos .pdf são suportados
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => {
                setShowReplaceModal(null);
                setSelectedFile(null);
              }}>
                Cancelar
              </GhostButton>
              <PrimaryButton
                onClick={() => handleReplaceTemplate(showReplaceModal)}
                disabled={uploading}
                className="h-10 px-4"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Substituindo...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" /> Confirmar Substituição
                  </>
                )}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
      {mapperTemplate && <TemplateMapperEditor template={mapperTemplate} onClose={() => setMapperTemplate(null)} />}
    </>
  );
}
