import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ui-bits";
import { Download, Loader2, RefreshCw, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  generateProposalPreview,
  generateAndPersistProposal,
} from "@/lib/internal-proposal-generator";
import type { GeneratedProposal } from "@/services/proposal-service";

interface InternalProposalPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  budgetVersionId: string;
  eventName?: string;
  onProposalSaved?: (proposal: GeneratedProposal) => void;
}

export function InternalProposalPreviewModal({
  isOpen,
  onClose,
  eventId,
  budgetVersionId,
  eventName = "Evento",
  onProposalSaved,
}: InternalProposalPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [templateName, setTemplateName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    if (!eventId || !budgetVersionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateProposalPreview({
        eventId,
        budgetVersionId,
      });
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      setBlobUrl(res.blobUrl);
      setPageCount(res.renderResult.pageCount);
      setTemplateName(res.template.name);
    } catch (err: any) {
      console.error("[InternalProposalPreviewModal] Erro ao carregar preview:", err);
      setError(err?.message || "Não foi possível gerar a prévia do PDF.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, eventId, budgetVersionId]);

  const handlePersist = async () => {
    if (!eventId || !budgetVersionId) return;
    setPersisting(true);
    try {
      const result = await generateAndPersistProposal({
        eventId,
        budgetVersionId,
      });
      toast.success("Proposta Comercial em PDF gerada e salva com sucesso!");
      if (onProposalSaved) {
        onProposalSaved(result.proposal);
      }
      onClose();
    } catch (err: any) {
      console.error("[InternalProposalPreviewModal] Erro ao salvar proposta:", err);
      toast.error(err?.message || "Erro ao salvar proposta comercial.");
    } finally {
      setPersisting(false);
    }
  };

  const handleDownloadBlob = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `Previa - Proposta Comercial - ${eventName}.pdf`;
    a.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 px-6 border-b border-border flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Visualização da Proposta Comercial (PDF)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {templateName ? `Modelo: ${templateName} • ${pageCount} página(s)` : "Prévia em PDF real vetorial"}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPreview}
              disabled={loading || persisting}
              className="h-9 px-3 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Recarregar prévia"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            {blobUrl && (
              <button
                onClick={handleDownloadBlob}
                className="h-9 px-3 rounded-lg border border-border hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Baixar arquivo de prévia"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar Prévia
              </button>
            )}
            <PrimaryButton
              onClick={handlePersist}
              disabled={loading || persisting || !blobUrl}
              className="h-9 text-xs font-bold px-4"
            >
              {persisting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Gerar Proposta Oficial
            </PrimaryButton>
          </div>
        </DialogHeader>

        {/* Content Viewer */}
        <div className="flex-1 bg-muted/40 relative flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Gerando visualização em PDF...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 text-destructive max-w-md text-center p-6 bg-destructive/10 rounded-2xl border border-destructive/20">
              <AlertCircle className="h-8 w-8" />
              <div className="text-sm font-semibold">Falha na renderização da prévia</div>
              <p className="text-xs text-muted-foreground">{error}</p>
              <button
                onClick={loadPreview}
                className="mt-2 text-xs font-bold text-primary hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=0&navpanes=0`}
              title="Prévia da Proposta Comercial"
              className="w-full h-full border-0 bg-white"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
