import React, { useState, useMemo } from "react";
import {
  Search,
  Sparkles,
  Zap,
  Tag,
  CheckCircle2,
  GripVertical,
} from "lucide-react";
import {
  EDITOR_FIELD_CATEGORIES,
  ALL_EDITOR_FIELDS,
  type EditorFieldDef,
} from "./contract-editor-store";

interface SidebarFieldsProps {
  onInsertField: (field: EditorFieldDef) => void;
  activeHighlightField: string | null;
  setActiveHighlightField: (key: string | null) => void;
  documentHtml: string;
}

export const SidebarFields: React.FC<SidebarFieldsProps> = ({
  onInsertField,
  activeHighlightField,
  setActiveHighlightField,
  documentHtml,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("TODOS");

  // Conta a ocorrência de cada campo no documento de forma 100% segura contra falhas
  const fieldUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!documentHtml) return counts;

    try {
      ALL_EDITOR_FIELDS.forEach((f) => {
        const token1 = `{{${f.key}}}`;
        const token2 = f.defaultTag || "";

        const escaped1 = token1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match1 = (documentHtml.match(new RegExp(escaped1, "gi")) || []).length;

        let match2 = 0;
        if (token2) {
          const escaped2 = token2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          match2 = (documentHtml.match(new RegExp(escaped2, "gi")) || []).length;
        }

        counts[f.key] = match1 + match2;
      });
    } catch (err) {
      console.warn("Erro ao calcular contagem de campos:", err);
    }

    return counts;
  }, [documentHtml]);

  // Filtragem segura dos campos pela busca e categoria selecionada
  const filteredCategories = useMemo(() => {
    try {
      return EDITOR_FIELD_CATEGORIES.map((cat) => {
        if (selectedCategory !== "TODOS" && cat.category !== selectedCategory) {
          return { ...cat, fields: [] };
        }

        const matchingFields = (cat.fields || []).filter((f) => {
          if (!searchQuery) return true;
          const q = searchQuery.toLowerCase().trim();
          return (
            (f.label && f.label.toLowerCase().includes(q)) ||
            (f.key && f.key.toLowerCase().includes(q)) ||
            (f.desc && f.desc.toLowerCase().includes(q)) ||
            (f.defaultTag && f.defaultTag.toLowerCase().includes(q))
          );
        });

        return { ...cat, fields: matchingFields };
      }).filter((cat) => cat.fields && cat.fields.length > 0);
    } catch (e) {
      console.error("Erro ao filtrar categorias no sidebar:", e);
      return EDITOR_FIELD_CATEGORIES;
    }
  }, [searchQuery, selectedCategory]);

  const handleDragStart = (e: React.DragEvent, field: EditorFieldDef) => {
    try {
      e.dataTransfer.setData("application/json", JSON.stringify(field));
      e.dataTransfer.setData("text/plain", `{{${field.key}}}`);
      e.dataTransfer.effectAllowed = "copy";
    } catch (err) {
      console.warn("Drag start transfer error:", err);
    }
  };

  return (
    <aside className="w-80 border-r border-border bg-surface flex flex-col h-full overflow-hidden shrink-0 select-none shadow-sm z-10">
      {/* Header & Busca */}
      <div className="p-4 border-b border-border space-y-3 bg-background/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary animate-pulse" />
            <h3 className="font-display font-bold text-sm text-foreground">Campos do Sistema</h3>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
            {ALL_EDITOR_FIELDS.length} disponíveis
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, tag ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-input border border-border text-xs font-medium focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        {/* NAVEGAÇÃO DE CATEGORIAS SEGURA */}
        <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory("TODOS")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
              selectedCategory === "TODOS"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            Todos
          </button>
          {EDITOR_FIELD_CATEGORIES.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => setSelectedCategory(cat.category)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                selectedCategory === cat.category
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>
      </div>

      {/* Dica de Utilização */}
      <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Arraste para a folha ou clique para inserir:</span>
        <Sparkles className="h-3 w-3 text-primary shrink-0" />
      </div>

      {/* Lista de Campos Categorizados */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {filteredCategories.map((cat) => (
          <div key={cat.category} className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1 flex items-center justify-between">
              <span>{cat.category}</span>
              <span className="text-[9px] font-mono">({cat.fields?.length || 0})</span>
            </div>

            <div className="space-y-1.5">
              {(cat.fields || []).map((field) => {
                const count = fieldUsageCounts[field.key] || 0;
                const isHighlighted = activeHighlightField === field.key;

                return (
                  <div
                    key={field.key}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, field)}
                    onClick={() => {
                      setActiveHighlightField(field.key);
                      onInsertField(field);
                    }}
                    onMouseEnter={() => setActiveHighlightField(field.key)}
                    className={`p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing group relative ${
                      isHighlighted
                        ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/30"
                        : count > 0
                        ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                        : "border-border/80 bg-background hover:border-primary/40 hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {field.label}
                        </span>
                      </div>

                      {count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-success/15 border border-success/30 text-success text-[9px] font-bold font-mono shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {count}x
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/40 text-[10px]">
                      <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                        {`{{${field.key}}}`}
                      </span>
                      <span className="text-muted-foreground/80 truncate max-w-[120px]">
                        {field.sampleValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl space-y-1">
            <Tag className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
            <p className="font-bold">Nenhum campo encontrado</p>
            <p className="text-[10px]">Tente buscar por outros termos ou limpe o filtro.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
