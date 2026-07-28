import React, { useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Table,
  Type,
  Palette,
  Highlighter,
  Scissors,
  Copy,
  Clipboard,
  Undo2,
  Redo2,
  FileMinus,
  Search,
  RotateCcw,
  Plus,
  Trash2,
} from "lucide-react";

interface WordFormattingToolbarProps {
  onCommand: (command: string, value?: string) => void;
  onInsertTable?: () => void;
  onInsertPageBreak?: () => void;
  onOpenFindReplace?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const WordFormattingToolbar: React.FC<WordFormattingToolbarProps> = ({
  onCommand,
  onInsertTable,
  onInsertPageBreak,
  onOpenFindReplace,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [fontSize, setFontSize] = useState("3"); // execCommand size 1-7 (3 is ~12pt)
  const [textColor, setTextColor] = useState("#1e293b");
  const [bgColor, setBgColor] = useState("#ffffff");

  const exec = (cmd: string, val: string = "") => {
    document.execCommand(cmd, false, val);
    onCommand(cmd, val);
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFontFamily(val);
    exec("fontName", val);
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFontSize(val);
    exec("fontSize", val);
  };

  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextColor(val);
    exec("foreColor", val);
  };

  const handleBgColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBgColor(val);
    exec("hiliteColor", val);
  };

  return (
    <div className="w-full bg-background border-b border-border p-2 flex flex-wrap items-center gap-1.5 shrink-0 select-none shadow-sm z-20">
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 bg-surface p-1 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => (onUndo ? onUndo() : exec("undo"))}
          disabled={canUndo === false}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 transition-colors"
          title="Desfazer (Ctrl + Z)"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => (onRedo ? onRedo() : exec("redo"))}
          disabled={canRedo === false}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 transition-colors"
          title="Refazer (Ctrl + Y)"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Fonte e Tamanho */}
      <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border">
        <select
          value={fontFamily}
          onChange={handleFontFamilyChange}
          className="h-7 bg-background text-xs font-medium text-foreground border border-border rounded px-2 focus:outline-none cursor-pointer"
          title="Tipo da Fonte"
        >
          <option value="Arial, sans-serif">Arial</option>
          <option value="Calibri, sans-serif">Calibri</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Inter, sans-serif">Inter (Padrão)</option>
        </select>

        <select
          value={fontSize}
          onChange={handleFontSizeChange}
          className="h-7 bg-background text-xs font-medium text-foreground border border-border rounded px-1.5 focus:outline-none cursor-pointer"
          title="Tamanho da Fonte"
        >
          <option value="1">10pt</option>
          <option value="2">11pt</option>
          <option value="3">12pt (Padrão)</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
          <option value="7">36pt</option>
        </select>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Formatação Estilo de Texto */}
      <div className="flex items-center gap-0.5 bg-surface p-1 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Negrito (Ctrl + B)"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("italic")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Itálico (Ctrl + I)"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("underline")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Sublinhado (Ctrl + U)"
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("strikeThrough")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Tachado"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Cores Texto e Marca-texto */}
      <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-border">
        <label className="flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-background transition-colors" title="Cor do Texto">
          <Palette className="h-4 w-4 text-primary" />
          <input
            type="color"
            value={textColor}
            onChange={handleTextColorChange}
            className="w-4 h-4 rounded cursor-pointer border-none bg-transparent p-0"
          />
        </label>

        <label className="flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-background transition-colors" title="Cor de Destaque (Marca-texto)">
          <Highlighter className="h-4 w-4 text-warning" />
          <input
            type="color"
            value={bgColor}
            onChange={handleBgColorChange}
            className="w-4 h-4 rounded cursor-pointer border-none bg-transparent p-0"
          />
        </label>

        <button
          type="button"
          onClick={() => exec("removeFormat")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Limpar Formatação"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Alinhamento de Parágrafo */}
      <div className="flex items-center gap-0.5 bg-surface p-1 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => exec("justifyLeft")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Alinhar à Esquerda"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("justifyCenter")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Centralizar"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("justifyRight")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Alinhar à Direita"
        >
          <AlignRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("justifyFull")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Justificar"
        >
          <AlignJustify className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Listas e Recuos */}
      <div className="flex items-center gap-0.5 bg-surface p-1 rounded-lg border border-border">
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Lista com Marcadores"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Lista Numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("indent")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Aumentar Recuo"
        >
          <Indent className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => exec("outdent")}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Diminuir Recuo"
        >
          <Outdent className="h-4 w-4" />
        </button>
      </div>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Inserções: Tabela, Quebra de Página e Busca */}
      <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
        {onInsertTable && (
          <button
            type="button"
            onClick={onInsertTable}
            className="px-2 py-1 rounded text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors flex items-center gap-1"
            title="Inserir Tabela"
          >
            <Table className="h-3.5 w-3.5 text-primary" /> Tabela
          </button>
        )}

        {onInsertPageBreak && (
          <button
            type="button"
            onClick={onInsertPageBreak}
            className="px-2 py-1 rounded text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors flex items-center gap-1"
            title="Inserir Quebra de Página"
          >
            <FileMinus className="h-3.5 w-3.5 text-primary" /> Quebra de Página
          </button>
        )}

        {onOpenFindReplace && (
          <button
            type="button"
            onClick={onOpenFindReplace}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            title="Localizar e Substituir"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
