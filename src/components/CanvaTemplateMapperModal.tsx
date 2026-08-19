/**
 * CanvaTemplateMapperModal.tsx
 *
 * Mapper visual e manual para Brand Templates do Canva e correspondência de campos (Data Fields ↔ Goat Bar).
 * Permite ao usuário visualizar o template com controles de zoom e realizar a configuração manual
 * campo a campo com suporte a dados dinâmicos do Goat Bar, texto manual fixo ou não preenchimento.
 */

import { useState, useEffect, useMemo, useRef } from "react";
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Type,
  FileSpreadsheet,
  Ban,
  Trash2,
  Info,
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
  getFieldCatalogItem,
  type ProposalCatalogField,
} from "@/lib/proposal-field-catalog";
import { PrimaryButton, GhostButton } from "@/components/ui-bits";

interface CanvaTemplateMapperModalProps {
  template: ProposalTemplate;
  onClose: () => void;
  onSaved?: () => void;
}

export type SourceType = "field" | "static" | "none";

export interface CanvaFieldState {
  index: number;
  key: string;
  name: string;
  type: string;
  source_type: SourceType;
  source_field_key: string | null;
  static_value: string | null;
  formatter: string;
  required: boolean;
  isRemoved?: boolean;
}

export function CanvaTemplateMapperModal({
  template,
  onClose,
  onSaved,
}: CanvaTemplateMapperModalProps) {
  // Loading & Connection state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Template metadata
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

  // Data fields state
  const [fields, setFields] = useState<CanvaFieldState[]>([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");

  // Visual preview zoom state
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Catalog groups for optgroups in select
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
    setApiError(null);
    try {
      // 1. Fetch existing stored mappings from database
      const existingMappings = await proposalTemplatesService.listFieldMappings(template.id);

      // 2. If a brand template is linked, fetch Data Fields from Canva
      if (template.canva_brand_template_id) {
        await syncFieldsWithCanva(template.canva_brand_template_id, existingMappings);
        setCanvaConnected(true);
      } else {
        // If no brand template linked yet, check connection
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
      console.warn("Erro ao carregar dados iniciais do mapper:", err);
    } finally {
      setLoading(false);
    }
  };

  const syncFieldsWithCanva = async (
    brandTemplateId: string,
    existingMappings?: ProposalTemplateFieldMapping[]
  ) => {
    setSyncing(true);
    setApiError(null);
    try {
      const res = await proposalTemplatesService.getCanvaBrandTemplateFields(brandTemplateId);

      if (res.error) {
        setApiError(res.error);
        if (res.error_code === "integration_not_found" || res.error_code === "unauthenticated") {
          setCanvaConnected(false);
        }
        return;
      }

      setCanvaConnected(true);
      const canvaFields = res.fields || [];

      // Current mappings from state or existing records
      const currentMappings =
        existingMappings ||
        fields.map((f) => ({
          canva_field_key: f.key,
          canva_field_type: f.type,
          source_type: f.source_type,
          source_field_key: f.source_field_key,
          static_value: f.static_value,
          formatter: f.formatter,
          required: f.required,
          template_id: template.id,
        }));

      const mappingsMap = new Map(currentMappings.map((m) => [m.canva_field_key, m]));
      const canvaKeySet = new Set(canvaFields.map((f) => f.key));

      const nextFields: CanvaFieldState[] = [];
      let idxCounter = 1;

      // 1. Add fields present in Canva dataset
      for (const cf of canvaFields) {
        const existing = mappingsMap.get(cf.key);
        const sourceType: SourceType =
          existing?.source_type === "static"
            ? "static"
            : existing?.source_type === "none"
            ? "none"
            : "field";

        nextFields.push({
          index: idxCounter++,
          key: cf.key,
          name: cf.name || cf.key,
          type: cf.type || "text",
          source_type: sourceType,
          source_field_key: existing?.source_field_key || null,
          static_value: existing?.static_value || null,
          formatter: existing?.formatter || (cf.key.toLowerCase().includes("valor") ? "currency" : "raw"),
          required: Boolean(existing?.required),
          isRemoved: false,
        });
      }

      // 2. Add previously mapped fields that no longer exist in Canva (marked as removed)
      for (const [key, mapping] of mappingsMap.entries()) {
        if (!canvaKeySet.has(key)) {
          nextFields.push({
            index: idxCounter++,
            key,
            name: key,
            type: mapping.canva_field_type || "text",
            source_type: (mapping.source_type as SourceType) || "field",
            source_field_key: mapping.source_field_key || null,
            static_value: mapping.static_value || null,
            formatter: mapping.formatter || "raw",
            required: Boolean(mapping.required),
            isRemoved: true,
          });
        }
      }

      setFields(nextFields);
      if (nextFields.length > 0 && selectedFieldIndex === null) {
        setSelectedFieldIndex(0);
      }
    } catch (err: any) {
      setApiError(err?.message || "Falha ao sincronizar campos do Canva.");
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
    await syncFieldsWithCanva(tmpl.id);
  };

  const updateSelectedField = (patch: Partial<CanvaFieldState>) => {
    if (selectedFieldIndex === null) return;
    setFields((prev) =>
      prev.map((f, i) => (i === selectedFieldIndex ? { ...f, ...patch } : f))
    );
  };

  const handleClearSelectedField = () => {
    if (selectedFieldIndex === null) return;
    updateSelectedField({
      source_type: "field",
      source_field_key: null,
      static_value: null,
      formatter: "raw",
      required: false,
    });
    toast.info("Mapeamento do campo limpo.");
  };

  const handleManualSuggestMatches = () => {
    if (!confirm("Deseja aplicar sugestões automáticas apenas nos campos ainda não mapeados? Nenhum campo existente será sobrescrito.")) {
      return;
    }

    const suggestions = suggestAutoMatches(fields.filter((f) => !f.isRemoved));
    let appliedCount = 0;

    setFields((prev) =>
      prev.map((f) => {
        if (f.source_type === "field" && !f.source_field_key && suggestions[f.key]) {
          appliedCount++;
          return { ...f, source_field_key: suggestions[f.key] };
        }
        return f;
      })
    );

    if (appliedCount > 0) {
      toast.success(`${appliedCount} correspondência(s) sugerida(s) aplicada(s) para revisão.`);
    } else {
      toast.info("Nenhuma nova correspondência encontrada para os campos pendentes.");
    }
  };

  const handleSave = async () => {
    if (!selectedBrandTemplateId) {
      toast.error("Selecione um Brand Template do Canva antes de salvar.");
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

      // 2. Persist field mappings
      const validMappings = fields
        .filter((f) => {
          if (f.source_type === "field") return Boolean(f.source_field_key);
          if (f.source_type === "static") return Boolean(f.static_value && f.static_value.trim());
          if (f.source_type === "none") return true;
          return false;
        })
        .map((f) => ({
          canva_field_key: f.key,
          canva_field_type: f.type,
          source_type: f.source_type,
          source_field_key: f.source_type === "field" ? f.source_field_key : null,
          static_value: f.source_type === "static" ? f.static_value : null,
          formatter: f.formatter || "raw",
          required: Boolean(f.required),
        }));

      await proposalTemplatesService.saveFieldMappings(template.id, validMappings);

      toast.success("Mapeamento salvo com sucesso!");
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar mapeamento:", err);
      toast.error(err?.message || "Erro ao salvar mapeamento.");
    } finally {
      setSaving(false);
    }
  };

  // Status Metrics
  const activeFields = fields.filter((f) => !f.isRemoved);
  const mappedCount = activeFields.filter((f) => {
    if (f.source_type === "field") return Boolean(f.source_field_key);
    if (f.source_type === "static") return Boolean(f.static_value && f.static_value.trim());
    if (f.source_type === "none") return true;
    return false;
  }).length;
  const unmappedCount = activeFields.length - mappedCount;
  const isComplete = activeFields.length > 0 && unmappedCount === 0;

  // Filtered fields list by search
  const filteredFields = fields.filter((f) =>
    f.key.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    f.name.toLowerCase().includes(fieldSearch.toLowerCase()) ||
    (f.source_field_key && f.source_field_key.toLowerCase().includes(fieldSearch.toLowerCase()))
  );

  const selectedField = selectedFieldIndex !== null ? fields[selectedFieldIndex] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3 md:p-6 animate-in fade-in">
      <div className="w-full max-w-[1400px] h-[92vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
        
        {/* ─── TOP HEADER ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#00C4CC]/10 text-[#00C4CC] flex items-center justify-center font-bold text-base">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-semibold text-foreground">
                  Mapeamento Canva · {template.name}
                </h2>
                {selectedBrandTemplateId && (
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    ID: {selectedBrandTemplateId}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Visualização do template e correspondência manual de campos com o Goat Bar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenPicker}
              className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              {selectedBrandTemplateId ? "Trocar Template" : "Selecionar Template"}
            </button>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── WORKSPACE (2 COLUMNS: PREVIEW + FIELD INSPECTOR) ──── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          
          {/* ─── LEFT COLUMN: VISUAL PREVIEW & ZOOM WORKSPACE ───── */}
          <div className="lg:col-span-7 border-r border-border flex flex-col bg-background/50 overflow-hidden relative">
            
            {/* Visual Toolbar */}
            <div className="px-4 py-2.5 border-b border-border/80 bg-card/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-muted-foreground font-medium">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Visualização do Template Canva</span>
              </div>

              {selectedBrandTemplateId && brandTemplateThumbnail && (
                <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => setZoomLevel((prev) => Math.max(50, prev - 25))}
                    disabled={zoomLevel <= 50}
                    className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted text-foreground transition-colors disabled:opacity-30 cursor-pointer"
                    title="Diminuir Zoom (-)"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-2 font-mono text-[11px] text-muted-foreground select-none">
                    {zoomLevel}%
                  </span>
                  <button
                    onClick={() => setZoomLevel((prev) => Math.min(200, prev + 25))}
                    disabled={zoomLevel >= 200}
                    className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted text-foreground transition-colors disabled:opacity-30 cursor-pointer"
                    title="Aumentar Zoom (+)"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <div className="h-4 w-px bg-border mx-0.5" />
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="h-7 px-2 rounded hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Restaurar tamanho original (100%)"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Preview Canvas Container */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative bg-muted/20">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Carregando visualização do template...
                  </span>
                </div>
              ) : !selectedBrandTemplateId ? (
                <div className="text-center max-w-sm p-8 border border-dashed border-border rounded-2xl bg-card/60">
                  <Layers className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h4 className="font-semibold text-sm text-foreground mb-1">
                    Nenhum Brand Template vinculado
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Vincule um Brand Template da sua conta Canva para visualizar o design e realizar o mapeamento manual.
                  </p>
                  <PrimaryButton onClick={handleOpenPicker} className="text-xs h-9 px-4 mx-auto">
                    Selecionar Brand Template
                  </PrimaryButton>
                </div>
              ) : brandTemplateThumbnail ? (
                <div
                  className="transition-transform duration-200 ease-out origin-center rounded-xl shadow-lg border border-border/80 bg-white overflow-hidden"
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    maxWidth: "90%",
                  }}
                >
                  <img
                    src={brandTemplateThumbnail}
                    alt={brandTemplateTitle || "Canva Template Preview"}
                    className="w-full h-auto object-contain select-none block pointer-events-none"
                  />
                </div>
              ) : (
                <div className="text-center max-w-xs p-6 border border-dashed border-border rounded-xl">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Miniatura do template não disponível na Canva Connect API.
                  </p>
                </div>
              )}
            </div>

            {/* Preview Footer info */}
            {selectedBrandTemplateId && (
              <div className="px-4 py-2 bg-card/40 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate">
                  {brandTemplateTitle || "Brand Template Vinculado"}
                </span>
                <span>Visualização Oficial Canva API</span>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN: NUMBERED FIELDS & INSPECTOR WORKSPACE ── */}
          <div className="lg:col-span-5 flex flex-col bg-surface overflow-hidden">
            
            {/* Metrics & Sync Bar */}
            <div className="p-4 border-b border-border bg-card/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${
                      isComplete
                        ? "bg-success/15 text-[#22c55e] border-[rgba(34,197,94,0.35)]"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {isComplete ? "Mapeamento Completo" : "Mapeamento Incompleto"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {mappedCount} de {activeFields.length} mapeados
                  </span>
                </div>

                {selectedBrandTemplateId && (
                  <button
                    onClick={() => syncFieldsWithCanva(selectedBrandTemplateId)}
                    disabled={syncing}
                    className="h-7 px-2.5 rounded-lg border border-border bg-surface text-[11px] font-medium text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Recarregar Data Fields do Canva"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin text-primary" : ""}`} />
                    {syncing ? "Sincronizando..." : "Atualizar Dados"}
                  </button>
                )}
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Buscar Data Field do Canva..."
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Error Banner */}
            {apiError && (
              <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Main Fields List / Empty State */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 text-primary animate-spin mb-2" />
                  <span className="text-xs text-muted-foreground">Consultando Data Fields do Canva...</span>
                </div>
              ) : !selectedBrandTemplateId ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Selecione um Brand Template na coluna ao lado para visualizar e mapear os campos.
                </div>
              ) : fields.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                    <Info className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-foreground mb-1">
                      Nenhum campo dinâmico encontrado
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Esse Brand Template ainda não possui Data Fields configurados para preenchimento.
                      Configure os campos dinâmicos no Brand Template dentro do Canva e depois clique no botão abaixo.
                    </p>
                  </div>
                  <button
                    onClick={() => syncFieldsWithCanva(selectedBrandTemplateId)}
                    disabled={syncing}
                    className="h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer border border-primary/30"
                  >
                    <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                    Atualizar Dados
                  </button>
                </div>
              ) : filteredFields.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhum Data Field encontrado para a busca "{fieldSearch}".
                </div>
              ) : (
                filteredFields.map((field) => {
                  const isSelected = selectedField?.key === field.key;
                  const isMapped =
                    field.source_type === "field"
                      ? Boolean(field.source_field_key)
                      : field.source_type === "static"
                      ? Boolean(field.static_value)
                      : field.source_type === "none";

                  const catalogItem = field.source_field_key ? getFieldCatalogItem(field.source_field_key) : null;

                  return (
                    <div
                      key={field.key}
                      onClick={() => {
                        const originalIndex = fields.findIndex((f) => f.key === field.key);
                        setSelectedFieldIndex(originalIndex);
                      }}
                      className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/30 border-l-4 border-l-transparent"
                      } ${field.isRemoved ? "bg-red-500/5 opacity-75" : ""}`}
                    >
                      {/* Number badge */}
                      <div
                        className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : isMapped
                            ? "bg-success/20 text-[#22c55e] border border-[rgba(34,197,94,0.35)]"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {field.index}
                      </div>

                      {/* Field details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-foreground truncate">
                            {field.key}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground">
                            {field.type}
                          </span>
                          {field.isRemoved && (
                            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30">
                              Removido no Canva
                            </span>
                          )}
                        </div>

                        {/* Mapping summary */}
                        <div className="text-xs text-muted-foreground truncate">
                          {field.source_type === "field" && field.source_field_key ? (
                            <span className="text-foreground font-medium flex items-center gap-1">
                              <span className="text-xs text-[#22c55e]">✓</span>
                              {catalogItem?.label || field.source_field_key}
                              <span className="text-[10px] text-muted-foreground">({field.formatter})</span>
                            </span>
                          ) : field.source_type === "static" && field.static_value ? (
                            <span className="text-foreground font-medium flex items-center gap-1">
                              <span className="text-xs text-[#22c55e]">✓</span>
                              Texto fixo: "{field.static_value}"
                            </span>
                          ) : field.source_type === "none" ? (
                            <span className="text-muted-foreground italic flex items-center gap-1">
                              <Ban className="h-3 w-3" /> Não preencher
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium">○ Não mapeado</span>
                          )}
                        </div>
                      </div>

                      {/* Required indicator */}
                      {field.required && (
                        <span className="text-[10px] text-primary font-semibold border border-primary/30 px-1.5 py-0.5 rounded bg-primary/5 shrink-0">
                          Obrigatório
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ─── FIELD INSPECTOR & MANUAL CONFIGURATION PANEL ──── */}
            {selectedField && (
              <div className="border-t border-border bg-card p-4 space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {selectedField.index}
                    </span>
                    <h4 className="font-mono text-xs font-bold text-foreground truncate">
                      {selectedField.key}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {selectedField.type}
                    </span>
                  </div>

                  <button
                    onClick={handleClearSelectedField}
                    className="text-[11px] text-muted-foreground hover:text-danger flex items-center gap-1 transition-colors cursor-pointer"
                    title="Limpar mapeamento deste campo"
                  >
                    <Trash2 className="h-3 w-3" /> Limpar
                  </button>
                </div>

                {/* Source Type Selector */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-input rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ source_type: "field" })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      selectedField.source_type === "field"
                        ? "bg-surface text-foreground shadow-sm border border-border font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Goat Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ source_type: "static" })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      selectedField.source_type === "static"
                        ? "bg-surface text-foreground shadow-sm border border-border font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Type className="h-3.5 w-3.5" /> Texto Fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedField({ source_type: "none" })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      selectedField.source_type === "none"
                        ? "bg-surface text-foreground shadow-sm border border-border font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Ban className="h-3.5 w-3.5" /> Omitir
                  </button>
                </div>

                {/* Source Type: Field */}
                {selectedField.source_type === "field" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Campo de Origem do Goat Bar
                      </label>
                      <select
                        value={selectedField.source_field_key || ""}
                        onChange={(e) => updateSelectedField({ source_field_key: e.target.value || null })}
                        className="w-full h-8 px-2.5 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none transition-colors"
                      >
                        <option value="">-- Selecione o campo do Goat Bar --</option>
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
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Formatador de Valor
                      </label>
                      <select
                        value={selectedField.formatter}
                        disabled={!selectedField.source_field_key}
                        onChange={(e) => updateSelectedField({ formatter: e.target.value })}
                        className="w-full h-8 px-2.5 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none transition-colors disabled:opacity-40"
                      >
                        {PROPOSAL_FORMATTERS.map((fmt) => (
                          <option key={fmt.key} value={fmt.key}>
                            {fmt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Source Type: Static Text */}
                {selectedField.source_type === "static" && (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Texto Manual Fixo
                    </label>
                    <input
                      type="text"
                      value={selectedField.static_value || ""}
                      onChange={(e) => updateSelectedField({ static_value: e.target.value })}
                      placeholder="Ex: PROPOSTA COMERCIAL"
                      className="w-full h-8 px-3 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                )}

                {/* Source Type: None */}
                {selectedField.source_type === "none" && (
                  <div className="p-2.5 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Este campo será ignorado e não preenchido na proposta.</span>
                  </div>
                )}

                {/* Required Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="requiredToggle"
                    checked={selectedField.required}
                    onChange={(e) => updateSelectedField({ required: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary bg-input cursor-pointer"
                  />
                  <label htmlFor="requiredToggle" className="text-xs text-muted-foreground select-none cursor-pointer">
                    Campo Obrigatório no Goat Bar (valida antes da geração)
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM FOOTER ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-card border-t border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={handleManualSuggestMatches}
              disabled={fields.length === 0}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="Aplica sugestões apenas aos campos ainda não configurados"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Sugerir Matches Automáticos
            </button>
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
                  Escolha o template publicado na sua conta Canva.
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
              ) : availableTemplates.filter((t) => t.title.toLowerCase().includes(pickerSearch.toLowerCase())).length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  Nenhum Brand Template encontrado na sua conta Canva.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableTemplates
                    .filter((t) => t.title.toLowerCase().includes(pickerSearch.toLowerCase()))
                    .map((item) => {
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
