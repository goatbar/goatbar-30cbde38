/**
 * CanvaTemplateMapperModal.tsx
 *
 * Modal executivo para gerenciamento de Brand Templates do Canva e Match de Campos (Data Fields ↔ Goat Bar Catalog).
 */

import { useState, useEffect, useMemo } from "react";
import {
  X,
  RefreshCw,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  proposalTemplatesService,
  type ProposalTemplate,
  type ProposalTemplateFieldMapping,
} from "@/services/proposal-service";
import {
  PROPOSAL_FIELD_CATALOG,
  PROPOSAL_FORMATTERS,
  suggestAutoMatches,
  type ProposalCatalogField,
} from "@/lib/proposal-field-catalog";
import { PrimaryButton, GhostButton } from "@/components/ui-bits";

interface CanvaTemplateMapperModalProps {
  template: ProposalTemplate;
  onClose: () => void;
  onSaved?: () => void;
}

interface CanvaFieldState {
  key: string;
  name: string;
  type: string;
  source_field_key: string;
  formatter: string;
  required: boolean;
  isRemoved?: boolean;
}

export function CanvaTemplateMapperModal({
  template,
  onClose,
  onSaved,
}: CanvaTemplateMapperModalProps) {
  // Loading & State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null);

  // Template state
  const [selectedBrandTemplateId, setSelectedBrandTemplateId] = useState<string | null>(
    template.canva_brand_template_id || null
  );
  const [brandTemplateTitle, setBrandTemplateTitle] = useState<string>(
    template.canva_brand_template_title || ""
  );
  const [brandTemplateThumbnail, setBrandTemplateThumbnail] = useState<string | null>(
    template.canva_brand_template_thumbnail_url || null
  );

  // Brand templates list picker state
  const [showPicker, setShowPicker] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<
    Array<{ id: string; title: string; thumbnail_url?: string; view_url?: string }>
  >([]);
  const [pickerSearch, setPickerSearch] = useState("");

  // Field mappings state
  const [fields, setFields] = useState<CanvaFieldState[]>([]);

  // Group catalog items by group for optgroups
  const catalogGroups = useMemo(() => {
    const map: Record<string, ProposalCatalogField[]> = {};
    for (const item of PROPOSAL_FIELD_CATALOG) {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    }
    return map;
  }, []);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, [template.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Check existing stored mappings
      const existingMappings = await proposalTemplatesService.listFieldMappings(template.id);

      // 2. If a brand template is already linked, fetch current fields from Canva
      if (template.canva_brand_template_id) {
        await syncFieldsWithCanva(template.canva_brand_template_id, existingMappings);
        setCanvaConnected(true);
      } else {
        // If no brand template linked yet, check connection by trying to list templates
        try {
          const res = await proposalTemplatesService.listCanvaBrandTemplates();
          if (res.error_code === "unauthenticated" || res.error_code === "integration_not_found") {
            setCanvaConnected(false);
          } else {
            setCanvaConnected(true);
            setAvailableTemplates(res.items || []);
          }
        } catch {
          setCanvaConnected(false);
        }
      }
    } catch (err: any) {
      console.warn("Erro ao carregar dados iniciais:", err);
    } finally {
      setLoading(false);
    }
  };

  const syncFieldsWithCanva = async (
    brandTemplateId: string,
    existingMappings?: ProposalTemplateFieldMapping[]
  ) => {
    setSyncing(true);
    try {
      const res = await proposalTemplatesService.getCanvaBrandTemplateFields(brandTemplateId);

      if (res.error) {
        toast.error(res.error || "Erro ao consultar campos do template Canva.");
        if (res.error_code === "integration_not_found" || res.error_code === "unauthenticated") {
          setCanvaConnected(false);
        }
        return;
      }

      setCanvaConnected(true);
      const canvaFields = res.fields || [];

      // Current mappings from state or param
      const currentMappings =
        existingMappings ||
        fields.map((f) => ({
          canva_field_key: f.key,
          canva_field_type: f.type,
          source_field_key: f.source_field_key,
          formatter: f.formatter,
          required: f.required,
          template_id: template.id,
        }));

      const mappingsMap = new Map(currentMappings.map((m) => [m.canva_field_key, m]));
      const canvaKeySet = new Set(canvaFields.map((f) => f.key));

      // Build unified field list
      const nextFields: CanvaFieldState[] = [];

      // 1. Add fields present in Canva
      for (const cf of canvaFields) {
        const existing = mappingsMap.get(cf.key);
        nextFields.push({
          key: cf.key,
          name: cf.name || cf.key,
          type: cf.type || "text",
          source_field_key: existing?.source_field_key || "",
          formatter: existing?.formatter || (cf.key.toLowerCase().includes("valor") ? "currency" : "raw"),
          required: Boolean(existing?.required),
          isRemoved: false,
        });
      }

      // 2. Add previously mapped fields that no longer exist in Canva (marked as removed)
      for (const [key, mapping] of mappingsMap.entries()) {
        if (!canvaKeySet.has(key)) {
          nextFields.push({
            key,
            name: key,
            type: mapping.canva_field_type || "text",
            source_field_key: mapping.source_field_key,
            formatter: mapping.formatter || "raw",
            required: Boolean(mapping.required),
            isRemoved: true,
          });
        }
      }

      setFields(nextFields);
      toast.success(`${canvaFields.length} campos dinâmicos sincronizados do Canva.`);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao sincronizar campos do Canva.");
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenPicker = async () => {
    setShowPicker(true);
    setLoadingTemplates(true);
    try {
      const res = await proposalTemplatesService.listCanvaBrandTemplates();
      if (res.error) {
        toast.error(res.error || "Não foi possível carregar os templates do Canva.");
        if (res.error_code === "unauthenticated" || res.error_code === "integration_not_found") {
          setCanvaConnected(false);
        }
      } else {
        setAvailableTemplates(res.items || []);
        setCanvaConnected(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar templates.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = async (tmpl: {
    id: string;
    title: string;
    thumbnail_url?: string;
  }) => {
    setSelectedBrandTemplateId(tmpl.id);
    setBrandTemplateTitle(tmpl.title);
    setBrandTemplateThumbnail(tmpl.thumbnail_url || null);
    setShowPicker(false);

    // Sync fields for newly selected template
    await syncFieldsWithCanva(tmpl.id);
  };

  const handleAutoMatch = () => {
    const suggestions = suggestAutoMatches(fields.filter((f) => !f.isRemoved));
    let matchCount = 0;

    setFields((prev) =>
      prev.map((f) => {
        if (!f.source_field_key && suggestions[f.key]) {
          matchCount++;
          return { ...f, source_field_key: suggestions[f.key] };
        }
        return f;
      })
    );

    if (matchCount > 0) {
      toast.success(`${matchCount} correspondência(s) automática(s) sugerida(s)!`);
    } else {
      toast.info("Nenhuma nova correspondência automática encontrada.");
    }
  };

  const handleSave = async () => {
    if (!selectedBrandTemplateId) {
      toast.error("Por favor, selecione um Brand Template do Canva antes de salvar.");
      return;
    }

    setSaving(true);
    try {
      // 1. Update proposal_template record with Canva metadata
      await proposalTemplatesService.updateTemplate(template.id, {
        provider: "canva",
        canva_brand_template_id: selectedBrandTemplateId,
        canva_brand_template_title: brandTemplateTitle,
        canva_brand_template_thumbnail_url: brandTemplateThumbnail,
        canva_last_synced_at: new Date().toISOString(),
      });

      // 2. Persist field mappings (filtering out empty or removed unmapped fields)
      const validMappings = fields
        .filter((f) => f.source_field_key.trim() !== "")
        .map((f) => ({
          canva_field_key: f.key,
          canva_field_type: f.type,
          source_field_key: f.source_field_key,
          formatter: f.formatter || "raw",
          required: Boolean(f.required),
        }));

      await proposalTemplatesService.saveFieldMappings(template.id, validMappings);

      toast.success("Mapeamento salvo com sucesso!");
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar mapeamento:", err);
      toast.error(err?.message || "Erro ao salvar mapeamento no banco de dados.");
    } finally {
      setSaving(false);
    }
  };

  // Status metrics
  const activeFields = fields.filter((f) => !f.isRemoved);
  const mappedCount = activeFields.filter((f) => f.source_field_key.trim() !== "").length;
  const totalCount = activeFields.length;
  const isComplete = totalCount > 0 && mappedCount === totalCount;

  const filteredTemplates = availableTemplates.filter((t) =>
    t.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#00C4CC]/10 text-[#00C4CC] flex items-center justify-center font-bold text-base">
              C
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                Mapeamento Canva · {template.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Vincule o Brand Template e configure a correspondência de campos com o Goat Bar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning banner if Canva is not connected */}
          {canvaConnected === false && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 text-amber-400 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Sua conta do Canva não está conectada. Conecte nas Configurações para carregar seus templates.
                </span>
              </div>
              <a
                href="/configuracoes"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                Ir para Integrações <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Template Selection Box */}
          <div className="card-premium p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="label-eyebrow block mb-1">Brand Template Vinculado</label>
                {selectedBrandTemplateId ? (
                  <div className="flex items-center gap-3 mt-1">
                    {brandTemplateThumbnail ? (
                      <img
                        src={brandTemplateThumbnail}
                        alt="Template Preview"
                        className="h-12 w-12 object-cover rounded-lg border border-border shadow-sm"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        {brandTemplateTitle || "Brand Template sem título"}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {selectedBrandTemplateId}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum Brand Template do Canva selecionado ainda.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <GhostButton onClick={handleOpenPicker} className="text-xs h-9 px-3">
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  {selectedBrandTemplateId ? "Trocar Template Canva" : "Selecionar Template Canva"}
                </GhostButton>

                {selectedBrandTemplateId && (
                  <button
                    onClick={() => syncFieldsWithCanva(selectedBrandTemplateId)}
                    disabled={syncing}
                    className="h-9 px-3 rounded-lg border border-border bg-surface text-xs font-medium text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Recarregar Data Fields do Canva"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin text-primary" : ""}`} />
                    {syncing ? "Sincronizando..." : "Atualizar Dados"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mapping Table Section */}
          {selectedBrandTemplateId && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-semibold text-sm text-foreground">
                    Mapeamento de Campos
                  </h3>
                  {totalCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        isComplete
                          ? "bg-success/15 text-[#22c55e] border-[rgba(34,197,94,0.35)]"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {mappedCount} de {totalCount} campos configurados
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAutoMatch}
                    disabled={fields.length === 0}
                    className="h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1.5 border border-primary/30 transition-colors cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Sugerir Matches Automáticos
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-border rounded-xl">
                  <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
                  <span className="text-xs text-muted-foreground">Carregando campos do modelo...</span>
                </div>
              ) : fields.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-border rounded-xl bg-card">
                  <p className="text-sm text-muted-foreground font-medium mb-2">
                    Nenhum Data Field encontrado no template do Canva selecionado.
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Certifique-se de que os campos dinâmicos foram configurados no Brand Template dentro do Canva.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Campo Canva</th>
                        <th className="px-4 py-3 font-semibold">Tipo Canva</th>
                        <th className="px-4 py-3 font-semibold">Campo no Goat Bar</th>
                        <th className="px-4 py-3 font-semibold">Formatador</th>
                        <th className="px-4 py-3 font-semibold text-center">Obrigatório</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {fields.map((field, idx) => {
                        const isMapped = field.source_field_key.trim() !== "";
                        return (
                          <tr
                            key={field.key}
                            className={`hover:bg-muted/30 transition-colors ${
                              field.isRemoved ? "bg-red-500/5 opacity-70" : ""
                            }`}
                          >
                            {/* Campo Canva */}
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-foreground bg-background px-2 py-0.5 rounded border border-border">
                                  {field.key}
                                </span>
                                {field.isRemoved && (
                                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">
                                    Removido no Canva
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Tipo Canva */}
                            <td className="px-4 py-3 text-muted-foreground capitalize">
                              <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px]">
                                {field.type}
                              </span>
                            </td>

                            {/* Campo Goat Bar */}
                            <td className="px-4 py-3">
                              <select
                                value={field.source_field_key}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFields((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, source_field_key: val } : f))
                                  );
                                }}
                                className={`w-full h-8 px-2.5 rounded-lg bg-input border text-xs focus:border-primary focus:outline-none transition-colors ${
                                  isMapped
                                    ? "border-border text-foreground font-medium"
                                    : "border-dashed border-border-strong text-muted-foreground"
                                }`}
                              >
                                <option value="">-- Não Mapeado --</option>
                                {Object.entries(catalogGroups).map(([groupName, items]) => (
                                  <optgroup key={groupName} label={groupName}>
                                    {items.map((item) => (
                                      <option key={item.key} value={item.key}>
                                        {item.label} ({item.key})
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </td>

                            {/* Formatador */}
                            <td className="px-4 py-3">
                              <select
                                value={field.formatter}
                                disabled={!isMapped}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFields((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, formatter: val } : f))
                                  );
                                }}
                                className="w-full h-8 px-2.5 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none transition-colors disabled:opacity-40"
                              >
                                {PROPOSAL_FORMATTERS.map((fmt) => (
                                  <option key={fmt.key} value={fmt.key}>
                                    {fmt.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Obrigatório */}
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={field.required}
                                disabled={!isMapped}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setFields((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, required: val } : f))
                                  );
                                }}
                                className="rounded border-border text-primary focus:ring-primary bg-input cursor-pointer disabled:opacity-40"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-card border-t border-border">
          <div className="text-xs text-muted-foreground">
            {isComplete ? (
              <span className="flex items-center gap-1.5 text-success font-medium">
                <CheckCircle2 className="h-4 w-4" /> Todos os campos estão devidamente associados
              </span>
            ) : (
              <span>Campos não mapeados não serão preenchidos na proposta.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <GhostButton onClick={onClose}>Cancelar</GhostButton>
            <PrimaryButton onClick={handleSave} disabled={saving} className="h-9 px-4">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" /> Salvar Mapeamento
                </>
              )}
            </PrimaryButton>
          </div>
        </div>
      </div>

      {/* ─── BRAND TEMPLATES PICKER MODAL ───────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[80vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="font-display font-semibold text-base text-foreground">
                  Selecionar Brand Template do Canva
                </h3>
                <p className="text-xs text-muted-foreground">
                  Escolha o template publicado na sua conta Canva Developers.
                </p>
              </div>
              <button
                onClick={() => setShowPicker(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search filter */}
            <div className="p-4 border-b border-border bg-card">
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Buscar template por título..."
                  className="w-full h-9 pl-9 pr-4 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Templates List Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingTemplates ? (
                <div className="py-16 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Consultando templates na Canva Connect API...
                  </span>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  Nenhum Brand Template encontrado na sua conta Canva.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredTemplates.map((item) => {
                    const isSelected = selectedBrandTemplateId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectTemplate(item)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
                        }`}
                      >
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title}
                            className="h-14 w-14 object-cover rounded-lg border border-border shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0 text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h5 className="font-semibold text-xs text-foreground truncate mb-0.5">
                            {item.title}
                          </h5>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {item.id}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-card border-t border-border flex justify-end">
              <GhostButton onClick={() => setShowPicker(false)}>Fechar</GhostButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
