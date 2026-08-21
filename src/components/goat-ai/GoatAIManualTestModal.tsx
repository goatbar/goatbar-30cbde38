import { useState } from "react";
import { goatAIService } from "@/services/goat-ai/goat-ai-service";
import { X, Sparkles, Send, Play } from "lucide-react";
import { toast } from "sonner";

const EXAMPLES = [
  {
    title: "Compra de Evento (Assaí)",
    text: "Comprei 4 Tanqueray e 3 Absolut para o casamento da Fernanda. Deu R$ 780 no Assaí.",
    sender: "Carlos (Sócio)",
  },
  {
    title: "Sessão de Vendas (7 Steakhouse)",
    text: "Hoje na 7 Steak vendemos 18 Old Fashioned, 12 Negroni e 9 Moscow Mule. Movimento bom entre 20h e 22h. Faturamento aproximado R$ 4.850. Tivemos demora no primeiro atendimento.",
    sender: "Mateus (Gerente)",
  },
  {
    title: "Compra Grande (Atacadão)",
    text: "Comprei 6 Tanqueray, 4 Absolut e 10 caixas de tônica para o casamento da Fernanda e Lucas. Total R$ 1.420 no Atacadão.",
    sender: "Lucas (Sócio)",
  },
  {
    title: "Relatório de Operação",
    text: "Relatório de operação Goat Botequim: 3 bartenders escalados, movimento intenso após as 21h, sem incidentes.",
    sender: "Supervisor Botequim",
  },
];

export function GoatAIManualTestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [senderName, setSenderName] = useState(EXAMPLES[0].sender);
  const [source, setSource] = useState<"manual" | "whatsapp">("manual");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Por favor, insira o texto da mensagem.");
      return;
    }

    try {
      setSubmitting(true);
      await goatAIService.createTestInput({
        raw_text: text,
        source_sender_name: senderName || "Sócio / Teste",
        source,
      });
      toast.success("Mensagem processada pelo pipeline da GIA!");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar mensagem");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Nova Entrada de Teste (GIA)
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick Example Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">
              Exemplos Prontos para Teste:
            </label>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setText(ex.text);
                    setSenderName(ex.sender);
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/60 hover:bg-muted hover:text-primary text-muted-foreground border border-border/60 transition-colors cursor-pointer"
                >
                  {ex.title}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Mensagem Operacional (Texto):
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite uma mensagem como um sócio enviaria no WhatsApp..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none font-sans"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Nome do Remetente:
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Ex: Carlos (Sócio)"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Simular Origem:
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="manual">Manual (Central de IA)</option>
                <option value="whatsapp">WhatsApp Business API</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary hover:brightness-110 text-primary-foreground text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {submitting ? "Processando..." : "Executar Pipeline"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
