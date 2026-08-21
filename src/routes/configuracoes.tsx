import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { tiposEvento } from "@/lib/mock-data";
import { useAppStore } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { googleCalendarService, GoogleCalendarIntegrationStatus, GoogleCalendarEntry } from "@/services/google-calendar/google-calendar-service";
import {
  Save,
  Settings as SettingsIcon,
  Sliders,
  Calendar as CalendarIcon,
  Layers,
  FileText,
  Building2,
  Link2,
  RefreshCw,
  CalendarCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  component: () => (
    <AppShell>
      <ConfigPage />
    </AppShell>
  ),
});

const sections = [
  { id: "diretrizes", label: "Diretrizes de cálculo", icon: Sliders, active: true },
  { id: "tipos", label: "Tipos de evento", icon: CalendarIcon },
  { id: "categorias", label: "Categorias de drinks", icon: Layers },
  { id: "templates", label: "Templates de contrato", icon: FileText },
  { id: "unidades", label: "Unidades de negócio", icon: Building2 },
  { id: "integracoes", label: "Integrações", icon: Link2 },
];

function ConfigPage() {
  const { parametros, updateParametros } = useAppStore();
  const [draft, setDraft] = useState(parametros);
  const [activeTab, setActiveTab] = useState("diretrizes");
  const [canvaStatus, setCanvaStatus] = useState<{
    loading: boolean;
    connected: boolean;
    canvaUserId?: string | null;
  }>({ loading: true, connected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Google Calendar Integration States
  const [googleStatus, setGoogleStatus] = useState<{
    loading: boolean;
    data: GoogleCalendarIntegrationStatus | null;
  }>({ loading: true, data: null });
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarEntry[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
  const grupos = useMemo(() => Array.from(new Set(draft.map((p) => p.grupo))), [draft]);

  const checkCanvaStatus = async () => {
    try {
      setCanvaStatus((prev) => ({ ...prev, loading: true }));
      const { data, error } = await supabase.functions.invoke("canva-connection-status");
      if (error) {
        setCanvaStatus({ loading: false, connected: false });
        return;
      }
      setCanvaStatus({
        loading: false,
        connected: Boolean(data?.connected),
        canvaUserId: data?.canva_user_id ?? null,
      });
    } catch {
      setCanvaStatus({ loading: false, connected: false });
    }
  };

  const checkGoogleCalendarStatus = async () => {
    try {
      setGoogleStatus((prev) => ({ ...prev, loading: true }));
      const statusData = await googleCalendarService.getStatus();
      setGoogleStatus({ loading: false, data: statusData });
      if (statusData.connected) {
        loadGoogleCalendars();
      }
    } catch {
      setGoogleStatus({ loading: false, data: null });
    }
  };

  const loadGoogleCalendars = async () => {
    try {
      setIsLoadingCalendars(true);
      const list = await googleCalendarService.listCalendars();
      setGoogleCalendars(list);
    } catch (err: any) {
      console.warn("Não foi possível listar agendas:", err.message);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      const authUrl = await googleCalendarService.startOAuth();
      window.location.href = authUrl;
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar conexão com Google Calendar.");
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Deseja realmente desconectar o Google Calendar? Os eventos não serão mais sincronizados automaticamente.")) {
      return;
    }
    try {
      await googleCalendarService.disconnect();
      toast.success("Google Calendar desconectado.");
      await checkGoogleCalendarStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar Google Calendar.");
    }
  };

  const handleSelectCalendar = async (calId: string, calName: string) => {
    try {
      await googleCalendarService.selectCalendar(calId, calName);
      toast.success(`Agenda alterada para: ${calName}`);
      await checkGoogleCalendarStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar agenda.");
    }
  };

  const handleSyncAllEvents = async () => {
    try {
      setIsSyncingAll(true);
      const result = await googleCalendarService.syncAllConfirmed();
      toast.success(`Sincronização concluída! ${result.synced} de ${result.total} eventos sincronizados.`);
      await checkGoogleCalendarStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro na sincronização geral.");
    } finally {
      setIsSyncingAll(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const integration = params.get("integration");
    const status = params.get("status");

    if (integration === "canva") {
      setActiveTab("integracoes");
      if (status === "success") {
        toast.success("Canva conectado com sucesso!");
      } else if (status === "error") {
        toast.error("Não foi possível conectar ao Canva. A autorização falhou ou foi cancelada.");
      }
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    if (integration === "google_calendar") {
      setActiveTab("integracoes");
      if (status === "success") {
        toast.success("Google Calendar conectado com sucesso!");
      } else if (status === "error") {
        const msg = params.get("message");
        toast.error(`Falha na conexão com Google Calendar: ${msg || "autorização recusada"}`);
      }
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    checkCanvaStatus();
    checkGoogleCalendarStatus();
  }, []);

  return (
    <>
      <PageHeader
        breadcrumb="Sistema"
        title="Configurações"
        subtitle="Diretrizes editáveis aplicadas automaticamente em todos os cálculos."
        action={
          <PrimaryButton
            onClick={() => {
              updateParametros(draft);
              window.alert("Configurações salvas com sucesso.");
            }}
          >
            <Save className="h-4 w-4" /> Salvar alterações
          </PrimaryButton>
        }
      />

      <div className="page-container grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Sidebar interna */}
        <aside className="xl:col-span-3 space-y-2">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveTab(s.id);
                  if (s.id === "integracoes") {
                    checkCanvaStatus();
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all ${
                  activeTab === s.id
                    ? "bg-primary/10 border-primary text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
          <div className="card-premium p-5 mt-5">
            <SettingsIcon className="h-5 w-5 text-primary mb-3" />
            <div className="font-display text-sm font-semibold">Aplicação automática</div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Estas diretrizes alimentam o cálculo de eventos, vendas e relatórios.
            </p>
          </div>
        </aside>

        <div className="xl:col-span-9 space-y-5">
          {activeTab === "diretrizes" &&
            grupos.map((g) => (
              <SectionCard key={g} title={`Diretrizes · ${g}`} subtitle="Editáveis em tempo real">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {draft
                    // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
                    .filter((p) => p.grupo === g)
                    .map((p) => (
                      <ParamField
                        key={p.id}
                        label={p.label}
                        value={p.valor}
                        unidade={p.unidade}
                        hint={p.descricao}
                        onChange={(next) =>
                          setDraft((prev) =>
                            prev.map((item) =>
                              item.id === p.id ? { ...item, valor: next } : item,
                            ),
                          )
                        }
                      />
                    ))}
                </div>
              </SectionCard>
            ))}

          {activeTab === "tipos" && (
            <SectionCard title="Tipos de evento" subtitle="Parâmetros de consumo por categoria">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      {[
                        "Tipo",
                        "Doses/pessoa",
                        "Gelo (kg)/pessoa",
                        "Insumos R$/pessoa",
                        "Equipe/50 pessoas",
                      ].map((h) => (
                        <th key={h} className="label-eyebrow px-6 py-3 border-y border-border">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiposEvento.map((t) => (
                      <tr key={t.id} className="border-b border-border/60">
                        <td className="px-6 py-3.5 font-medium">{t.nome}</td>
                        <td className="px-6 py-3.5">{t.consumoBebidaPessoa}</td>
                        <td className="px-6 py-3.5">{t.geloKgPessoa}</td>
                        <td className="px-6 py-3.5">R$ {t.insumosPessoa.toFixed(2)}</td>
                        <td className="px-6 py-3.5">{t.equipePor50}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {activeTab === "integracoes" && (
            <SectionCard
              title="Integrações"
              subtitle="Conecte serviços externos para expandir os recursos do Goat Bar."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Canva Card */}
                <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between space-y-4 hover:border-border-strong transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#00C4CC]/10 text-[#00C4CC] flex items-center justify-center font-bold text-lg">
                          C
                        </div>
                        <div>
                          <h3 className="font-display font-semibold text-base text-foreground">Canva</h3>
                          <p className="text-xs text-muted-foreground">Canva Connect API</p>
                        </div>
                      </div>
                      {canvaStatus.loading ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-secondary text-muted-foreground animate-pulse">
                          Verificando...
                        </span>
                      ) : canvaStatus.connected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-success/15 text-[#22c55e] border border-[rgba(34,197,94,0.35)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                          Conectado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-secondary text-muted-foreground">
                          Não conectado
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Automatize a geração de propostas comerciais.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                    {canvaStatus.connected ? (
                      <div className="flex items-center justify-between gap-3 w-full">
                        <GhostButton
                          disabled={isTesting}
                          onClick={async () => {
                            setIsTesting(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("canva-test-connection");
                              if (error || !data?.connected) {
                                toast.error(data?.error || "Falha ao testar conexão com o Canva.");
                              } else {
                                const name = data.canva_user?.display_name || "Usuário Canva";
                                toast.success(`Conexão com Canva ativa! (${name})`);
                              }
                            } catch (err: any) {
                              toast.error(err?.message || "Erro ao testar conexão.");
                            } finally {
                              setIsTesting(false);
                            }
                          }}
                        >
                          {isTesting ? "Testando..." : "Testar conexão"}
                        </GhostButton>

                        <button
                          disabled={isConnecting}
                          onClick={async () => {
                            setIsConnecting(true);
                            try {
                              const { data, error } = await supabase.functions.invoke("canva-oauth-start");
                              if (error || !data?.authorization_url) {
                                toast.error(data?.error || "Erro ao iniciar reconexão com Canva.");
                                setIsConnecting(false);
                                return;
                              }
                              window.location.href = data.authorization_url;
                            } catch (err: any) {
                              toast.error(err?.message || "Erro ao conectar com Canva.");
                              setIsConnecting(false);
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground underline transition-colors px-2 py-1 cursor-pointer"
                        >
                          Reconectar
                        </button>
                      </div>
                    ) : (
                      <PrimaryButton
                        disabled={isConnecting}
                        onClick={async () => {
                          setIsConnecting(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("canva-oauth-start");
                            if (error || !data?.authorization_url) {
                              toast.error(data?.error || "Erro ao iniciar conexão com Canva.");
                              setIsConnecting(false);
                              return;
                            }
                            window.location.href = data.authorization_url;
                          } catch (err: any) {
                            toast.error(err?.message || "Erro ao conectar com Canva.");
                            setIsConnecting(false);
                          }
                        }}
                      >
                        {isConnecting ? "Iniciando..." : "Conectar Canva"}
                      </PrimaryButton>
                    )}
                  </div>
                </div>

                {/* Google Calendar Card */}
                <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between space-y-4 hover:border-border-strong transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#4285F4]/10 text-[#4285F4] flex items-center justify-center font-bold text-lg">
                          <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-display font-semibold text-base text-foreground">Google Calendar</h3>
                          <p className="text-xs text-muted-foreground">Google Calendar API (OAuth 2.0)</p>
                        </div>
                      </div>
                      {googleStatus.loading ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-secondary text-muted-foreground animate-pulse">
                          Verificando...
                        </span>
                      ) : googleStatus.data?.connected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-success/15 text-[#22c55e] border border-[rgba(34,197,94,0.35)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                          Conectado
                        </span>
                      ) : googleStatus.data?.status === "reauthorization_required" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Reconectar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider bg-secondary text-muted-foreground">
                          Não conectado
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Sincronize automaticamente eventos confirmados com a agenda Goat Bar.
                    </p>

                    {googleStatus.data?.connected && (
                      <div className="mt-3 pt-3 border-t border-border/40 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Conta:</span>
                          <span className="font-medium text-foreground">{googleStatus.data.email}</span>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground gap-2">
                          <span className="shrink-0">Agenda:</span>
                          {isLoadingCalendars ? (
                            <span className="text-muted-foreground animate-pulse">Carregando agendas...</span>
                          ) : googleCalendars.length > 0 ? (
                            <select
                              value={googleStatus.data.calendarId || "primary"}
                              onChange={(e) => {
                                const selected = googleCalendars.find((c) => c.id === e.target.value);
                                if (selected) {
                                  handleSelectCalendar(selected.id, selected.summary);
                                }
                              }}
                              className="bg-input border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none max-w-[200px] truncate"
                            >
                              {googleCalendars.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.summary} {c.primary ? "(Principal)" : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-foreground truncate">{googleStatus.data.calendarName || "Principal"}</span>
                          )}
                        </div>

                        {googleStatus.data.lastSyncAt && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Última sincronização:</span>
                            <span className="font-medium text-foreground">
                              {new Date(googleStatus.data.lastSyncAt).toLocaleString("pt-BR")}
                            </span>
                          </div>
                        )}

                        {googleStatus.data.lastSyncError && (
                          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px]">
                            {googleStatus.data.lastSyncError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                    {googleStatus.data?.connected ? (
                      <div className="flex items-center justify-between gap-3 w-full">
                        <GhostButton
                          disabled={isSyncingAll}
                          onClick={handleSyncAllEvents}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                          {isSyncingAll ? "Sincronizando..." : "Sincronizar agora"}
                        </GhostButton>

                        <button
                          onClick={handleDisconnectGoogle}
                          className="text-xs text-destructive hover:underline transition-colors px-2 py-1 cursor-pointer"
                        >
                          Desconectar
                        </button>
                      </div>
                    ) : (
                      <PrimaryButton
                        disabled={isConnectingGoogle}
                        onClick={handleConnectGoogle}
                      >
                        {isConnectingGoogle ? "Conectando..." : "Conectar Google Calendar"}
                      </PrimaryButton>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {["categorias", "templates", "unidades"].includes(activeTab) && (
            <SectionCard
              title={sections.find((s) => s.id === activeTab)?.label || ""}
              subtitle="Em desenvolvimento"
            >
              <div className="py-12 text-center text-muted-foreground text-sm">
                Módulo em construção. Disponível na próxima versão.
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}

function ParamField({
  label,
  value,
  unidade,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  unidade: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div>
      <label className="label-eyebrow">{label}</label>
      <div className="mt-2 flex items-center rounded-lg bg-input border border-border focus-within:border-primary transition-colors">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const normalized = draft.replace(",", ".");
            const parsed = Number(normalized);
            if (!Number.isNaN(parsed)) onChange(parsed);
            setDraft(String(Number.isNaN(parsed) ? value : parsed));
          }}
          className="flex-1 bg-transparent px-4 py-2.5 text-sm focus:outline-none"
        />
        <span className="px-3 text-xs text-muted-foreground border-l border-border">{unidade}</span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}
