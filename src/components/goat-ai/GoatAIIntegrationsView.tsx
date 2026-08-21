import { useState, useEffect } from "react";
import { IntegrationStatus, UserMessagingAccountItem } from "@/services/goat-ai/types";
import { goatAIService } from "@/services/goat-ai/goat-ai-service";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  MessageSquare,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Lock,
  UserPlus,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  display_name: string;
  email: string;
}

export function GoatAIIntegrationsView() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [accounts, setAccounts] = useState<UserMessagingAccountItem[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Form state for linking new user
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  const fetchStatusAndAccounts = async () => {
    try {
      setLoading(true);
      const [statusData, accountsData] = await Promise.all([
        goatAIService.getIntegrationStatus(),
        goatAIService.listMessagingAccounts(),
      ]);
      setStatus(statusData);
      setAccounts(accountsData);

      // Fetch profiles for the dropdown
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id:user_id, display_name, email");
      if (profs) setProfiles(profs);
    } catch (err) {
      console.error("Erro ao carregar dados das integrações:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndAccounts();
  }, []);

  const handleCopyWebhook = () => {
    if (!status?.whatsapp.webhookUrl) return;
    navigator.clipboard.writeText(status.whatsapp.webhookUrl);
    setCopied(true);
    toast.success("URL do webhook copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newPhone) {
      toast.error("Selecione um usuário e informe o número de WhatsApp.");
      return;
    }

    try {
      setSavingAccount(true);
      await goatAIService.createMessagingAccount({
        user_id: selectedUserId,
        phone_number: newPhone,
        display_name: newDisplayName || undefined,
        external_user_id: newPhone.replace(/[^0-9]/g, ""),
      });
      toast.success("WhatsApp vinculado com sucesso ao usuário!");
      setShowAddModal(false);
      setSelectedUserId("");
      setNewPhone("");
      setNewDisplayName("");
      await fetchStatusAndAccounts();
    } catch (err: any) {
      toast.error(`Erro ao vincular WhatsApp: ${err?.message || String(err)}`);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string, name: string) => {
    if (!confirm(`Deseja remover o vínculo do WhatsApp de ${name}?`)) return;
    try {
      await goatAIService.deleteMessagingAccount(id);
      toast.success("Vínculo removido com sucesso.");
      await fetchStatusAndAccounts();
    } catch (err: any) {
      toast.error(`Erro ao remover vínculo: ${err?.message || String(err)}`);
    }
  };

  const handleToggleVerified = async (id: string, current: boolean) => {
    try {
      await goatAIService.toggleMessagingAccountVerified(id, !current);
      toast.success(current ? "Acesso desativado para o número." : "Número autorizado com sucesso!");
      await fetchStatusAndAccounts();
    } catch (err: any) {
      toast.error(`Erro ao alterar status: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Integrações & Canal WhatsApp da Goat AI (GIA)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Canal operacional oficial e gestão de sócios autorizados via WhatsApp Business Cloud API.
          </p>
        </div>

        <button
          onClick={fetchStatusAndAccounts}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted text-foreground transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar Status
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* WhatsApp Cloud API Card */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">WhatsApp Business API</h3>
                <p className="text-xs text-muted-foreground">Meta Cloud API (GIA - Goat Assistant)</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Conectado
            </span>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span>Número Goat Bar:</span>
              <span className="font-mono font-semibold text-foreground">
                {status?.whatsapp.displayPhoneNumber || "+55 31 9207-4076"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Nome Verificado:</span>
              <span className="font-semibold text-foreground">
                {status?.whatsapp.verifiedName || "GIA - Goat Intelligence Assistant"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Phone Number ID:</span>
              <span className="font-mono text-[11px] text-foreground">
                {status?.whatsapp.phoneNumberId || "1260902867106927"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>WABA ID:</span>
              <span className="font-mono text-[11px] text-foreground">
                {status?.whatsapp.businessAccountId || "1056887710436972"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Meta App ID:</span>
              <span className="font-mono text-[11px] text-foreground">
                {status?.whatsapp.appId || "1369569495292462"}
              </span>
            </div>

            <div className="space-y-1 pt-1.5 border-t border-border/50">
              <label className="text-[11px] font-semibold text-foreground block">
                Callback URL do Webhook:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={status?.whatsapp.webhookUrl || "https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/whatsapp-webhook"}
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
          </div>
        </div>

        {/* Gemini Engine Card */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Google Gemini AI</h3>
                <p className="text-xs text-muted-foreground">Motor Multimodal & Tool Calling</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Configurado
            </span>
          </div>

          <div className="space-y-2.5 text-xs text-muted-foreground pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span>Modelo em uso:</span>
              <span className="font-mono font-semibold text-foreground">
                {status?.gemini.model || "gemini-2.0-flash"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Tool Calling:</span>
              <span className="font-semibold text-emerald-400">Ativo (10 ferramentas registradas)</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Multimodal:</span>
              <span className="font-semibold text-foreground">Imagens, Notas Fiscais (PDF) e Áudios</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Chave Secreta:</span>
              <span className="font-mono text-[11px] text-foreground">
                •••••••••••••••• (Secret remota protegida)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Authorized WhatsApp Users Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Usuários Autorizados no WhatsApp
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Apenas os números vinculados abaixo têm permissão para interagir com a GIA e consultar/gravar dados.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Vincular Novo Usuário
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
            <Phone className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            Nenhum número de WhatsApp vinculado ainda. Clique no botão acima para autorizar um sócio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="pb-2">Nome / Sócio</th>
                  <th className="pb-2">Número WhatsApp</th>
                  <th className="pb-2">WhatsApp ID (wa_id)</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-muted/30">
                    <td className="py-2.5 font-medium text-foreground">
                      {acc.display_name || acc.profile?.display_name || "Sócio"}
                    </td>
                    <td className="py-2.5 font-mono text-foreground">{acc.phone_number}</td>
                    <td className="py-2.5 font-mono text-muted-foreground">{acc.external_user_id || "—"}</td>
                    <td className="py-2.5">
                      {acc.verified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Autorizado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/10 text-zinc-400">
                          <XCircle className="w-3 h-3" />
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right space-x-2">
                      <button
                        onClick={() => handleToggleVerified(acc.id, acc.verified)}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        title={acc.verified ? "Desativar" : "Autorizar"}
                      >
                        {acc.verified ? "Desativar" : "Autorizar"}
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.display_name || "este número")}
                        className="text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                        title="Remover Vínculo"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Vincular WhatsApp de Sócio / Usuário
            </h3>

            <form onSubmit={handleLinkAccount} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Selecione o Usuário Goat Bar:</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    const prof = profiles.find((p) => p.id === e.target.value);
                    if (prof) setNewDisplayName(prof.display_name);
                  }}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none"
                >
                  <option value="">Selecione um usuário...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} ({p.email || "Sem email"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Número de WhatsApp (com DDD):</label>
                <input
                  type="text"
                  placeholder="+5531999999999"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none font-mono"
                />
                <p className="text-[11px] text-muted-foreground">Exemplo: +5531988887777 ou 5531988887777</p>
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-semibold">Nome de Exibição / Tratamento:</label>
                <input
                  type="text"
                  placeholder="Nome do Sócio"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all cursor-pointer"
                >
                  {savingAccount ? "Salvando..." : "Vincular e Autorizar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meta Dashboard Webhook Configuration Guide */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-5 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-primary" />
          Configuração do Webhook no Meta Developer Dashboard
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Para que as mensagens recebidas no WhatsApp oficial cheguem à GIA, verifique no painel da Meta Developers:
        </p>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-lg bg-background border border-border space-y-1">
            <span className="text-foreground font-semibold">1. URL de Retorno de Chamada (Callback URL):</span>
            <div className="font-mono text-emerald-400 text-[11px]">
              https://xdqgglrxidmegujhkygj.supabase.co/functions/v1/whatsapp-webhook
            </div>
          </div>

          <div className="p-3 rounded-lg bg-background border border-border space-y-1">
            <span className="text-foreground font-semibold">2. Campo de Assinatura (Webhook Subscriptions):</span>
            <div className="text-muted-foreground text-[11px]">
              Certifique-se de marcar o campo <strong className="text-foreground font-mono">messages</strong> no produto <strong>WhatsApp &gt; Configuração &gt; Webhook</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
