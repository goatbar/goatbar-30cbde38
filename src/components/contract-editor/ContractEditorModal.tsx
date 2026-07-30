import React, { useState, useEffect, useCallback } from "react";
import {
  FileCode,
  Upload,
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import mammoth from "mammoth";
import {
  useContractEditorStore,
  type EditorFieldDef,
} from "./contract-editor-store";
type ContractTemplate = any; // Tipagem legada supabase
import { SidebarFields } from "./SidebarFields";
import { DocumentCanvas } from "./DocumentCanvas";
import {
  contractTemplatesService,
  getTemplateContent,
} from "@/services/contract-service";
import { WordFormattingToolbar } from "./WordFormattingToolbar";
import { normalizeEditorHtml } from "@/utils/normalize-editor-html";


interface ContractEditorModalProps {
  template: ContractTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ContractEditorModal: React.FC<ContractEditorModalProps> = ({
  template,
  isOpen,
  onClose,
  onSaved,
}) => {
  const initialHtml = template ? getTemplateContent(template) : "";
  const store = useContractEditorStore(initialHtml, template?.id);

  const [templateName, setTemplateName] = useState(template?.name || "");
  const [isDefault, setIsDefault] = useState(!!template?.is_default);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setTemplateName(template.name);
      setIsDefault(!!template.is_default);
    } else {
      setTemplateName("");
      setIsDefault(false);
    }
    setSelectedFile(null);
  }, [template]);

  // Listener para atalhos de teclado CTRL+Z e CTRL+SHIFT+Z
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          store.redo();
        } else {
          e.preventDefault();
          store.undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, store]);

  const handleDocxUpload = async (file: File) => {
    setSelectedFile(file);
    if (!templateName) {
      setTemplateName(file.name.replace(/\.[^/.]+$/, ""));
    }

    try {
      if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (result.value) {
          store.setHtml(result.value, `ImportaÃ§Ã£o ${file.name}`);
        }
      } else {
        const text = await file.text();
        store.setHtml(text, `ImportaÃ§Ã£o ${file.name}`);
      }
    } catch (err) {
      console.error("Erro ao importar arquivo DOCX:", err);
      alert("NÃ£o foi possÃ­vel ler o arquivo enviado. Certifique-se de que Ã© um arquivo .docx vÃ¡lido.");
    }
  };

  const handleInsertFieldFromSidebar = (field: EditorFieldDef) => {
    const token = `{{${field.key}}}`;
    const chipHtml = `<span class="docx-field-chip" data-field-key="${field.key}" contenteditable="false" title="Campo Mapeado: ${field.label}">${token}<button class="docx-chip-del" data-delete-key="${field.key}">Ã—</button></span>&nbsp;`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const div = document.createElement("div");
      div.innerHTML = chipHtml;
      const frag = document.createDocumentFragment();
      let node;
      while ((node = div.firstChild)) {
        frag.appendChild(node);
      }
      range.insertNode(frag);
      sel.removeAllRanges();
      const canvasEl = document.querySelector(".docx-canvas-paper [contenteditable]");
      if (canvasEl) {
        store.setHtml(canvasEl.innerHTML, `Inserir ${field.label}`);
      }
      return;
    }

    // Se nÃ£o hÃ¡ texto selecionado, insere no final ou posiÃ§Ã£o ativa
    const currentHtml = store.html || "";
    store.setHtml(currentHtml + ` ${chipHtml} `, `Inserir ${field.label}`);
  };

  const handleSave = async () => {
    if (!templateName) return alert("Informe o nome do modelo de contrato.");
    if (!store.html || store.html.trim().length < 10)
      return alert("O documento nÃ£o possui conteÃºdo para ser salvo.");

    setIsSaving(true);
    try {
      let publicUrl = template?.file_url || "";
      let filePath = template?.file_path || "";
      let fileType = template?.file_type || "DOCX";

      if (selectedFile) {
        const res = await contractTemplatesService.uploadTemplateFile(selectedFile);
        publicUrl = res.publicUrl;
        filePath = res.filePath;
        fileType = selectedFile.name.split(".").pop()?.toUpperCase() || "DOCX";
      }

      const cleanHtmlToSave = normalizeEditorHtml(store.html);

      const payload = {
        name: templateName,
        description: cleanHtmlToSave,
        file_url: publicUrl,
        file_path: filePath,
        file_type: fileType,
        is_default: isDefault,
        status: "active",
        variables_schema: { content: cleanHtmlToSave } as any /* tipagem legada */,
      };


      if (template) {
        await contractTemplatesService.updateTemplate(template.id, payload);
        if (isDefault) {
          await contractTemplatesService.setDefaultTemplate(template.id);
        }
      } else {
        const created = await contractTemplatesService.createTemplate(payload);
        if (isDefault && created?.id) {
          await contractTemplatesService.setDefaultTemplate(created.id);
        }
      }

      store.markSaved();
      alert("Modelo de contrato salvo com sucesso!");
      onSaved();
      onClose();
    } catch (e: any) {
      console.error("Erro ao salvar modelo no editor:", e);
      alert(`Erro ao salvar: ${e.message || "Erro desconhecido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-2 md:p-4 overflow-hidden">
      <div className="w-full h-full max-w-[1600px] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* TOP TOOLBAR */}
        <header className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-border bg-background/60 gap-4 shrink-0">
          {/* Esquerda: Ãcone + TÃ­tulo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold shadow-inner">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Nome do Modelo (ex: Contrato PadrÃ£o GOAT Bar)"
                  className="font-display font-bold text-base bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 text-foreground"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Editor Profissional de Contratos â€¢ Preserva formataÃ§Ã£o original do Word
              </p>
            </div>
          </div>

          {/* Centro: Controles de HistÃ³rico Undo/Redo & Zoom */}
          <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-xl border border-border">
            {/* Undo / Redo */}
            <button
              type="button"
              onClick={store.undo}
              disabled={!store.canUndo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Desfazer (Ctrl + Z)"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={store.redo}
              disabled={!store.canRedo}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Refazer (Ctrl + Shift + Z)"
            >
              <Redo2 className="h-4 w-4" />
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Zoom Controls */}
            <button
              type="button"
              onClick={() => store.setZoom(Math.max(50, store.zoom - 25))}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title="Diminuir Zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <select
              value={store.zoom}
              onChange={(e) => store.setZoom(Number(e.target.value))}
              className="bg-transparent text-xs font-mono font-bold text-foreground focus:outline-none cursor-pointer px-1"
            >
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
              <option value={200}>200%</option>
            </select>
            <button
              type="button"
              onClick={() => store.setZoom(Math.min(200, store.zoom + 25))}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title="Aumentar Zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Direita: Auto-save status, Upload & Save */}
          <div className="flex items-center gap-3">
            {/* Auto-save badge */}
            <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 hidden md:flex">
              {store.isAutoSaved ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span>Salvo {store.lastSavedTime ? `Ã s ${store.lastSavedTime}` : ""}</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  <span>AlteraÃ§Ãµes pendentes...</span>
                </>
              )}
            </div>

            {/* Upload Button */}
            <label className="cursor-pointer bg-surface hover:bg-background border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-foreground transition-colors flex items-center gap-1.5 shadow-sm">
              <Upload className="h-3.5 w-3.5 text-primary" />
              <span>{selectedFile ? selectedFile.name : "Importar .DOCX"}</span>
              <input
                type="file"
                accept=".docx,.txt,.html"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocxUpload(f);
                }}
                className="hidden"
              />
            </label>

            {/* Checkbox Modelo PadrÃ£o */}
            <div className="flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1.5 rounded-xl text-xs">
              <input
                type="checkbox"
                id="is_default_modal_check"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="is_default_modal_check" className="cursor-pointer text-muted-foreground font-medium">
                PadrÃ£o
              </label>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4 py-2 rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Modelo
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* BARRA DE FERRAMENTAS ESTILO WORD */}
        <WordFormattingToolbar
          onCommand={(cmd, val) => {
            const canvasEl = document.querySelector(".docx-canvas-paper [contenteditable]");
            if (canvasEl) {
              store.setHtml(canvasEl.innerHTML, `FormataÃ§Ã£o (${cmd})`);
            }
          }}
          onInsertTable={() => {
            const tableHtml = `
              <table style="width:100%; border-collapse:collapse; margin:1rem 0; border:1px solid #cbd5e1;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Item</th>
                    <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">DescriÃ§Ã£o</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="border:1px solid #cbd5e1; padding:8px;">01</td>
                    <td style="border:1px solid #cbd5e1; padding:8px;">DescriÃ§Ã£o do serviÃ§o</td>
                  </tr>
                </tbody>
              </table>&nbsp;
            `;
            document.execCommand("insertHTML", false, tableHtml);
            const canvasEl = document.querySelector(".docx-canvas-paper [contenteditable]");
            if (canvasEl) {
              store.setHtml(canvasEl.innerHTML, "Inserir Tabela");
            }
          }}
          onInsertPageBreak={() => {
            const breakHtml = `<div style="page-break-after:always; break-after:page; border-bottom:2px dashed #6366f1; text-align:center; color:#6366f1; font-size:10px; font-weight:bold; margin:2rem 0; padding:4px;" contenteditable="false">--- QUEBRA DE PÃGINA ---</div><p>&nbsp;</p>`;
            document.execCommand("insertHTML", false, breakHtml);
            const canvasEl = document.querySelector(".docx-canvas-paper [contenteditable]");
            if (canvasEl) {
              store.setHtml(canvasEl.innerHTML, "Inserir Quebra de PÃ¡gina");
            }
          }}
          canUndo={store.canUndo}
          canRedo={store.canRedo}
          onUndo={store.undo}
          onRedo={store.redo}
        />

        {/* CORPO DO EDITOR: Sidebar Fixa (Esquerda) + Folha Canvas A4 (Direita) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Fixa IndestrutÃ­vel */}
          <SidebarFields
            onInsertField={handleInsertFieldFromSidebar}
            activeHighlightField={store.activeHighlightField}
            setActiveHighlightField={store.setActiveHighlightField}
            documentHtml={store.html}
          />

          {/* Folha A4 Canvas Zoomable */}
          <DocumentCanvas
            html={store.html}
            onContentChange={(newHtml) => store.setHtml(newHtml, "AlteraÃ§Ã£o no documento")}
            zoom={store.zoom}
            activeHighlightField={store.activeHighlightField}
            setActiveHighlightField={store.setActiveHighlightField}
            onDocxUpload={handleDocxUpload}
          />
        </div>
      </div>
    </div>
  );
};

