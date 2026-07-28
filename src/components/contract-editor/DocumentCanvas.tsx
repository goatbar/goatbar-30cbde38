import React, { useRef, useEffect, useState, useCallback } from "react";
import { Upload, Trash2, Tag, Check, Layers, FileText } from "lucide-react";
import { ALL_EDITOR_FIELDS, type EditorFieldDef } from "./contract-editor-store";
import { CONTRACT_DOCUMENT_CSS } from "@/lib/contract-document-styles";


interface DocumentCanvasProps {
  html: string;
  onContentChange: (newHtml: string) => void;
  zoom: number;
  activeHighlightField: string | null;
  setActiveHighlightField: (key: string | null) => void;
  onDocxUpload: (file: File) => void;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  html,
  onContentChange,
  zoom,
  activeHighlightField,
  setActiveHighlightField,
  onDocxUpload,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sanitiza e formata visualmente todas as tags {{campo}} para Chips visuais
  const formatHtmlWithChips = useCallback((rawHtml: string): string => {
    if (!rawHtml) return "";

    let processed = rawHtml;

    ALL_EDITOR_FIELDS.forEach((field) => {
      const keysToMatch = [
        `{{${field.key}}}`,
        `{{ ${field.key} }}`,
        field.defaultTag,
      ];

      keysToMatch.forEach((token) => {
        if (!token) return;
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "gi");

        const chipHtml = `<span class="docx-field-chip" data-field-key="${field.key}" contenteditable="false" title="Campo Mapeado: ${field.label}">${token}<button class="docx-chip-del" data-delete-key="${field.key}">×</button></span>`;

        processed = processed.replace(regex, chipHtml);
      });
    });

    return processed;
  }, []);

  // Ao montar ou atualizar o HTML inicial de fora, popula a folha se diferente
  useEffect(() => {
    if (canvasRef.current) {
      const currentInner = canvasRef.current.innerHTML;
      if (currentInner !== html && !canvasRef.current.contains(document.activeElement)) {
        canvasRef.current.innerHTML = formatHtmlWithChips(html);
      }
    }
  }, [html, formatHtmlWithChips]);

  // Captura cliques nos botões de exclusão de chips ou destaque bidirecional
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Clique no botão × do chip para remover o campo
    if (target && target.classList.contains("docx-chip-del")) {
      e.preventDefault();
      e.stopPropagation();
      const chipParent = target.closest(".docx-field-chip");
      if (chipParent) {
        chipParent.remove();
        if (canvasRef.current) {
          onContentChange(canvasRef.current.innerHTML);
        }
      }
      return;
    }

    // Clique no chip para destacar o campo na sidebar
    const chip = target.closest(".docx-field-chip") as HTMLElement;
    if (chip) {
      const key = chip.getAttribute("data-field-key");
      if (key) setActiveHighlightField(key);
    }
  };

  const handleInput = () => {
    if (canvasRef.current) {
      onContentChange(canvasRef.current.innerHTML);
    }
  };

  // Trata Drag & Drop na Folha A4
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const json = e.dataTransfer.getData("application/json");
      if (!json) return;
      const field: EditorFieldDef = JSON.parse(json);

      const placeholderToken = `{{${field.key}}}`;
      const chipHtml = `<span class="docx-field-chip" data-field-key="${field.key}" contenteditable="false" title="Campo Mapeado: ${field.label}">${placeholderToken}<button class="docx-chip-del" data-delete-key="${field.key}">×</button></span>&nbsp;`;

      // Tenta encontrar a posição onde o usuário soltou o mouse no texto
      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }

      if (range && canvasRef.current && canvasRef.current.contains(range.startContainer)) {
        range.deleteContents();
        const el = document.createElement("div");
        el.innerHTML = chipHtml;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
      } else if (canvasRef.current) {
        canvasRef.current.insertAdjacentHTML("beforeend", chipHtml);
      }

      if (canvasRef.current) {
        onContentChange(canvasRef.current.innerHTML);
      }
      setActiveHighlightField(field.key);
    } catch (err) {
      console.warn("Error handling field drop:", err);
    }
  };

  return (
    <main className="flex-1 bg-muted/40 p-4 md:p-8 overflow-y-auto flex flex-col items-center select-text relative">
      {/* Indicador de Páginas Contínuas */}
      {html && (
        <div className="mb-3 px-3 py-1 bg-background/80 border border-border rounded-full text-[11px] font-bold text-muted-foreground flex items-center gap-2 shadow-sm">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>Documento Carregado • 100% das páginas acessíveis e editáveis</span>
        </div>
      )}

      {/* Container de Escala do Zoom */}
      <div
        className="transition-transform duration-150 ease-out origin-top flex flex-col items-center w-full"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        {/* Folha A4 Canvas Contínua sem limitação de altura */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleCanvasClick}
          className={`w-full max-w-[850px] min-h-[1100px] h-auto bg-white text-slate-900 rounded-xl shadow-2xl border transition-all p-8 md:p-14 relative docx-canvas-paper ${
            isDragOver
              ? "border-primary ring-4 ring-primary/20 bg-primary/5"
              : "border-slate-200"
          }`}
        >
          {/* Mensagem quando vazio */}
          {!html && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4 pointer-events-none">
              <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                <Upload className="h-8 w-8 animate-bounce" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-700">Nenhum documento carregado</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Arraste seu arquivo <b>.DOCX</b> para esta área ou clique no botão acima para importar seu modelo de contrato com 100% das páginas e formatação.
                </p>
              </div>

              <label className="pointer-events-auto cursor-pointer bg-primary text-primary-foreground font-bold text-xs px-4 py-2 rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center gap-2">
                <Upload className="h-4 w-4" /> Selecionar Arquivo .DOCX
                <input
                  type="file"
                  accept=".docx,.txt,.html"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onDocxUpload(f);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Editable Document DOM */}
          <div
            ref={canvasRef}
            contentEditable={true}
            onInput={handleInput}
            className="outline-none min-h-[950px] text-sm leading-relaxed overflow-visible"
          />
        </div>
      </div>

      {/* Estilos para Badges/Chips e Regras Multi-página */}
      <style>{CONTRACT_DOCUMENT_CSS}</style>
    </main>

  );
};
