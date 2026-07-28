import React from "react";
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
} from "lucide-react";
import {
  validateContractPlaceholders,
  type ContractTemplate,
  type ContractSigner,
} from "@/services/contract-service";

interface ContractReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: ContractTemplate | null;
  signer: ContractSigner | null;
  eventName: string;
  compiledHtml: string;
  rawTemplateContent: string;
  compiledVariables: Record<string, any>;
  onConfirmSend: () => void;
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
  if (!isOpen) return null;

  // Validação estrita dos placeholders presentes no modelo
  const { filled, unfilled } = validateContractPlaceholders(
    rawTemplateContent,
    compiledVariables
  );

  const handlePrintPdf = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Contrato GOAT Bar - ${eventName}</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 40px; line-height: 1.6; color: #111; font-size: 13px; }
              table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
              h1, h2, h3 { font-weight: 700; margin-top: 1rem; }
            </style>
          </head>
          <body>${compiledHtml}</body>
        </html>
      `);
      win.document.close();
      win.print();
    }
  };

  const handleCopyText = () => {
    // Remove HTML tags for plain text copy fallback
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = compiledHtml;
    const textContent = tempDiv.innerText || tempDiv.textContent || "";
    navigator.clipboard.writeText(textContent);
    alert("Texto do contrato copiado com sucesso!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-3 md:p-6 overflow-hidden">
      <div className="w-full h-full max-w-6xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-success/15 rounded-xl flex items-center justify-center text-success font-bold shadow-inner">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Tela de Revisão e Validação do Contrato
              </h2>
              <p className="text-xs text-muted-foreground">
                Processo determinístico • Substituição estrita dos placeholders do modelo sem alteração de formatação
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

        {/* CORPO DE REVISÃO E PRÉVIA */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* PAINEL ESQUERDO: METADADOS E PAINEL DE VALIDAÇÃO (Col-span 4) */}
          <aside className="w-full lg:w-96 border-r border-border bg-background/40 p-4 space-y-4 overflow-y-auto shrink-0">
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
                  <span className="font-bold text-foreground truncate max-w-[160px]">
                    {template?.name || "Modelo Padrão"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Evento:
                  </span>
                  <span className="font-bold text-foreground truncate max-w-[160px]">
                    {eventName}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Sócio GOAT:
                  </span>
                  <span className="font-bold text-foreground truncate max-w-[160px]">
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
                  {filled.length} preenchidos / {unfilled.length} pendentes
                </span>
              </div>

              {/* Alerta de Campos Pendentes */}
              {unfilled.length > 0 ? (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
                    <span>{unfilled.length} campo(s) sem informação cadastrada</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Os seguintes placeholders do modelo não possuem dados no evento:
                  </p>
                  <ul className="space-y-1 max-h-36 overflow-y-auto">
                    {unfilled.map((item) => (
                      <li key={item.key} className="text-[11px] font-mono text-warning/90 bg-background/50 px-2 py-1 rounded border border-warning/20">
                        <b>{item.token}</b>: {item.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2 text-xs font-bold text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Todos os {filled.length} placeholders foram preenchidos com sucesso!</span>
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

          {/* PAINEL DIREITO: PRÉVIA DO CONTRATO GERADO */}
          <main className="flex-1 bg-muted/40 p-4 md:p-8 overflow-y-auto flex flex-col items-center">
            <div className="w-full max-w-[850px] bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 p-8 md:p-14 relative docx-canvas-paper min-h-[900px]">
              <div
                dangerouslySetInnerHTML={{ __html: compiledHtml }}
                className="text-sm leading-relaxed"
              />
            </div>
          </main>
        </div>

        {/* FOOTER */}
        <footer className="flex flex-wrap items-center justify-between px-6 py-4 bg-background/60 border-t border-border gap-3 shrink-0">
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
                onConfirmSend();
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
