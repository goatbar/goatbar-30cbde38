import { useState, useEffect } from "react";
import { IntegrationStatus } from "@/services/goat-ai/types";
import { goatAIService } from "@/services/goat-ai/goat-ai-service";
import {
  Sparkles,
  MessageSquare,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export function GoatAIIntegrationsView() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await goatAIService.getIntegrationStatus();
      setStatus(data);
    } catch (err) {
      console.error("Erro ao carregar status das integrações:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyWebhook = () => {
    if (!status?.whatsapp.webhookUrl) return;
    navigator.clipboard.writeText(status.whatsapp.webhookUrl);
    setCopied(true);
    toast.success("URL do webhook copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Status das Integrações de IA & Mensageria
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitoramento do estado dos providers sem exposição de credenciais ou chaves sensíveis.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar Status
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Gemini Integration Card */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Google Gemini AI</h3>
                <p className="text-xs text-muted-foreground">Classificação & Extração Estruturada</p>
              </div>
            </div>

            {status?.gemini.configured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Não configurado
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span>Modelo em uso:</span>
              <span className="font-mono font-semibold text-foreground">
                {status?.gemini.model || "gemini-1.5-flash"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Fallback Heurístico:</span>
              <span className="font-semibold text-amber-400">
                {status?.gemini.heuristicFallbackAllowed ? "Ativo (Dev/Teste)" : "Desativado"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Projeto Google:</span>
              <span className="font-mono text-foreground font-semibold">
                {status?.gemini.googleProject || "321790958376"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Variável esperada:</span>
              <code className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                GEMINI_API_KEY
              </code>
            </div>
          </div>
        </div>

        {/* WhatsApp Cloud API Card */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">WhatsApp Business API</h3>
                <p className="text-xs text-muted-foreground">Meta Cloud API / Ingestão de Mensagens</p>
              </div>
            </div>

            {status?.whatsapp.configured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Não configurado
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground block">
                URL do Webhook do WhatsApp:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={status?.whatsapp.webhookUrl || ""}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted font-mono text-[11px] text-foreground border border-border focus:outline-none"
                />
                <button
                  onClick={handleCopyWebhook}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-all cursor-pointer"
                  title="Copiar URL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span>Token de Verificação (Verify Token):</span>
              <span className="font-semibold text-foreground">
                {status?.whatsapp.hasVerifyToken ? "Configurado" : "Padrão (goatbar_verify_token)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Secrets Guide */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-primary" />
          Segurança e Próximos Passos para Produção
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Toda a arquitetura está pronta e isolada no backend. Para ativar as integrações reais em produção,
          adicione as seguintes Secrets nas <strong>Edge Functions do Supabase</strong>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded bg-background border border-border">
            <span className="text-primary font-bold">GEMINI_API_KEY</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Chave da Google AI Studio / Gemini API</p>
          </div>
          <div className="p-2.5 rounded bg-background border border-border">
            <span className="text-emerald-400 font-bold">WHATSAPP_ACCESS_TOKEN</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Token de Acesso Permanente da Meta Cloud API</p>
          </div>
          <div className="p-2.5 rounded bg-background border border-border">
            <span className="text-emerald-400 font-bold">WHATSAPP_PHONE_NUMBER_ID</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">ID do Número de Telefone Comercial Meta</p>
          </div>
          <div className="p-2.5 rounded bg-background border border-border">
            <span className="text-emerald-400 font-bold">WHATSAPP_APP_SECRET</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Chave secreta para validação de assinatura HMAC</p>
          </div>
        </div>
      </div>
    </div>
  );
}
