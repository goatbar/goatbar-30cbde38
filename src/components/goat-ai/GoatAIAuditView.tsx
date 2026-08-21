import React, { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, Clock, Wrench, RotateCcw, Loader2 } from "lucide-react";
import { goatAIChatService, ToolCallAudit } from "@/services/goat-ai/goat-ai-chat-service";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function GoatAIAuditView() {
  const [toolCalls, setToolCalls] = useState<ToolCallAudit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditData = async () => {
    try {
      setLoading(true);
      const data = await goatAIChatService.listAuditToolCalls();
      setToolCalls(data);
    } catch (err) {
      console.error("Erro ao carregar auditoria:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const formatDate = (isoString: string) => {
    try {
      return format(parseISO(isoString), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-border/60 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Auditoria de Operações & Ferramentas
          </h3>
          <p className="text-xs text-muted-foreground">
            Registro de todas as chamadas de funções e ações operacionais disparadas pela IA
          </p>
        </div>
        <button
          onClick={loadAuditData}
          className="p-2 rounded-lg border border-border/60 hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center text-muted-foreground gap-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Carregando registros de auditoria...
        </div>
      ) : toolCalls.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-xs">
          Nenhuma chamada de ferramenta registrada ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="pb-3 font-semibold">Data / Hora</th>
                <th className="pb-3 font-semibold">Ferramenta</th>
                <th className="pb-3 font-semibold">Argumentos</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {toolCalls.map((tc) => (
                <tr key={tc.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(tc.started_at)}
                  </td>
                  <td className="py-3 font-bold text-foreground">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-active border border-border/60 text-[11px]">
                      <Wrench className="h-3 w-3 text-primary" />
                      {tc.tool_name}
                    </span>
                  </td>
                  <td className="py-3 max-w-xs truncate text-muted-foreground font-mono text-[11px]" title={JSON.stringify(tc.arguments)}>
                    {JSON.stringify(tc.arguments)}
                  </td>
                  <td className="py-3">
                    {tc.status === "success" ? (
                      <span className="inline-flex items-center gap-1 text-[#22c55e] font-semibold text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sucesso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-destructive font-semibold text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Erro
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-muted-foreground whitespace-nowrap">
                    {tc.duration_ms} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
