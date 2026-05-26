import React, { useEffect, useState } from "react";
import { financialService, type FinancialExpense, type FinancialExpenseItem } from "@/services/financial-service";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, FileText } from "lucide-react";
import { fmtBRL } from "@/lib/format";

export function ComprasNotinhasTab({ eventId }: { eventId: string }) {
  const [expenses, setExpenses] = useState<FinancialExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await financialService.listExpenses({ modality: "Evento" });
        const eventExpenses = res.filter(e => e.event_id === eventId);
        
        // Fetch items for each expense
        const withItems = await Promise.all(eventExpenses.map(async (exp) => {
          // This is a naive way, but financialService doesn't have getExpenseItems.
          // We can just rely on the UI for now or add getExpenseItems to financialService later.
          return exp;
        }));
        
        setExpenses(withItems);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [eventId]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando despesas...</div>;

  const total = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold font-display">Compras e Notinhas do Evento</h2>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total em despesas</p>
          <p className="text-xl font-bold text-primary">{fmtBRL(total)}</p>
        </div>
      </div>
      
      {expenses.length === 0 ? (
        <div className="text-center p-12 border border-dashed border-border rounded-xl">
          <Search className="h-8 w-8 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-bold text-lg mb-2">Nenhuma notinha vinculada</h3>
          <p className="text-muted-foreground">Vá até o módulo de Controladoria e anexe notinhas selecionando este evento.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {expenses.map(exp => (
            <div key={exp.id} className="p-4 border border-border rounded-xl bg-surface flex flex-col md:flex-row gap-4 justify-between">
              <div>
                <p className="font-bold text-sm">{exp.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {exp.category}
                  </span>
                  <span>{format(new Date(exp.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                  {exp.supplier_name && <span>Fornecedor: {exp.supplier_name}</span>}
                </div>
              </div>
              <div className="text-right flex flex-col justify-center">
                <span className="font-bold text-lg">{fmtBRL(exp.amount)}</span>
                <span className="text-xs text-muted-foreground">{exp.payment_method}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
