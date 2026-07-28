import React, { useRef, useState, useEffect } from "react";
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  X,
  FileSignature,
  UserCheck,
  Calendar,
  Building2,
  Search,
} from "lucide-react";
import {
  validateContractPlaceholders,
  type ContractTemplate,
  type ContractSigner,
} from "@/services/contract-service";
import { WordFormattingToolbar } from "./WordFormattingToolbar";
import { normalizeEditorHtml } from "@/utils/normalize-editor-html";
import { prepareContractExportHtml } from "@/utils/prepare-contract-export-html";
import { CONTRACT_DOCUMENT_CSS, CONTRACT_PRINT_HTML_SHELL } from "@/lib/contract-document-styles";

interface ContractReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: ContractTemplate | null;
  signer: ContractSigner | null;
  eventName: string;
  compiledHtml: string;
  rawTemplateContent: string;
  compiledVariables: Record<string, any>;
  onConfirmSend: (finalCleanHtml?: string) => void;
}

export const ContractReviewModal: React.FC<ContractReviewModalProps> = ({
  isOpen,
  onClose,
  template,
  signer,
  eventName,
  compiledHtml,
  rawTemplateContent,
  compiledVariables,
  onConfirmSend,
}) => {
  // Estado CANÔNICO ÚNICO do HTML na revisão
  const [reviewHtml, setReviewHtml] = useState(compiledHtml);
  const editorRef = useRef<HTMLDivElement>(null);

  // Modal de Busca e Substituição
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  useEffect(() => {
    setReviewHtml(compiledHtml);
  }, [compiledHtml]);

  if (!isOpen) return null;

  // Validação estrita dos placeholders presentes no modelo
  const { filled, unfilled } = validateContractPlaceholders(
    rawTemplateContent,
    compiledVariables
  );

  const handlePrintPdf = () => {
    const exportHtml = prepareContractExportHtml(reviewHtml);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(CONTRACT_PRINT_HTML_SHELL(`Contrato GOAT Bar - ${eventName}`, exportHtml));
      win.document.close();
      win.print();
    }
  };

  const handleCopyText = () => {
    const exportHtml = prepareContractExportHtml(reviewHtml);
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = exportHtml;
    const textContent = tempDiv.innerText || tempDiv.textContent || "";
    navigator.clipboard.writeText(textContent);
    alert("Texto do contrato copiado com sucesso!");
  };



  const handleInsertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:1rem 0; border:1px solid #cbd5e1;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Item</th>
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Descrição</th>
            <th style="border:1px solid #cbd5e1; padding:8px; text-align:left;">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:8px;">01</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">Serviço de Bar de Coquetéis</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">Incluso</td>
          </tr>
        </tbody>
      </table>&nbsp;
    `;
    document.execCommand("insertHTML", false, tableHtml);
  };

  const handleInsertPageBreak = () => {
    const breakHtml = `<div style="page-break-after:always; break-after:page; border-bottom:2px dashed #6366f1; text-align:center; color:#6366f1; font-size:10px; font-weight:bold; margin:2rem 0; padding:4px;" contenteditable="false">--- QUEBRA DE PÁGINA ---</div><p>&nbsp;</p>`;
    document.execCommand("insertHTML", false, breakHtml);
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "gi");
      const updated = currentHtml.replace(regex, replaceText);
      editorRef.current.innerHTML = updated;
      setEditableContent(updated);
      setShowFindReplace(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-2 md:p-4 overflow-hidden">
      <div className="w-full h-full max-w-[1500px] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-success/15 rounded-xl flex items-center justify-center text-success font-bold shadow-inner">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                Revisão e Ajustes de Formatação do Contrato (Estilo Word)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Substituição determinística dos placeholders • Ajuste fino de texto, fontes, recuos e parágrafos antes da emissão
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* BARRA DE FERRAMENTAS ESTILO WORD */}
        <WordFormattingToolbar
          onCommand={(cmd, val) => {
            if (editorRef.current) {
              setEditableContent(editorRef.current.innerHTML);
            }
          }}
          onInsertTable={handleInsertTable}
          onInsertPageBreak={handleInsertPageBreak}
          onOpenFindReplace={() => setShowFindReplace(true)}
        />

        {/* CORPO DE REVISÃO E PRÉVIA */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* PAINEL ESQUERDO: METADADOS E PAINEL DE VALIDAÇÃO (Col-span 4) */}
          <aside className="w-full lg:w-80 border-r border-border bg-background/40 p-4 space-y-4 overflow-y-auto shrink-0 select-none">
            {/* Metadados da Emissão */}
            <div className="p-3.5 bg-surface border border-border rounded-xl space-y-2.5">
              <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <FileSignature className="h-3.5 w-3.5" /> Metadados da Emissão
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <FileSignature className="h-3 w-3" /> Modelo:
                  </span>
                  <span className="font-bold text-foreground truncate max-w-[140px]">
                    {template?.name || "Modelo Padrão"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Evento:
                  </span>
                  <span className="font-bold text-foreground truncate max-w-[140px]">
                    {eventName}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Sócio GOAT:
                  </span>
                  <span className="font-bold text-foreground truncate max-w-[140px]">
                    {signer?.name || "Não selecionado"}
                  </span>
                </div>
              </div>
            </div>

            {/* Painel de Validação de Placeholders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">Status dos Campos no Modelo</h4>
                <span className="text-[10px] font-bold text-muted-foreground font-mono">
                  {filled.length} ok / {unfilled.length} pendentes
                </span>
              </div>

              {/* Alerta de Campos Pendentes */}
              {unfilled.length > 0 ? (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
                    <span>{unfilled.length} campo(s) sem informação</span>
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {unfilled.map((item) => (
                      <li key={item.key} className="text-[10px] font-mono text-warning/90 bg-background/50 px-2 py-0.5 rounded border border-warning/20">
                        <b>{item.token}</b>: {item.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2 text-xs font-bold text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Todos os {filled.length} placeholders validados!</span>
                </div>
              )}

              {/* Lista de Campos Preenchidos */}
              <div className="space-y-1 max-h-56 overflow-y-auto">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Placeholders Identificados ({filled.length})
                </div>
                {filled.map((item) => (
                  <div key={item.key} className="p-2 rounded-lg bg-surface border border-border/80 text-[11px] space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-primary">{item.token}</span>
                      <span className="text-[9px] text-success font-bold bg-success/15 px-1.5 py-0.2 rounded">✓ OK</span>
                    </div>
                    <p className="text-muted-foreground truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* PAINEL DIREITO: EDITOR VISUAL CANVASA A4 FORMATÁVEL ESTILO WORD */}
          <main className="flex-1 bg-muted/40 p-4 md:p-8 overflow-y-auto flex flex-col items-center">
            <style>{CONTRACT_DOCUMENT_CSS}</style>
            <div className="w-full max-w-[850px] min-h-[1100px] bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 p-8 md:p-14 relative docx-canvas-paper">
              <div
                ref={editorRef}
                contentEditable={true}
                onInput={(e) => {
                  setReviewHtml(e.currentTarget.innerHTML);
                }}
                dangerouslySetInnerHTML={{ __html: reviewHtml }}
                className="outline-none min-h-[950px] text-sm leading-relaxed bg-white text-slate-900"
              />


            </div>
          </main>

        </div>

        {/* MODAL DE BUSCA E SUBSTITUIÇÃO */}
        {showFindReplace && (
          <div className="absolute top-16 right-8 z-30 w-80 bg-surface border border-border rounded-xl shadow-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-primary" /> Localizar e Substituir
              </h4>
              <button onClick={() => setShowFindReplace(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <input
                type="text"
                placeholder="Localizar texto..."
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-input border border-border focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Substituir por..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-input border border-border focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleReplaceAll}
                className="w-full h-8 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Substituir Tudo
              </button>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="flex flex-wrap items-center justify-between px-6 py-3 bg-background/60 border-t border-border gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-background text-xs font-bold text-foreground transition-colors flex items-center gap-2 shadow-sm"
          >
            <Copy className="h-4 w-4 text-primary" />
            <span>Copiar Minuta</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-background text-xs font-bold text-foreground transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download className="h-4 w-4 text-primary" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const exportHtml = prepareContractExportHtml(reviewHtml);
                onConfirmSend(exportHtml);
                onClose();
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-2"
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Aprovar e Enviar para Assinatura</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
