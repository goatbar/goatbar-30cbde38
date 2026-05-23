import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { StatCard, SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import {
  Plus,
  ShoppingBag,
  X,
  Utensils,
  Calendar,
  Trash2,
  Pencil,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Check,
  Search,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/lib/app-store";
import { type SalesSessionItem } from "@/lib/mock-data";
import { eventBudgetService } from "@/services/event-budget-service";
import { financialService } from "@/services/financial-service";
import { eventContractsService } from "@/services/contract-service";

export const Route = createFileRoute("/vendas")({
  component: () => (
    <AppShell>
      <VendasPage />
    </AppShell>
  ),
});

function VendasPage() {
  const {
    drinks: storeDrinks,
    addFinancialSession,
    updateFinancialSession,
    deleteFinancialSession,
  } = useAppStore();

  const [financialSessions, setFinancialSessions] = useState<any[]>([]);
  const [allDrinks, setAllDrinks] = useState<any[]>([]);
  const [eventosSupabase, setEventosSupabase] = useState<any[]>([]);
  const [contractsSupabase, setContractsSupabase] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    "Goat Botequim" | "7Steakhouse" | "Eventos" | "Consolidação"
  >("Goat Botequim");

  const [periodoDias, setPeriodoDias] = useState<number>(30);

  const normalizeSessionForUI = (session: any) => ({
    ...session,
    modalidade: session.modalidade === "Goatbotequim" ? "Goat Botequim" : session.modalidade,
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [evs, sessions, contracts] = await Promise.all([
        eventBudgetService.listEvents(),
        financialService.listSessions(),
        eventContractsService.listAllContracts(),
      ]);

      setEventosSupabase(evs || []);
      setFinancialSessions(sessions || []);
      setContractsSupabase(contracts || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    const normalized = (storeDrinks || []).map((d) => ({
      ...d,
      modalityConfig: d.modalityConfig ?? {
        evento: {
          active: true,
          cost: Number(d.custoUnitario || 0),
          price: Number(d.precoVenda || 0),
        },
        steakhouse: {
          active: true,
          cost: Number(d.custoUnitario || 0),
          price: Number(d.precoVenda || 0),
        },
        goatbotequim: {
          active: true,
          cost: Number(d.custoUnitario || 0),
          price: Number(d.precoVenda || 0),
        },
      },
    }));

    setAllDrinks(normalized);
  }, [storeDrinks]);

  const [showModal, setShowModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const [showLegacyEventModal, setShowLegacyEventModal] = useState(false);
  const [legacyForm, setLegacyForm] = useState({
    clientName: "",
    eventType: "Casamento",
    date: "",
    city: "São Paulo",
    guests: 100,
    drinks: [] as string[],
    finalBudgetValue: "",
    paidValue: "",
  });
  const [savingLegacyEvent, setSavingLegacyEvent] = useState(false);
  const [buscaDrinkLegacy, setBuscaDrinkLegacy] = useState("");

  const [modalDate, setModalDate] = useState(new Date().toISOString().split("T")[0]);
  const [modalItems, setModalItems] = useState<SalesSessionItem[]>([]);
  const [maoDeObraValor, setMaoDeObraValor] = useState(0);
  const [maoDeObraQtd, setMaoDeObraQtd] = useState(0);
  const [maoDeObraNomes, setMaoDeObraNomes] = useState("");
  const [maoDeObraDetalhes, setMaoDeObraDetalhes] = useState<
    { data: string; valor: number; qtdPessoas: number; nomes?: string }[]
  >([]);
  const [custosRestauranteDetalhes, setCustosRestauranteDetalhes] = useState<
    { descricao: string; valor: number }[]
  >([]);

  const reposicaoRestaurante = useMemo(() => {
    return custosRestauranteDetalhes.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  }, [custosRestauranteDetalhes]);

  const limiteData = useMemo(() => {
    if (periodoDias === 0) return new Date(0);

    if (periodoDias === -1) {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    if (periodoDias === -2) {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    }

    const d = new Date();
    d.setDate(d.getDate() - periodoDias);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodoDias]);

  const dataFim = useMemo(() => {
    if (periodoDias === -2) {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);
    }

    return new Date(2100, 0, 1);
  }, [periodoDias]);

  const filteredSessions = useMemo(() => {
    return financialSessions.filter((s) => {
      const d = new Date(s.data).getTime();
      return d >= limiteData.getTime() && d <= dataFim.getTime();
    });
  }, [financialSessions, limiteData, dataFim]);

  const filteredEventos = useMemo(() => {
    return eventosSupabase.filter((e) => {
      const eventDate = e.date || e.data;
      const d = new Date(eventDate || 0).getTime();
      return d >= limiteData.getTime() && d <= dataFim.getTime();
    });
  }, [eventosSupabase, limiteData, dataFim]);

  const activeModalityKey = useMemo(() => {
    if (activeTab === "7Steakhouse") return "steakhouse";
    if (activeTab === "Goat Botequim") return "goatbotequim";
    return "evento";
  }, [activeTab]);

  const filteredDrinks = useMemo(() => {
    const key = activeModalityKey as "steakhouse" | "goatbotequim" | "evento";

    return allDrinks
      .filter((d) => d.modalityConfig?.[key]?.active)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [activeModalityKey, allDrinks]);

  const addItem = () => {
    const firstDrink = filteredDrinks[0] || allDrinks[0];
    if (!firstDrink) return;

    const isSteak = activeTab === "7Steakhouse";
    const config = firstDrink.modalityConfig?.[activeModalityKey as "steakhouse" | "goatbotequim"];

    setModalItems([
      ...modalItems,
      {
        drinkId: firstDrink.id,
        nome: firstDrink.nome,
        quantidade: 1,
        precoUnitario: config?.price || 0,
        custoUnitario: config?.cost || 0,
        custoInsumo: isSteak
          ? (firstDrink.modalityConfig?.evento?.cost ?? firstDrink.custoUnitario)
          : config?.cost,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof SalesSessionItem, value: any) => {
    const newItems = [...modalItems];

    if (field === "drinkId") {
      const d = allDrinks.find((x) => x.id === value) || allDrinks.find((x) => x.nome === value);

      if (d) {
        const isSteak = activeTab === "7Steakhouse";
        const config = d.modalityConfig?.[activeModalityKey as "steakhouse" | "goatbotequim"];

        newItems[index] = {
          ...newItems[index],
          drinkId: d.id,
          nome: d.nome,
          precoUnitario: config?.price || 0,
          custoUnitario: config?.cost || 0,
          custoInsumo: isSteak ? (d.modalityConfig?.evento?.cost ?? d.custoUnitario) : config?.cost,
        };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }

    setModalItems(newItems);
  };

  const removeItem = (index: number) => {
    setModalItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const generateSteakhouseDays = (startDateStr: string) => {
    const days = [];
    const baseDate = new Date(startDateStr);
    baseDate.setUTCHours(12);

    for (let i = 0; i < 4; i++) {
      const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      days.push({ data: d.toISOString().split("T")[0], valor: 0, qtdPessoas: 1, nomes: "" });
    }

    return days;
  };

  const openNewSessionModal = () => {
    setEditingSessionId(null);
    setModalDate(new Date().toISOString().split("T")[0]);
    setModalItems([]);
    setMaoDeObraValor(0);
    setMaoDeObraQtd(0);
    setMaoDeObraNomes("");
    setMaoDeObraDetalhes([]);
    setCustosRestauranteDetalhes([]);
    setShowModal(true);
  };

  const handleEditSession = (session: any) => {
    const key = activeTab === "7Steakhouse" ? "steakhouse" : "goatbotequim";

    const normalizedItems = (session.items || []).map((item: any) => {
      const matchedDrink =
        allDrinks.find((d) => d.id === item.drinkId) ||
        allDrinks.find((d) => d.nome === item.nome || d.nome === item.drink_name);

      const config = matchedDrink?.modalityConfig?.[key];

      return {
        ...item,
        drinkId: matchedDrink?.id ?? item.drinkId,
        nome: item.nome ?? item.drink_name ?? matchedDrink?.nome ?? "",
        precoUnitario: Number(config?.price ?? item.precoUnitario ?? 0),
        custoUnitario: Number(config?.cost ?? item.custoUnitario ?? 0),
        custoInsumo:
          activeTab === "7Steakhouse"
            ? Number(
                matchedDrink?.modalityConfig?.evento?.cost ??
                  matchedDrink?.custoUnitario ??
                  item.custoInsumo ??
                  item.custoUnitario ??
                  0,
              )
            : Number(config?.cost ?? item.custoInsumo ?? item.custoUnitario ?? 0),
      } as SalesSessionItem;
    });

    setEditingSessionId(session.id);
    setModalDate(session.data);
    setModalItems(normalizedItems);
    setMaoDeObraValor(session.maoDeObraValor);
    setMaoDeObraQtd(session.maoDeObraQtd);
    setMaoDeObraNomes(session.maoDeObraNomes || "");
    setMaoDeObraDetalhes(
      session.maoDeObraDetalhes ? JSON.parse(JSON.stringify(session.maoDeObraDetalhes)) : [],
    );
    setCustosRestauranteDetalhes(
      session.custosRestauranteDetalhes
        ? JSON.parse(JSON.stringify(session.custosRestauranteDetalhes))
        : [],
    );
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      data: modalDate,
      modalidade: activeTab,
      items: modalItems,
      maoDeObraValor,
      maoDeObraQtd,
      maoDeObraNomes,
      maoDeObraDetalhes: activeTab === "7Steakhouse" ? maoDeObraDetalhes : undefined,
      reposicaoRestaurante: activeTab === "7Steakhouse" ? reposicaoRestaurante : 0,
      custosRestauranteDetalhes: activeTab === "7Steakhouse" ? custosRestauranteDetalhes : [],
    };

    try {
      if (editingSessionId) {
        await financialService.updateSession(editingSessionId, payload);
        updateFinancialSession(editingSessionId, payload);

        setFinancialSessions((prev) =>
          prev.map((s) =>
            s.id === editingSessionId
              ? normalizeSessionForUI({ ...s, ...payload, id: editingSessionId })
              : s,
          ),
        );
      } else {
        const created = await financialService.createSession(payload);
        addFinancialSession(payload);

        setFinancialSessions((prev) => [
          normalizeSessionForUI({ ...payload, id: created?.id ?? `fs-${Date.now()}` }),
          ...prev,
        ]);
      }

      setShowModal(false);
      loadAllData();
    } catch (e) {
      console.error("Erro ao salvar sessão:", e);

      if (editingSessionId) {
        updateFinancialSession(editingSessionId, payload);

        setFinancialSessions((prev) =>
          prev.map((s) =>
            s.id === editingSessionId
              ? normalizeSessionForUI({ ...s, ...payload, id: editingSessionId })
              : s,
          ),
        );
      } else {
        const localId = `fs-${Date.now()}`;
        addFinancialSession(payload);

        setFinancialSessions((prev) => [
          normalizeSessionForUI({ ...payload, id: localId }),
          ...prev,
        ]);
      }

      setShowModal(false);
      loadAllData();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await financialService.deleteSession(sessionId);
      deleteFinancialSession(sessionId);
      setFinancialSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (e) {
      console.error("Erro ao excluir sessão no Supabase:", e);
      deleteFinancialSession(sessionId);
      setFinancialSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } finally {
      loadAllData();
    }
  };

  const handleSaveLegacyEvent = async () => {
    if (!legacyForm.clientName || !legacyForm.date) {
      alert("Por favor, preencha os campos obrigatórios (Nome do Cliente e Data).");
      return;
    }
    setSavingLegacyEvent(true);
    try {
      const selectedDrinksList = allDrinks.filter((d) => legacyForm.drinks.includes(d.id));
      const totalCost = selectedDrinksList.reduce((acc, d) => {
        return acc + Number(d.modalityConfig?.evento?.cost ?? d.custoUnitario ?? 0);
      }, 0);
      const avgCost = legacyForm.drinks.length > 0 ? totalCost / legacyForm.drinks.length : 0;

      await eventBudgetService.createLegacyEvent({
        client_name: legacyForm.clientName,
        event_type: legacyForm.eventType,
        date: legacyForm.date,
        city: legacyForm.city,
        guests: Number(legacyForm.guests) || 0,
        drinks: legacyForm.drinks,
        final_budget_value: Number(legacyForm.finalBudgetValue) || 0,
        paid_value: Number(legacyForm.paidValue) || 0,
        average_drink_cost: avgCost,
      });

      alert("Evento antigo lançado com sucesso!");
      setShowLegacyEventModal(false);
      setLegacyForm({
        clientName: "",
        eventType: "Casamento",
        date: "",
        city: "São Paulo",
        guests: 100,
        drinks: [],
        finalBudgetValue: "",
        paidValue: "",
      });
      await loadAllData();
    } catch (e: any) {
      console.error("Erro ao salvar evento antigo:", e);
      alert(`Erro ao salvar evento antigo: ${e.message || "Erro desconhecido"}`);
    } finally {
      setSavingLegacyEvent(false);
    }
  };

  const handleRefreshSession = async (session: any) => {
    const isSteak = session.modalidade === "7Steakhouse";

    const refreshedItems = (session.items || []).map((item: any) => {
      const matchedDrink =
        allDrinks.find((d) => d.id === item.drinkId) ||
        allDrinks.find((d) => d.nome === item.nome || d.nome === item.drink_name);

      const modalidadeConfig =
        matchedDrink?.modalityConfig?.[isSteak ? "steakhouse" : "goatbotequim"];

      const novoPrecoUnitario = Number(modalidadeConfig?.price ?? item.precoUnitario ?? 0);

      const novoCustoUnitario = Number(modalidadeConfig?.cost ?? item.custoUnitario ?? 0);

      const novoCustoInsumo = isSteak
        ? Number(
            matchedDrink?.modalityConfig?.evento?.cost ??
              matchedDrink?.custoUnitario ??
              item.custoInsumo ??
              novoCustoUnitario,
          )
        : Number(modalidadeConfig?.cost ?? item.custoInsumo ?? novoCustoUnitario);

      return {
        ...item,
        drinkId: matchedDrink?.id ?? item.drinkId,
        nome: item.nome ?? item.drink_name ?? matchedDrink?.nome ?? "",
        precoUnitario: novoPrecoUnitario,
        custoUnitario: novoCustoUnitario,
        custoInsumo: novoCustoInsumo,
      };
    });

    const payload = {
      data: session.data,
      modalidade: session.modalidade,
      items: refreshedItems,
      maoDeObraValor: session.maoDeObraValor,
      maoDeObraQtd: session.maoDeObraQtd,
      maoDeObraNomes: session.maoDeObraNomes,
      maoDeObraDetalhes: session.maoDeObraDetalhes,
      reposicaoRestaurante: session.reposicaoRestaurante,
      custosRestauranteDetalhes: session.custosRestauranteDetalhes,
    };

    try {
      await financialService.updateSession(session.id, payload);
      updateFinancialSession(session.id, payload);

      setFinancialSessions((prev) =>
        prev.map((s) =>
          s.id === session.id ? normalizeSessionForUI({ ...s, ...payload, id: session.id }) : s,
        ),
      );

      loadAllData();
    } catch (error) {
      console.error("Erro ao atualizar dados da sessão:", error);
    }
  };

  const metrics = useMemo(() => {
    return financialService.calculateMetrics(filteredSessions, filteredEventos, allDrinks);
  }, [filteredSessions, filteredEventos, allDrinks]);

  const statsMensal = useMemo(() => {
    const meses: Record<
      string,
      {
        mes: string;
        receita: number;
        custos: number;
        lucro: number;
        bot: number;
        steak: number;
        event: number;
      }
    > = {};

    filteredSessions.forEach((s) => {
      const date = new Date(s.data);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!meses[key]) {
        meses[key] = { mes: key, receita: 0, custos: 0, lucro: 0, bot: 0, steak: 0, event: 0 };
      }

      const sessionReceita = (s.items || []).reduce(
        (acc: number, item: any) =>
          acc + Number(item.precoUnitario || 0) * Number(item.quantidade || 0),
        0,
      );

      const sessionCusto = (s.items || []).reduce((acc: number, item: any) => {
        const d = allDrinks.find((x) => x.id === item.drinkId);

        if (s.modalidade === "Goat Botequim") {
          const goatCost = Number(item.custoUnitario ?? d?.modalityConfig?.goatbotequim?.cost ?? 0);
          return acc + goatCost * Number(item.quantidade || 0);
        }

        if (item.custoInsumo !== undefined && item.custoInsumo !== null) {
          return acc + Number(item.custoInsumo || 0) * Number(item.quantidade || 0);
        }

        const fallbackCost = Number(d?.modalityConfig?.evento?.cost || d?.custoUnitario || 0);
        return acc + fallbackCost * Number(item.quantidade || 0);
      }, 0);

      const maoDeObra =
        s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0
          ? s.maoDeObraDetalhes.reduce((a: number, b: any) => a + b.valor, 0)
          : s.maoDeObraValor * s.maoDeObraQtd;

      if (s.modalidade === "Goat Botequim") {
        const resLiq = sessionReceita - sessionCusto;
        const sessionLucro = resLiq * 0.6 - maoDeObra;

        meses[key].receita += sessionReceita;
        meses[key].custos += sessionCusto + resLiq * 0.4 + maoDeObra;
        meses[key].lucro += sessionLucro;
        meses[key].bot += sessionLucro;
      } else {
        const receitaGoat = (s.items || []).reduce((acc: number, item: any) => {
          const d =
            allDrinks.find((x) => x.id === item.drinkId) ||
            allDrinks.find((x) => x.nome === item.nome || x.nome === item.drink_name);
          const cost =
            item.custoUnitario !== undefined && item.custoUnitario !== null
              ? Number(item.custoUnitario)
              : Number(d?.modalityConfig?.steakhouse?.cost ?? 0);
          return acc + cost * Number(item.quantidade || 0);
        }, 0);

        const reposicao = Number(s.reposicaoRestaurante || 0);
        const sessionLucro = receitaGoat - sessionCusto - maoDeObra - reposicao;

        meses[key].receita += receitaGoat;
        meses[key].custos += sessionCusto + maoDeObra + reposicao;
        meses[key].lucro += sessionLucro;
        meses[key].steak += sessionLucro;
      }
    });

    filteredEventos.forEach((e) => {
      const s = e.status?.toUpperCase();
      if (!["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(s)) return;

      const date = new Date(e.date || e.data || 0);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!meses[key]) {
        meses[key] = { mes: key, receita: 0, custos: 0, lucro: 0, bot: 0, steak: 0, event: 0 };
      }

      const receita = e.current_budget_value || 0;
      const lucro = e.current_profit_value || 0;

      meses[key].receita += receita;
      meses[key].custos += receita - lucro;
      meses[key].lucro += lucro;
      meses[key].event += lucro;
    });

    return Object.values(meses).sort((a, b) => b.mes.localeCompare(a.mes));
  }, [filteredSessions, filteredEventos, allDrinks]);

  const ganhosTerceiros = useMemo(() => {
    const valorRepassadoGoatBotequim = filteredSessions
      .filter((s) => s.modalidade === "Goat Botequim")
      .reduce((acc, s) => {
        const lucroBrutoSessao = (s.items || []).reduce((sum: number, item: any) => {
          const receitaItem = Number(item.precoUnitario || 0) * Number(item.quantidade || 0);

          const drink =
            allDrinks.find((d) => d.id === item.drinkId) ||
            allDrinks.find((d) => d.nome === item.nome || d.nome === item.drink_name);

          const custoItem =
            Number(item.custoUnitario ?? drink?.modalityConfig?.goatbotequim?.cost ?? 0) *
            Number(item.quantidade || 0);

          return sum + (receitaItem - custoItem);
        }, 0);

        return acc + lucroBrutoSessao * 0.4;
      }, 0);

    const valorRetido7Steakhouse = filteredSessions
      .filter((s) => s.modalidade === "7Steakhouse")
      .reduce((acc, s) => {
        const retidoSessao = (s.items || []).reduce((sum: number, item: any) => {
          const d =
            allDrinks.find((x) => x.id === item.drinkId) ||
            allDrinks.find((x) => x.nome === item.nome || x.nome === item.drink_name);
          const cost = Number(d?.modalityConfig?.steakhouse?.cost ?? item.custoUnitario ?? 0);
          return sum + (Number(item.precoUnitario || 0) - cost) * Number(item.quantidade || 0);
        }, 0);

        return acc + retidoSessao;
      }, 0);

    return { valorRepassadoGoatBotequim, valorRetido7Steakhouse };
  }, [filteredSessions, allDrinks]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Operações Financeiras"
        subtitle="Controle de vendas, custos e lucratividade operacional."
        periodo={
          <div className="relative">
            <select
              value={periodoDias}
              onChange={(e) => setPeriodoDias(Number(e.target.value))}
              className="appearance-none inline-flex items-center gap-2 pl-4 pr-10 py-2 rounded-lg border border-border bg-surface text-sm font-medium hover:border-border-strong transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value={30}>Últimos 30 dias</option>
              <option value={-1}>Este mês</option>
              <option value={-2}>Mês anterior</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={0}>Todo o período</option>
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none rotate-90" />
          </div>
        }
      />

      <div className="page-container space-y-7">
        <div className="flex w-full max-w-full overflow-x-auto items-center gap-1 p-1 bg-surface border border-border rounded-xl md:w-fit">
          {["Goat Botequim", "7Steakhouse", "Eventos", "Consolidação"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground">Carregando dados financeiros...</div>
        )}

        {activeTab === "Goat Botequim" && (
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Receita Bruta" value={fmtBRL(metrics.bot.receita)} />
              <StatCard label="Custo Drinks" value={fmtBRL(metrics.bot.custo)} />
              <StatCard
                label="Resultado Líquido"
                value={fmtBRL(metrics.bot.receita - metrics.bot.custo)}
              />
              <StatCard
                label="Repasse (40%)"
                value={fmtBRL((metrics.bot.receita - metrics.bot.custo) * 0.4)}
              />
              <StatCard
                label="Mão de Obra"
                value={fmtBRL(
                  filteredSessions
                    .filter((s) => s.modalidade === "Goat Botequim")
                    .reduce((acc, s) => {
                      if (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0) {
                        return (
                          acc +
                          s.maoDeObraDetalhes.reduce(
                            (a: number, b: any) => a + Number(b.valor || 0),
                            0,
                          )
                        );
                      }

                      return acc + Number(s.maoDeObraValor || 0) * Number(s.maoDeObraQtd || 0);
                    }, 0),
                )}
              />
              <StatCard label="Lucro Final" value={fmtBRL(metrics.bot.lucro)} highlight />
            </div>

            <div className="flex justify-stretch sm:justify-end">
              <PrimaryButton onClick={openNewSessionModal}>
                <Plus className="h-4 w-4 mr-2" /> Lançar Sessão Botequim
              </PrimaryButton>
            </div>

            <SectionCard
              title="Sessões Lançadas"
              subtitle="Histórico de vendas consolidadas por dia"
            >
              <div className="space-y-4">
                {filteredSessions
                  .filter((s) => s.modalidade === "Goat Botequim")
                  .map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      drinks={allDrinks}
                      onEdit={() => handleEditSession(s)}
                      onDelete={() => handleDeleteSession(s.id)}
                      onRefresh={() => handleRefreshSession(s)}
                    />
                  ))}

                {filteredSessions.filter((s) => s.modalidade === "Goat Botequim").length === 0 && (
                  <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                    Nenhuma sessão lançada.
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "7Steakhouse" && (
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard label="Receita Goatbar" value={fmtBRL(metrics.steak.receita)} />
              <StatCard label="Custo Insumos" value={fmtBRL(metrics.steak.custo)} />
              <StatCard
                label="Lucro Bruto"
                value={fmtBRL(metrics.steak.receita - metrics.steak.custo)}
              />
              <StatCard
                label="Lucro Retido Rest."
                value={fmtBRL(ganhosTerceiros.valorRetido7Steakhouse)}
              />
              <StatCard
                label="Mão de Obra"
                value={fmtBRL(
                  filteredSessions
                    .filter((s) => s.modalidade === "7Steakhouse")
                    .reduce(
                      (acc, s) =>
                        acc +
                        (s.maoDeObraDetalhes && s.maoDeObraDetalhes.length > 0
                          ? s.maoDeObraDetalhes.reduce(
                              (a: number, b: any) => a + Number(b.valor || 0),
                              0,
                            )
                          : Number(s.maoDeObraValor || 0) * Number(s.maoDeObraQtd || 0)),
                      0,
                    ),
                )}
              />
              <StatCard label="Lucro F. Goatbar" value={fmtBRL(metrics.steak.lucro)} highlight />
            </div>

            <div className="flex justify-end">
              <PrimaryButton onClick={openNewSessionModal}>
                <Plus className="h-4 w-4 mr-2" /> Lançar Semana Steakhouse
              </PrimaryButton>
            </div>

            <SectionCard
              title="Sessões Semanais Lançadas"
              subtitle="Vendas diárias agregadas por semana"
            >
              <div className="space-y-4">
                {filteredSessions
                  .filter((s) => s.modalidade === "7Steakhouse")
                  .map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      drinks={allDrinks}
                      onEdit={() => handleEditSession(s)}
                      onDelete={() => handleDeleteSession(s.id)}
                      onRefresh={() => handleRefreshSession(s)}
                    />
                  ))}

                {filteredSessions.filter((s) => s.modalidade === "7Steakhouse").length === 0 && (
                  <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl">
                    Nenhuma sessão lançada.
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "Eventos" && (
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <StatCard label="Receita Total" value={fmtBRL(metrics.events.receita)} />
              <StatCard label="Custos Totais" value={fmtBRL(metrics.events.custo)} />
              <StatCard label="Lucro Acumulado" value={fmtBRL(metrics.events.lucro)} highlight />
            </div>

            <SectionCard
              title="Eventos Integrados"
              subtitle="Eventos confirmados e finalizados aparecem aqui automaticamente"
              action={
                <PrimaryButton
                  onClick={() => {
                    setLegacyForm({
                      clientName: "",
                      eventType: "Casamento",
                      date: new Date().toISOString().split("T")[0],
                      city: "São Paulo",
                      guests: 100,
                      drinks: [],
                      finalBudgetValue: "",
                      paidValue: "",
                    });
                    setShowLegacyEventModal(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Lançar Evento Antigo
                </PrimaryButton>
              }
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-y border-border">
                      <th className="px-6 py-3 label-eyebrow">Evento</th>
                      <th className="px-6 py-3 label-eyebrow">Data</th>
                      <th className="px-6 py-3 label-eyebrow">Receita</th>
                      <th className="px-6 py-3 label-eyebrow">Custos</th>
                      <th className="px-6 py-3 label-eyebrow text-success">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEventos
                      .filter((e) =>
                        ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(
                          e.status?.toUpperCase(),
                        ),
                      )
                      .map((e) => {
                        const receita = e.current_budget_value || 0;
                        const lucro = e.current_profit_value || 0;
                        const custo = receita - lucro;
                        const contract = contractsSupabase.find((c) => c.event_id === e.id);
                        const isSigned = contract?.status === "signed";

                        return (
                          <tr
                            key={e.id}
                            className="border-b border-border/60 hover:bg-surface/50 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium">
                              <div>{e.client_name || e.nome}</div>
                              <div className="mt-1">
                                {isSigned ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[9px] font-bold uppercase tracking-widest border border-success/20">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> Contrato Assinado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold uppercase tracking-widest border border-warning/20">
                                    <AlertCircle className="h-2.5 w-2.5" /> Contrato Pendente
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {e.date
                                ? new Date(e.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                                : "--"}
                            </td>
                            <td className="px-6 py-4">{fmtBRL(receita)}</td>
                            <td className="px-6 py-4 text-muted-foreground">{fmtBRL(custo)}</td>
                            <td className="px-6 py-4 text-success font-semibold">
                              {fmtBRL(lucro)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "Consolidação" && (
          <div className="space-y-7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <StatCard label="Receita Consolidada" value={fmtBRL(metrics.consolidated.receita)} />
              <StatCard
                label="Custos Consolidados"
                value={fmtBRL(metrics.consolidated.receita - metrics.consolidated.lucro)}
              />
              <StatCard
                label="Lucro Total Goat Bar"
                value={fmtBRL(metrics.consolidated.lucro)}
                highlight
              />
            </div>

            <SectionCard
              title="Ganhos de Terceiros"
              subtitle="Valores repassados e retidos nas operações do 7Steakhouse"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SummaryCard
                  label="Repassado para Goat Botequim"
                  value={ganhosTerceiros.valorRepassadoGoatBotequim}
                  color="bg-primary"
                  icon={<ShoppingBag className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Retido pela 7Steakhouse"
                  value={ganhosTerceiros.valorRetido7Steakhouse}
                  color="bg-success"
                  icon={<Utensils className="h-4 w-4" />}
                />
              </div>
            </SectionCard>

            <SectionCard title="Evolução Mensal" subtitle="Resumo consolidado por mês de operação">
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-y border-border">
                      <th className="px-6 py-3 label-eyebrow">Mês</th>
                      <th className="px-6 py-3 label-eyebrow">Receita Consolidada</th>
                      <th className="px-6 py-3 label-eyebrow">Custos/Operação</th>
                      <th className="px-6 py-3 label-eyebrow text-success">Lucro Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsMensal.map((m) => {
                      const [year, month] = m.mes.split("-");
                      const date = new Date(Number(year), Number(month) - 1, 1);
                      const monthName = date.toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      });

                      return (
                        <tr
                          key={m.mes}
                          className="border-b border-border/60 hover:bg-surface/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium capitalize">{monthName}</td>
                          <td className="px-6 py-4">{fmtBRL(m.receita)}</td>
                          <td className="px-6 py-4 text-muted-foreground">{fmtBRL(m.custos)}</td>
                          <td className="px-6 py-4 text-success font-semibold">
                            {fmtBRL(m.lucro)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Distribuição por Modalidade (Geral)"
              subtitle="Participação de cada unidade no lucro acumulado"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SummaryCard
                  label="Goat Botequim"
                  value={metrics.bot.lucro}
                  color="bg-primary"
                  icon={<ShoppingBag className="h-4 w-4" />}
                />
                <SummaryCard
                  label="7Steakhouse"
                  value={metrics.steak.lucro}
                  color="bg-success"
                  icon={<Utensils className="h-4 w-4" />}
                />
                <SummaryCard
                  label="Eventos"
                  value={metrics.events.lucro}
                  color="bg-amber-500"
                  icon={<Calendar className="h-4 w-4" />}
                />
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">
                {editingSessionId ? "Editar Sessão" : "Lançar Sessão"} — {activeTab}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="label-eyebrow block mb-2">Data da Operação</label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="label-eyebrow">Drinks Vendidos</label>
                  <GhostButton onClick={addItem} className="h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </GhostButton>
                </div>

                {modalItems.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                    {filteredDrinks.length === 0
                      ? `Nenhum drink configurado para ${activeTab}. Cadastre um drink com essa modalidade ativa.`
                      : 'Clique em "Adicionar" para inserir drinks vendidos.'}
                  </div>
                )}

                {modalItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center"
                  >
                    <select
                      value={item.drinkId}
                      onChange={(e) => updateItem(idx, "drinkId", e.target.value)}
                      className="flex-1 h-10 px-3 rounded-lg bg-input border border-border text-sm"
                    >
                      {filteredDrinks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))}
                      className="w-20 h-10 px-3 rounded-lg bg-input border border-border text-sm"
                    />

                    <div className="flex flex-col text-xs text-muted-foreground px-2">
                      {activeTab === "7Steakhouse" ? (
                        <>
                          <div>
                            Venda Final:{" "}
                            <span className="text-foreground font-medium">
                              {fmtBRL(Number(item.precoUnitario || 0))}
                            </span>
                          </div>
                          <div>
                            Custo Op.:{" "}
                            <span className="text-foreground font-medium text-primary">
                              {fmtBRL(Number(item.custoUnitario || 0))}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div>
                          Venda:{" "}
                          <span className="text-foreground font-medium">
                            {fmtBRL(Number(item.precoUnitario || 0))}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col text-xs text-muted-foreground px-2">
                      {activeTab === "7Steakhouse" ? (
                        <div>
                          Custo Insumo:{" "}
                          <span className="text-foreground font-medium">
                            {fmtBRL(Number(item.custoInsumo ?? item.custoUnitario ?? 0))}
                          </span>
                        </div>
                      ) : (
                        <div>
                          Custo:{" "}
                          <span className="text-foreground font-medium">
                            {fmtBRL(Number(item.custoUnitario || 0))}
                          </span>
                        </div>
                      )}
                    </div>

                    <GhostButton
                      onClick={() => removeItem(idx)}
                      className="h-10 w-10 px-0 text-destructive hover:text-destructive justify-center"
                      aria-label="Excluir drink lançado"
                      title="Excluir drink lançado"
                    >
                      <Trash2 className="h-4 w-4" />
                    </GhostButton>
                  </div>
                ))}
              </div>

              {activeTab === "7Steakhouse" ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="label-eyebrow">Mão de Obra Detalhada (Semanal)</label>
                      <GhostButton
                        onClick={() => setMaoDeObraDetalhes(generateSteakhouseDays(modalDate))}
                        className="h-8 text-[10px] uppercase font-bold"
                      >
                        Gerar Dias
                      </GhostButton>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {maoDeObraDetalhes.map((d, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-border bg-background/40 space-y-2"
                        >
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">
                            {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR", {
                              weekday: "long",
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </div>

                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[8px] uppercase text-muted-foreground block mb-1">
                                Valor
                              </label>
                              <input
                                type="number"
                                value={d.valor}
                                onChange={(e) => {
                                  const newD = [...maoDeObraDetalhes];
                                  newD[i].valor = Number(e.target.value);
                                  setMaoDeObraDetalhes(newD);
                                }}
                                className="w-full h-8 px-2 rounded bg-input border border-border text-xs"
                              />
                            </div>

                            <div className="flex-1">
                              <label className="text-[8px] uppercase text-muted-foreground block mb-1">
                                Pessoas
                              </label>
                              <input
                                type="number"
                                value={d.qtdPessoas}
                                onChange={(e) => {
                                  const newD = [...maoDeObraDetalhes];
                                  newD[i].qtdPessoas = Number(e.target.value);
                                  setMaoDeObraDetalhes(newD);
                                }}
                                className="w-full h-8 px-2 rounded bg-input border border-border text-xs"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[8px] uppercase text-muted-foreground block mb-1">
                              Nomes
                            </label>
                            <input
                              type="text"
                              value={d.nomes || ""}
                              onChange={(e) => {
                                const newD = [...maoDeObraDetalhes];
                                newD[i].nomes = e.target.value;
                                setMaoDeObraDetalhes(newD);
                              }}
                              placeholder="Ex.: João e Maria"
                              className="w-full h-8 px-2 rounded bg-input border border-border text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="label-eyebrow">
                        Reposições de Insumos pelo Restaurante
                      </label>
                      <GhostButton
                        onClick={() =>
                          setCustosRestauranteDetalhes([
                            ...custosRestauranteDetalhes,
                            { descricao: "", valor: 0 },
                          ])
                        }
                        className="h-8 text-[10px] uppercase font-bold"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Reposição
                      </GhostButton>
                    </div>

                    {custosRestauranteDetalhes.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-background/20">
                        Nenhuma reposição lançada para esta semana.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {custosRestauranteDetalhes.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.descricao}
                              onChange={(e) => {
                                const newC = [...custosRestauranteDetalhes];
                                newC[idx].descricao = e.target.value;
                                setCustosRestauranteDetalhes(newC);
                              }}
                              placeholder="Descrição (Ex: Hortelã, Limão)"
                              className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-xs"
                            />

                            <input
                              type="number"
                              value={item.valor || ""}
                              onChange={(e) => {
                                const newC = [...custosRestauranteDetalhes];
                                newC[idx].valor = Number(e.target.value);
                                setCustosRestauranteDetalhes(newC);
                              }}
                              placeholder="Valor"
                              className="w-24 h-9 px-3 rounded-lg bg-input border border-border text-xs"
                            />

                            <button
                              onClick={() => {
                                setCustosRestauranteDetalhes(
                                  custosRestauranteDetalhes.filter((_, i) => i !== idx),
                                );
                              }}
                              className="h-9 w-9 rounded-lg flex items-center justify-center bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}

                        <div className="text-right text-xs font-bold text-muted-foreground pt-2">
                          Total Reposição:{" "}
                          <span className="text-destructive font-black text-sm">
                            {fmtBRL(reposicaoRestaurante)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label-eyebrow block mb-2">Quem trabalhou (nomes)</label>
                    <input
                      type="text"
                      value={maoDeObraNomes}
                      onChange={(e) => setMaoDeObraNomes(e.target.value)}
                      placeholder="Ex.: João, Maria, Carlos"
                      className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-eyebrow block mb-2">Custo Mão de Obra (Dia)</label>
                      <input
                        type="number"
                        value={maoDeObraValor}
                        onChange={(e) => setMaoDeObraValor(Number(e.target.value))}
                        className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm"
                      />
                    </div>

                    <div>
                      <label className="label-eyebrow block mb-2">Qtd Dias/Equipe</label>
                      <input
                        type="number"
                        value={maoDeObraQtd}
                        onChange={(e) => setMaoDeObraQtd(Number(e.target.value))}
                        className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton onClick={handleSave}>Salvar Lançamento</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {showLegacyEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Lançar Evento Antigo (Legado)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Insira as informações básicas do evento realizado antes do sistema
                </p>
              </div>
              <button
                onClick={() => setShowLegacyEventModal(false)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1.5">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Casamento João & Maria"
                    value={legacyForm.clientName}
                    onChange={(e) => setLegacyForm((p) => ({ ...p, clientName: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Tipo de Evento *</label>
                  <select
                    value={legacyForm.eventType}
                    onChange={(e) => setLegacyForm((p) => ({ ...p, eventType: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  >
                    {["Casamento", "Corporativo", "Aniversário", "Confraternização", "Outros"].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Data do Evento *</label>
                  <input
                    type="date"
                    required
                    value={legacyForm.date}
                    onChange={(e) => setLegacyForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Cidade do Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo"
                    value={legacyForm.city}
                    onChange={(e) => setLegacyForm((p) => ({ ...p, city: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Número de Convidados</label>
                  <input
                    type="number"
                    value={legacyForm.guests || ""}
                    onChange={(e) =>
                      setLegacyForm((p) => ({
                        ...p,
                        guests: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Valor do Orçamento (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={legacyForm.finalBudgetValue}
                    onChange={(e) =>
                      setLegacyForm((p) => ({ ...p, finalBudgetValue: e.target.value }))
                    }
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Valor já Pago (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={legacyForm.paidValue}
                    onChange={(e) => setLegacyForm((p) => ({ ...p, paidValue: e.target.value }))}
                    className="w-full h-10 px-4 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Drinks Section */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="label-eyebrow block">Drinks do Cardápio *</label>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar drink..."
                      value={buscaDrinkLegacy}
                      onChange={(e) => setBuscaDrinkLegacy(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-lg bg-input border border-border focus:border-primary focus:outline-none text-xs transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto p-1.5 border border-border rounded-lg bg-background/50">
                  {allDrinks
                    .filter((d) => d.nome.toLowerCase().includes(buscaDrinkLegacy.toLowerCase()))
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map((d) => {
                      const isSelected = legacyForm.drinks.includes(d.id);
                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            setLegacyForm((p) => {
                              const alreadySelected = p.drinks.includes(d.id);
                              const nextDrinks = alreadySelected
                                ? p.drinks.filter((x) => x !== d.id)
                                : [...p.drinks, d.id];
                              return { ...p, drinks: nextDrinks };
                            });
                          }}
                          className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer group flex flex-col h-24 select-none ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm scale-[0.98]"
                              : "border-border bg-surface hover:border-primary/40 hover:scale-[1.02]"
                          }`}
                        >
                          {d.imagem ? (
                            <div className="h-16 overflow-hidden relative">
                              <img
                                src={d.imagem}
                                alt={d.nome}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-16 bg-muted flex items-center justify-center relative">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">
                                Sem imagem
                              </span>
                              {isSelected && (
                                <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          )}
                          <div className="p-1.5 text-[11px] font-bold text-center truncate bg-surface/90 border-t border-border/40">
                            {d.nome}
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="text-[11px] text-muted-foreground text-right">
                  {legacyForm.drinks.length} drink(s) selecionado(s)
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0">
              <GhostButton onClick={() => setShowLegacyEventModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={handleSaveLegacyEvent}
                disabled={
                  savingLegacyEvent ||
                  !legacyForm.clientName ||
                  !legacyForm.date ||
                  !legacyForm.finalBudgetValue ||
                  !legacyForm.paidValue ||
                  legacyForm.drinks.length === 0
                }
              >
                {savingLegacyEvent ? "Salvando..." : "Salvar Evento Antigo"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  drinks,
  onEdit,
  onDelete,
  onRefresh,
}: {
  session: any;
  drinks: any[];
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSteak = session.modalidade === "7Steakhouse";

  const toFiniteNumber = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    if (typeof value === "string") {
      const normalized = value
        .trim()
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^0-9.-]/g, "");

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const items = session.items || [];
  const totalDrinks = items.reduce((acc: number, i: any) => acc + Number(i.quantidade || 0), 0);
  const sessionDate = new Date(session.data + "T12:00:00");
  const sessionEndDate = new Date(sessionDate.getTime() + 3 * 24 * 60 * 60 * 1000);

  const calc = useMemo(() => {
    const rb = items.reduce((acc: number, i: any) => {
      const fallbackDrink =
        drinks.find((d) => d.id === i.drinkId) ||
        drinks.find((d) => d.nome === i.nome || d.nome === i.drink_name);

      const livePrice = fallbackDrink
        ? (isSteak ? fallbackDrink.modalityConfig?.steakhouse?.price : fallbackDrink.modalityConfig?.goatbotequim?.price)
        : undefined;

      const price = toFiniteNumber(
        livePrice !== undefined && livePrice !== null ? livePrice : i.precoUnitario
      );

      return acc + price * toFiniteNumber(i.quantidade);
    }, 0);

    const rg = items.reduce((acc: number, i: any) => {
      const fallbackDrink =
        drinks.find((d) => d.id === i.drinkId) ||
        drinks.find((d) => d.nome === i.nome || d.nome === i.drink_name);

      const liveSteakCost = fallbackDrink?.modalityConfig?.steakhouse?.cost;
      const liveGoatCost = fallbackDrink?.modalityConfig?.goatbotequim?.cost;

      const steakOperationalCost = toFiniteNumber(
        liveSteakCost !== undefined && liveSteakCost !== null
          ? liveSteakCost
          : (i.custoUnitario !== undefined && i.custoUnitario !== null
            ? i.custoUnitario
            : (fallbackDrink?.custoUnitario ?? 0))
      );

      const goatOperationalCost = toFiniteNumber(
        liveGoatCost !== undefined && liveGoatCost !== null
          ? liveGoatCost
          : (i.custoUnitario !== undefined && i.custoUnitario !== null
            ? i.custoUnitario
            : (fallbackDrink?.custoUnitario ?? 0))
      );

      const operationalCost = isSteak ? steakOperationalCost : goatOperationalCost;

      return acc + operationalCost * toFiniteNumber(i.quantidade);
    }, 0);

    const ci = items.reduce((acc: number, i: any) => {
      const fallbackDrink =
        drinks.find((d) => d.id === i.drinkId) ||
        drinks.find((d) => d.nome === i.nome || d.nome === i.drink_name);

      let liveCost: number | undefined;
      if (fallbackDrink) {
        liveCost = isSteak
          ? (fallbackDrink.modalityConfig?.evento?.cost ?? fallbackDrink.custoUnitario)
          : (fallbackDrink.modalityConfig?.goatbotequim?.cost ?? fallbackDrink.custoUnitario);
      }

      const itemCost = toFiniteNumber(
        liveCost !== undefined && liveCost !== null
          ? liveCost
          : (isSteak ? (i.custoInsumo ?? i.custoUnitario ?? 0) : (i.custoUnitario ?? i.custoInsumo ?? 0))
      );

      return acc + itemCost * toFiniteNumber(i.quantidade);
    }, 0);

    const lb = rb - ci;
    const rep = lb * 0.4;
    const saldo = lb - rep;

    const mo =
      session.maoDeObraDetalhes && session.maoDeObraDetalhes.length > 0
        ? session.maoDeObraDetalhes.reduce((a: number, b: any) => a + toFiniteNumber(b.valor), 0)
        : toFiniteNumber(session.maoDeObraValor) * toFiniteNumber(session.maoDeObraQtd);

    const reposicao = Number(session.reposicaoRestaurante || 0);

    return {
      receitaBruta: rb,
      receitaGoat: rg,
      custoInsumos: ci,
      lucroRetidoRest: rb - rg,
      lucroBruto: isSteak ? rg - ci : lb,
      repasse: rep,
      saldoGoat: saldo,
      maoDeObra: mo,
      reposicao,
      lucroFinal: isSteak ? rg - ci - mo - reposicao : saldo - mo,
    };
  }, [session, isSteak, drinks]);

  return (
    <div
      className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
        isExpanded
          ? "border-primary bg-surface shadow-2xl shadow-primary/5"
          : "border-border bg-surface/40 hover:border-primary/30"
      }`}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center cursor-pointer select-none"
      >
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center transition-transform duration-500 ${
              isExpanded
                ? "bg-primary text-white scale-110"
                : "bg-background text-muted-foreground border border-border"
            }`}
          >
            {isSteak ? <Utensils className="h-6 w-6" /> : <ShoppingBag className="h-6 w-6" />}
          </div>

          <div>
            <div className="font-bold text-base flex items-center gap-2">
              {isSteak
                ? `${sessionDate.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                  })} até ${sessionEndDate.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                  })}`
                : sessionDate.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}

              <ChevronRight
                className={`h-4 w-4 text-primary transition-transform duration-300 ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
            </div>

            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">
              {totalDrinks} drinks
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto space-y-3">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 sm:gap-8">
            <div className="text-left sm:text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                {isSteak ? "Venda Final" : "Receita"}
              </div>
              <div className="font-black text-sm">{fmtBRL(calc.receitaBruta)}</div>
            </div>

            {isSteak && (
              <div className="text-left sm:text-right">
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                  Receita Goat Bar
                </div>
                <div className="font-black text-sm text-primary">{fmtBRL(calc.receitaGoat)}</div>
              </div>
            )}

            <div className="text-left sm:text-right">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">
                Lucro Final
              </div>
              <div className="font-black text-sm text-success">{fmtBRL(calc.lucroFinal)}</div>
            </div>
          </div>

          <div className="flex gap-2 justify-end md:ml-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="h-9 w-9 rounded-lg flex items-center justify-center bg-background border border-border hover:border-primary hover:text-primary transition-all shadow-sm"
              title="Atualizar dados da sessão"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="h-9 w-9 rounded-lg flex items-center justify-center bg-background border border-border hover:border-primary hover:text-primary transition-all shadow-sm"
            >
              <Pencil className="h-4 w-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-9 w-9 rounded-lg flex items-center justify-center bg-background border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all shadow-sm"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-6 border-t border-border/50">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                Itens Vendidos
              </h4>

              <div className="space-y-3">
                {items.map((it: any, i: number) => {
                  const drinkObj =
                    drinks.find((d) => d.id === it.drinkId) ||
                    drinks.find((d) => d.nome === it.nome || d.nome === it.drink_name);

                  const livePrice = drinkObj
                    ? (isSteak ? drinkObj.modalityConfig?.steakhouse?.price : drinkObj.modalityConfig?.goatbotequim?.price)
                    : undefined;

                  const resolvedPrecoUnitario = toFiniteNumber(
                    livePrice !== undefined && livePrice !== null ? livePrice : it.precoUnitario
                  );

                  const liveCost = drinkObj
                    ? (isSteak ? drinkObj.modalityConfig?.steakhouse?.cost : drinkObj.modalityConfig?.goatbotequim?.cost)
                    : undefined;

                  const resolvedCustoUnitario = toFiniteNumber(
                    liveCost !== undefined && liveCost !== null
                      ? liveCost
                      : (it.custoUnitario !== undefined && it.custoUnitario !== null
                        ? it.custoUnitario
                        : (drinkObj?.custoUnitario ?? 0))
                  );

                  return (
                    <div
                      key={i}
                      className="flex justify-between items-start text-xs group/item py-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-black text-primary w-6">{it.quantidade}x</span>
                        <span className="font-medium text-foreground/80">{it.nome}</span>
                      </div>

                      <div className="text-right">
                        {isSteak ? (
                          <>
                            <div className="font-bold text-muted-foreground group-hover/item:text-foreground transition-colors">
                              {fmtBRL(
                                resolvedPrecoUnitario * toFiniteNumber(it.quantidade),
                              )}
                              <span className="text-[10px] font-normal ml-1 text-muted-foreground/60">
                                (Venda)
                              </span>
                            </div>
                            <div className="text-[10px] text-primary font-bold">
                              {fmtBRL(
                                resolvedCustoUnitario * toFiniteNumber(it.quantidade),
                              )}
                              <span className="text-[9px] font-normal ml-1 text-muted-foreground/60">
                                (Custo Op.)
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="font-bold text-muted-foreground group-hover/item:text-foreground transition-colors">
                            {fmtBRL(
                              resolvedPrecoUnitario * toFiniteNumber(it.quantidade),
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-border/40 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    {isSteak ? "Valor de Venda Final" : "Total Receita"}
                  </span>
                  <span className="font-black text-sm">{fmtBRL(calc.receitaBruta)}</span>
                </div>

                {isSteak && (
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      Receita Goat Bar
                    </span>
                    <span className="font-black text-sm text-primary">
                      {fmtBRL(calc.receitaGoat)}
                    </span>
                  </div>
                )}

                <div className="pt-1 border-t border-border/20 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Lucro Final
                  </span>
                  <span className="font-black text-sm text-success">{fmtBRL(calc.lucroFinal)}</span>
                </div>
              </div>

              {isSteak &&
                session.custosRestauranteDetalhes &&
                session.custosRestauranteDetalhes.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border/50 space-y-4">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                      Reposições do Restaurante
                    </h4>

                    <div className="space-y-3">
                      {session.custosRestauranteDetalhes.map((it: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs group/item"
                        >
                          <span className="font-medium text-foreground/80">{it.descricao}</span>
                          <span className="font-bold text-muted-foreground">
                            {fmtBRL(toFiniteNumber(it.valor))}
                          </span>
                        </div>
                      ))}

                      <div className="pt-3 border-t border-border/40 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          Total Reposição
                        </span>
                        <span className="font-black text-sm text-destructive">
                          {fmtBRL(calc.reposicao)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                Cálculo de Lucro
              </h4>

              <div className="bg-background/40 rounded-2xl p-5 border border-border/50 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {isSteak ? "Valor de Venda Final" : "Receita Bruta"}
                    </span>
                    <span className="font-bold">{fmtBRL(calc.receitaBruta)}</span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      (-) {isSteak ? "Custo Insumos (Produção)" : "Custo dos Drinks"}
                    </span>
                    <span className="text-muted-foreground">{fmtBRL(calc.custoInsumos)}</span>
                  </div>

                  <div className="flex justify-between text-sm pt-2 border-t border-border/20">
                    <span className="font-bold">(=) Lucro Bruto</span>
                    <span className="font-black">{fmtBRL(calc.lucroBruto)}</span>
                  </div>
                </div>

                {isSteak && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-primary font-medium">Receita Goat Bar</span>
                      <span className="text-primary font-bold">{fmtBRL(calc.receitaGoat)}</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-warning font-medium">Lucro Retido (Restaurante)</span>
                      <span className="text-warning font-bold">{fmtBRL(calc.lucroRetidoRest)}</span>
                    </div>
                  </div>
                )}

                {!isSteak && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-warning font-medium">(-) Repasse 40% Restaurante</span>
                      <span className="text-warning font-bold">{fmtBRL(calc.repasse)}</span>
                    </div>

                    <div className="flex justify-between text-xs pt-1">
                      <span className="font-bold text-foreground/70">
                        (=) Saldo Operacional (GoatBar)
                      </span>
                      <span className="font-bold">{fmtBRL(calc.saldoGoat)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-destructive font-medium">
                      (-) Mão de Obra {isSteak ? "Semanal" : "do Dia"}
                    </span>
                    <span className="text-destructive font-bold">{fmtBRL(calc.maoDeObra)}</span>
                  </div>

                  {isSteak && (
                    <div className="flex justify-between text-xs text-destructive">
                      <span className="font-medium">(-) Reposição Restaurante</span>
                      <span className="font-bold">{fmtBRL(calc.reposicao)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-primary/20 flex justify-between items-end">
                  <div>
                    <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">
                      Lucro Final
                    </div>
                    <div className="text-2xl font-black font-display text-success">
                      {fmtBRL(calc.lucroFinal)}
                    </div>
                  </div>

                  <div className="pb-1">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-surface/50">
      <div className="flex items-center gap-3 mb-4">
        <div className={`h-8 w-8 rounded-lg ${color} text-white flex items-center justify-center`}>
          {icon}
        </div>
        <div className="font-medium text-sm">{label}</div>
      </div>

      <div className="text-2xl font-bold font-display">{fmtBRL(value)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Lucro acumulado</div>
    </div>
  );
}
