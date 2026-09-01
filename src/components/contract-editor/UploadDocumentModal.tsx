import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import {
  contractDocumentService,
  DocumentType,
} from "@/services/contract-document-service";
import { eventContractsService } from "@/services/contract-service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  contractId?: string | null;
  addendumId?: string | null;
  onSuccess: () => void;
}

interface SelectedFileItem {
  id: string;
  file: File;
  documentName: string;
  documentType: DocumentType;
  manualSignatureDate: string;
  markAsFinalContract: boolean;
  status: "idle" | "uploading" | "success" | "error";
  errorMessage?: string;
}

interface AvailableContract {
  id: string;
  version: number | null;
  status: string | null;
  created_at: string | null;
}

export const UploadDocumentModal: React.FC<UploadDocumentModalProps> = ({
  open,
  onOpenChange,
  eventId,
  contractId,
  addendumId,
  onSuccess,
}) => {
  const [fileItems, setFileItems] = useState<SelectedFileItem[]>([]);
  const [isUploadingGlobal, setIsUploadingGlobal] = useState(false);
  const [availableContracts, setAvailableContracts] = useState<AvailableContract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string>("");

  useEffect(() => {
    if (open && eventId) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from("event_contracts")
            .select("id, version, status, created_at")
            .eq("event_id", eventId)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false });

          if (!error && data) {
            setAvailableContracts(data);
            if (data.length === 1) {
              setSelectedContractId(data[0].id);
            } else if (contractId && data.some((c) => c.id === contractId)) {
              setSelectedContractId(contractId);
            }
          }
        } catch (e) {
          console.warn("Erro ao buscar contratos do evento para o modal:", e);
        }
      })();
    }
  }, [open, eventId, contractId]);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    const newItems: SelectedFileItem[] = selected.map((file, idx) => {
      const isPdfContract = file.name.toLowerCase().includes("contrato") || idx === 0;
      const defaultType: DocumentType = isPdfContract ? "manual_signed_contract" : "attachment";

      return {
        id: crypto.randomUUID(),
        file,
        documentName: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        documentType: defaultType,
        manualSignatureDate: todayStr,
        markAsFinalContract: defaultType === "manual_signed_contract",
        status: "idle",
      };
    });

    setFileItems((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const handleRemoveItem = (id: string) => {
    setFileItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<SelectedFileItem>) => {
    setFileItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };

        if (updates.documentType && updates.documentType !== "manual_signed_contract") {
          updated.markAsFinalContract = false;
        }

        return updated;
      }),
    );
  };

  const handleStartUpload = async () => {
    if (fileItems.length === 0) {
      toast.error("Selecione pelo menos um arquivo para envio.");
      return;
    }

    if (availableContracts.length > 1 && !selectedContractId && !addendumId) {
      toast.error("Selecione qual contrato deseja vincular aos documentos.");
      return;
    }

    setIsUploadingGlobal(true);

    let batchContractId: string | null = selectedContractId || contractId || null;

    // Resolve ou cria o contrato UMA ÚNICA VEZ antes do lote de uploads para evitar race conditions
    if (!batchContractId && !addendumId) {
      try {
        const hasMainDoc = fileItems.some(
          (i) => ["manual_signed_contract", "signed_contract"].includes(i.documentType) || i.markAsFinalContract,
        );

        if (!hasMainDoc && availableContracts.length === 0) {
          toast.error("Nenhum contrato existente para este evento. Envie primeiro o contrato principal antes de anexos.");
          setIsUploadingGlobal(false);
          return;
        }

        const resolved = await eventContractsService.getOrCreateContractForEvent(
          eventId,
          null,
        );
        batchContractId = resolved.id;
      } catch (err: any) {
        toast.error(`Falha ao resolver contrato para o lote: ${err.message}`);
        setIsUploadingGlobal(false);
        return;
      }
    }

    let successCount = 0;

    for (const item of fileItems) {
      if (item.status === "success") {
        successCount++;
        continue;
      }

      handleUpdateItem(item.id, { status: "uploading", errorMessage: undefined });

      try {
        await contractDocumentService.uploadDocument({
          file: item.file,
          eventId,
          contractId: batchContractId,
          addendumId,
          documentType: item.documentType,
          documentName: item.documentName || item.file.name,
          isSigned: item.documentType === "manual_signed_contract",
          manualSignatureDate: item.manualSignatureDate,
          markAsFinalContract: item.markAsFinalContract,
          source: "manual",
        });

        handleUpdateItem(item.id, { status: "success" });
        successCount++;
      } catch (err: any) {
        console.error(`[UploadDocumentModal] Erro ao enviar ${item.file.name}:`, err);
        handleUpdateItem(item.id, {
          status: "error",
          errorMessage: err.message || "Falha ao enviar arquivo.",
        });
      }
    }

    setIsUploadingGlobal(false);

    if (successCount === fileItems.length) {
      toast.success(`${successCount} documento(s) enviado(s) com sucesso!`);
      setFileItems([]);
      onSuccess();
      onOpenChange(false);
    } else {
      toast.warning(`${successCount} de ${fileItems.length} arquivo(s) enviados. Verifique os itens com erro.`);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-surface border border-border p-6 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            Upload de Documentos Contratuais & Anexos
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione um ou múltiplos arquivos (PDF, Imagens, Word - Máx 25 MB por arquivo). Todos os documentos serão armazenados no repositório próprio da GOAT Bar.
          </p>
        </DialogHeader>

        <div className="space-y-6 my-4">
          {/* Seletor de Contrato se houver mais de um contrato ativo */}
          {availableContracts.length > 1 && !addendumId && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                Múltiplos Contratos Ativos Encontrados
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Este evento possui mais de um contrato ativo. Selecione qual contrato deseja vincular aos documentos deste lote:
              </p>
              <Select
                value={selectedContractId}
                disabled={isUploadingGlobal}
                onValueChange={(val) => setSelectedContractId(val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background text-foreground mt-1">
                  <SelectValue placeholder="Selecione o contrato..." />
                </SelectTrigger>
                <SelectContent>
                  {availableContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Contrato v{c.version || 1} (Criado em {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "---"} — Status: {c.status?.toUpperCase() || "N/A"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Área de Seleção de Arquivos */}
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-background/50 text-center space-y-3">
            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <Label
                htmlFor="multi-file-input"
                className="cursor-pointer text-sm font-bold text-primary hover:underline"
              >
                Clique aqui para selecionar 1 ou mais arquivos
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Suporta PDFs, imagens scan e anexos complementares.
              </p>
            </div>
            <Input
              id="multi-file-input"
              type="file"
              multiple
              accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={isUploadingGlobal}
              onChange={handleSelectFiles}
            />
          </div>

          {/* Lista de Arquivos Selecionados */}
          {fileItems.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Arquivos Selecionados ({fileItems.length})
              </h4>

              {fileItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-border bg-background space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <span className="font-bold text-sm truncate" title={item.file.name}>
                        {item.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(item.file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "uploading" && (
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...
                        </span>
                      )}
                      {item.status === "success" && (
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Enviado
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="text-xs font-bold text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-destructive" /> Erro
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUploadingGlobal}
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {item.errorMessage && (
                    <div className="p-2 rounded bg-destructive/10 text-destructive text-xs">
                      {item.errorMessage}
                    </div>
                  )}

                  {/* Metadados do Arquivo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-border/40">
                    <div>
                      <Label className="text-[11px] font-bold text-muted-foreground">
                        Nome Exibido
                      </Label>
                      <Input
                        value={item.documentName}
                        disabled={isUploadingGlobal || item.status === "success"}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { documentName: e.target.value })
                        }
                        className="h-8 text-xs mt-1"
                        placeholder="Nome legível do documento"
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-bold text-muted-foreground">
                        Tipo de Documento
                      </Label>
                      <Select
                        value={item.documentType}
                        disabled={isUploadingGlobal || item.status === "success"}
                        onValueChange={(val: DocumentType) =>
                          handleUpdateItem(item.id, { documentType: val })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual_signed_contract">
                            Contrato Assinado (Manual)
                          </SelectItem>
                          <SelectItem value="attachment">Anexo / Complementar</SelectItem>
                          <SelectItem value="signed_addendum">
                            Termo Aditivo Assinado
                          </SelectItem>
                          <SelectItem value="other">Outro Documento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] font-bold text-muted-foreground">
                        Data da Assinatura Manual
                      </Label>
                      <Input
                        type="date"
                        value={item.manualSignatureDate}
                        disabled={
                          isUploadingGlobal ||
                          item.status === "success" ||
                          item.documentType !== "manual_signed_contract"
                        }
                        onChange={(e) =>
                          handleUpdateItem(item.id, { manualSignatureDate: e.target.value })
                        }
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  {/* Toggle para confirmar contrato final assinado */}
                  {item.documentType === "manual_signed_contract" && (
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox
                        id={`mark-final-${item.id}`}
                        checked={item.markAsFinalContract}
                        disabled={isUploadingGlobal || item.status === "success"}
                        onCheckedChange={(chk) =>
                          handleUpdateItem(item.id, { markAsFinalContract: !!chk })
                        }
                      />
                      <Label
                        htmlFor={`mark-final-${item.id}`}
                        className="text-xs font-semibold cursor-pointer text-foreground"
                      >
                        Marcar este documento como o Contrato Final Assinado do Evento (Muda status para CONFIRMADO)
                      </Label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isUploadingGlobal}
            onClick={() => onOpenChange(false)}
            className="h-10"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isUploadingGlobal || fileItems.length === 0}
            onClick={handleStartUpload}
            className="h-10 font-bold bg-primary text-white hover:bg-primary/90"
          >
            {isUploadingGlobal ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando Documentos...
              </>
            ) : (
              `Enviar ${fileItems.length} Documento(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
