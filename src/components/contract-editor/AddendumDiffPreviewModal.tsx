import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContractAddendumComparison } from "@/lib/contract-addendum-comparator";

interface AddendumDiffPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: ContractAddendumComparison | null;
  addendumNumber: number;
  compiledHtml: string;
  onConfirmGenerate: (condition: string, paymentMethod: string, dueDate: string) => Promise<void>;
  isLoading?: boolean;
}

export const AddendumDiffPreviewModal: React.FC<AddendumDiffPreviewModalProps> = ({
  isOpen,
  onClose,
  comparison,
  addendumNumber,
  compiledHtml,
  onConfirmGenerate,
  isLoading = false,
}) => {
  if (!comparison) return null;

  const [condition, setCondition] = useState(comparison.financial.paymentCondition || "");
  const [paymentMethod, setPaymentMethod] = useState(comparison.financial.paymentMethod || "");
  const [dueDate, setDueDate] = useState(comparison.financial.dueDate);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

  const handleConfirm = async () => {
    await onConfirmGenerate(condition, paymentMethod, dueDate);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileText className="h-5 w-5 text-primary" />
            Revisão de Alterações — Termo Aditivo nº {addendumNumber}
          </DialogTitle>
        </DialogHeader>

        {/* 1. Alerta de Crédito Excedente (Bloqueio) */}
        {comparison.financial.hasExcessPaymentCredit && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Crédito do cliente detectado</h4>
              <p className="text-sm mt-1">
                O novo valor contratual (<strong>{comparison.totalValue.currentFormatted}</strong>) é inferior ao valor já pago pelo cliente (<strong>{fmt(comparison.financial.paidAmount || 0)}</strong>).
              </p>
              <p className="text-xs mt-1 opacity-90">
                O snapshot registrará crédito de <strong>{fmt(comparison.financial.creditAmount)}</strong>; confirme no documento a destinação acordada com o cliente.
              </p>
            </div>
          </div>
        )}

        {/* 2. Resumo de Alterações Contratuais (De -> Para) */}
        <div className="space-y-4 my-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            1. Alterações Contratuais Detectadas
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card Drinks */}
            <div className={`p-3 rounded-lg border ${comparison.drinks.changed ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/30 border-muted"}`}>
              <div className="text-xs font-bold text-muted-foreground mb-1">DRINKS & BEBIDAS</div>
              {comparison.drinks.changed ? (
                <div className="text-xs space-y-1">
                  {comparison.drinks.added.length > 0 && (
                    <div className="text-emerald-600 font-medium">
                      + Adicionados: {comparison.drinks.added.join(", ")}
                    </div>
                  )}
                  {comparison.drinks.removed.length > 0 && (
                    <div className="text-rose-600 font-medium">
                      - Removidos: {comparison.drinks.removed.join(", ")}
                    </div>
                  )}
                  <div className="text-muted-foreground pt-1 border-t border-border/40">
                    <strong>Redação Final:</strong> {comparison.drinks.finalListText}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Sem alteração no cardápio
                </div>
              )}
            </div>

            {/* Card Valor Total */}
            <div className={`p-3 rounded-lg border ${comparison.totalValue.changed ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/30 border-muted"}`}>
              <div className="text-xs font-bold text-muted-foreground mb-1">VALOR TOTAL DO CONTRATO</div>
              {comparison.totalValue.changed ? (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{fmt(comparison.totalValue.previous)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <strong className="text-foreground font-bold">{comparison.totalValue.currentFormatted}</strong>
                  </div>
                  <div className={`font-semibold ${comparison.totalValue.difference > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    Diferença: {comparison.totalValue.difference > 0 ? "+" : ""}{fmt(comparison.totalValue.difference)}
                  </div>
                  <div className="text-[11px] text-muted-foreground italic">
                    ({comparison.totalValue.currentWords})
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Mantido ({comparison.totalValue.currentFormatted})
                </div>
              )}
            </div>

            {/* Card Convidado Excedente */}
            <div className={`p-3 rounded-lg border ${comparison.extraGuestValue.changed ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/30 border-muted"}`}>
              <div className="text-xs font-bold text-muted-foreground mb-1">VALOR POR CONVIDADO EXCEDENTE</div>
              {comparison.extraGuestValue.changed ? (
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{fmt(comparison.extraGuestValue.previous)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <strong className="text-foreground font-bold">{comparison.extraGuestValue.currentFormatted}</strong>
                  </div>
                  <div className="text-[11px] text-muted-foreground italic">
                    ({comparison.extraGuestValue.currentWords})
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Mantido ({comparison.extraGuestValue.currentFormatted})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Prestação de Contas Financeira */}
        <div className="space-y-3 my-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            2. Prestação de Contas Financeira
          </h3>

          <div className="bg-muted/40 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Novo Valor Total</div>
              <div className="text-lg font-bold">{comparison.totalValue.currentFormatted}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Já Pago pelo Cliente</div>
              <div className="text-lg font-bold text-emerald-600">{comparison.financial.paidAmount === null ? "Pendente" : fmt(comparison.financial.paidAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Saldo Remanescente a Pagar</div>
              <div className="text-lg font-bold text-primary">{comparison.financial.remainingBalance === null ? "Pendente" : fmt(comparison.financial.remainingBalance)}</div>
            </div>
          </div>
        </div>

        {/* 4. Formulário de Condição de Pagamento do Saldo */}
        <div className="space-y-3 my-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            3. Condições de Pagamento do Saldo Remanescente
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Condição *</label><select className="w-full h-10 rounded-md border bg-background px-3" value={condition} onChange={(e)=>setCondition(e.target.value)}><option value="">Selecione</option><option>À vista</option><option>Parcelado</option></select></div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Forma de Pagamento do Saldo *
              </label>
              <select className="w-full h-10 rounded-md border bg-background px-3" value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)}><option value="">Selecione</option><option>PIX</option><option>Transferência</option><option>Cartão</option><option>Boleto</option></select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Data(s) de Vencimento do Saldo *
              </label>
              <Input
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="Ex: 10/09/2026 ou 10/09/2026 e 10/10/2026"
              />
            </div>
          </div>
        </div>

        {/* 5. Alternador para Pré-visualização da Minuta */}
        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHtmlPreview(!showHtmlPreview)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showHtmlPreview ? "Ocultar pré-visualização da minuta" : "Ver pré-visualização da minuta gerada"}
          </Button>

          {showHtmlPreview && (
            <div
              className="mt-2 p-6 rounded border bg-white text-black font-sans text-xs max-h-60 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: compiledHtml }}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={comparison.financial.paidAmount === null || !condition || !paymentMethod || !dueDate.trim() || isLoading}
          >
            {isLoading ? "Gerando Aditivo..." : "Gerar Rascunho do Termo Aditivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
