import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { calcularOrcamentoEvento, type Evento, type EventoStatus } from "@/lib/mock-data";
import { fmtBRL } from "@/lib/format";
import { Calendar, MapPin, Users, ArrowLeft, Save, Plus, Trash2, MessageCircle, FileSignature, CheckCircle2, Download, AlertCircle, Link as LinkIcon, Loader2, Copy, Megaphone, UserPlus, History, Clock, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/app-store";
import { 
  contractTemplatesService, 
  contractSignersService, 
  eventContractsService,
  clientContractFormService,
  type ContractTemplate,
  type ContractSigner
} from "@/services/contract-service";

import { eventBudgetService, type Event as RealEvent, type BudgetVersion, type BudgetHistory, type NegotiationHistory } from "@/services/event-budget-service";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Search } from "lucide-react";

export const Route = createFileRoute("/eventos/$eventoId")({
  component: EventoInterna,
});

const HeaderField = ({ label, value, isEditing, onChange, icon, type = "text" }: { label: string, value: string, isEditing: boolean, onChange: (v: string) => void, icon?: React.ReactNode, type?: string }) => (
  <div className="space-y-1">
    <div className="label-eyebrow flex items-center gap-1">{icon} {label}</div>
    {isEditing ? (
      <input 
        type={type}
        value={value || ""} 
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 px-2 rounded bg-input border border-border text-xs focus:ring-1 focus:ring-primary outline-none transition-all"
      />
    ) : (
      <div className="text-sm font-bold truncate" title={value}>{value || "---"}</div>
    )}
  </div>
);

function EventoInterna() {
  const { eventoId } = Route.useParams();
  const { 
    glasswares,
    drinks: allDrinks
  } = useAppStore();
  
  // --- Estados Reais (Supabase) ---
  const [evento, setEvento] = useState<RealEvent | null>(null);
  const [currentBudget, setCurrentBudget] = useState<BudgetVersion | null>(null);
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistory[]>([]);
  const [negotiationHistory, setNegotiationHistory] = useState<NegotiationHistory[]>([]);
  const [sameDateEvents, setSameDateEvents] = useState<RealEvent[]>([]);
  
  const [realTemplates, setRealTemplates] = useState<ContractTemplate[]>([]);
  const [realSigners, setRealSigners] = useState<ContractSigner[]>([]);
  const [realClientData, setRealClientData] = useState<any>(null);
  const [realContract, setRealContract] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Orçamento");
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [buscaDrink, setBuscaDrink] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedSigner, setSelectedSigner] = useState("");

  useEffect(() => {
    loadAllData();
  }, [eventoId]);

  const loadContractModule = async () => {
    const [tps, sigs, contract] = await Promise.all([
      contractTemplatesService.listTemplates(),
      contractSignersService.listSigners(),
      eventContractsService.getContractByEventId(eventoId)
    ]);
    setRealTemplates(tps);
    setRealSigners(sigs);
    setRealContract(contract);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [
        ev, 
        budget, 
        versions, 
        bHist, 
        nHist,
        tps, 
        sigs,
        contract
      ] = await Promise.all([
        eventBudgetService.getEventById(eventoId),
        eventBudgetService.getCurrentBudget(eventoId),
        eventBudgetService.listBudgetVersions(eventoId),
        eventBudgetService.getBudgetHistory(eventoId),
        eventBudgetService.getNegotiationHistory(eventoId),
        contractTemplatesService.listTemplates(),
        contractSignersService.listSigners(),
        eventContractsService.getContractByEventId(eventoId)
      ]);

      setEvento(ev);
      setCurrentBudget(budget);
      setBudgetVersions(versions);
      setBudgetHistory(bHist);
      setNegotiationHistory(nHist);
      setRealTemplates(tps);
      setRealSigners(sigs);
      setRealContract(contract);
      // Busca específica para dados do cliente (Opcional)
      try {
        const { data: cData } = await supabase
          .from("event_contract_client_data")
          .select("*")
          .eq("event_id", eventoId)
          .maybeSingle();
        setRealClientData(cData);
      } catch (err) {
        console.warn("Tabela de dados de contrato não encontrada ou inacessível:", err);
      }

      // Verificação de mesma data
      if (ev?.date) {
        try {
          const conflicts = await eventBudgetService.checkEventsSameDate(ev.date);
          setSameDateEvents(conflicts.filter(c => c.id !== eventoId));
        } catch (err) {
           console.warn("Erro ao buscar conflitos de data:", err);
        }
      }

      if (!ev) {
        alert("Evento não encontrado no banco de dados.");
        return;
      }

      // Sync draft state with loaded budget
      if (budget) {
        setDraft(mapBudgetToDraft(ev, budget));
      } else {
        setDraft(mapEventToDraft(ev));
      }

    } catch (e: any) {
      console.error("Erro ao carregar dados do evento:", e);
      alert(`Erro crítico ao carregar evento: ${e.message || "Verifique sua conexão"}`);
    } finally {
      setLoading(false);
    }
  };

  const mapEventToDraft = (ev: RealEvent): Evento => ({
    id: ev.id,
    nome: ev.client_name,
    cliente: ev.client_name,
    telefone: ev.phone || "",
    email: ev.email || "",
    data: ev.date,
    horario: ev.event_time || "",
    local: ev.event_location || "",
    cidade: ev.city || "",
    tipo: ev.event_type,
    convidados: ev.guests || 0,
    drinks: Array.isArray(ev.drinks) ? ev.drinks : [],
    observacoes: ev.notes || "",
    status: ev.status as any,
    lead_source: ev.lead_source || "",
    referral_name: ev.referral_name || "",
    is_paid_full: ev.is_paid_full || false,
    drinksPorPessoa: 4,
    markupAdicionalDrinks: 0,
    equipe: {
      bartender: { qtd: 0, valorUnitario: 200 },
      keeper: { qtd: 0, valorUnitario: 200 },
      copeira: { qtd: 0, valorUnitario: 200 },
    },
    gelo: { valorUnitario: 6 },
    viagem: { incluir: false, valor: 0 },
    gastosDiversos: [],
    lucroDesejado: 0,
    pagamento: { formaPagamento: "", percentualPago: 0 },
    coposVinculados: {},
    historicoAlteracoes: [],
    historicoNegociacao: [],
    valorNegociado: 0,
    custoPrevisto: 0,
    desconto: 0,
    descontoMotivo: ""
  });

  const mapBudgetToDraft = (ev: RealEvent, b: BudgetVersion): Evento => ({
    id: ev.id,
    nome: ev.client_name,
    cliente: ev.client_name,
    telefone: ev.phone || "",
    email: ev.email || "",
    data: ev.date,
    horario: ev.event_time || "",
    local: ev.event_location || "",
    cidade: ev.city || "",
    tipo: ev.event_type,
    convidados: ev.guests || 0,
    drinks: Array.isArray(b.selected_drinks) ? (b.selected_drinks as any).ids : [],
    observacoes: ev.notes || "",
    status: ev.status as any,
    lead_source: ev.lead_source || "",
    referral_name: ev.referral_name || "",
    is_paid_full: ev.is_paid_full || false,
    drinksPorPessoa: b.drinks_per_person,
    markupAdicionalDrinks: b.drinks_markup_percentage,
    equipe: {
      bartender: { qtd: b.bartender_quantity, valorUnitario: b.bartender_unit_value },
      keeper: { qtd: b.keeper_quantity, valorUnitario: b.keeper_unit_value },
      copeira: { qtd: b.copeira_quantity, valorUnitario: b.copeira_unit_value },
    },
    gelo: { pacotesOverride: b.ice_packages_quantity, valorUnitario: b.ice_package_unit_value },
    viagem: { incluir: b.has_travel, valor: b.fuel_value },
    gastosDiversos: Array.isArray(b.miscellaneous_items) ? b.miscellaneous_items : [],
    lucroDesejado: b.profit_value,
    pagamento: { 
        formaPagamento: b.payment_method || "", 
        percentualPago: b.paid_percentage,
        dataPagamento: b.pending_payment_date
    },
    coposVinculados: typeof (b.selected_drinks as any)?.copos === 'object' ? (b.selected_drinks as any).copos : {},
    historicoAlteracoes: [],
    historicoNegociacao: [],
    valorNegociado: b.final_budget_value,
    custoPrevisto: b.drinks_base_cost + b.team_total_value + b.ice_total_value + b.fuel_value + b.miscellaneous_total_value,
    desconto: b.discount_value,
    descontoMotivo: b.discount_description || ""
  });

  const [draft, setDraft] = useState<Evento | null>(null);

  const calc = draft ? calcularOrcamentoEvento(draft, allDrinks) : null;

  const handleSave = async (saveAsNew: boolean = false) => {
    if (!draft || !calc) return;
    setSaving(true);
    try {
      const budgetPayload = {
        drinks_per_person: draft.drinksPorPessoa,
        drinks_markup_percentage: draft.markupAdicionalDrinks,
        drinks_cost_sum: calc.mediaCustoDrinks * draft.drinks.length,
        average_drink_cost: calc.mediaCustoDrinks,
        drinks_base_cost: calc.mediaCustoDrinks * (draft.convidados * draft.drinksPorPessoa),
        drinks_final_value: calc.valorDrinksEvento,
        bartender_quantity: draft.equipe.bartender.qtd,
        bartender_unit_value: draft.equipe.bartender.valorUnitario,
        keeper_quantity: draft.equipe.keeper.qtd,
        keeper_unit_value: draft.equipe.keeper.valorUnitario,
        copeira_quantity: draft.equipe.copeira.qtd,
        copeira_unit_value: draft.equipe.copeira.valorUnitario,
        team_total_value: calc.valorEquipe,
        ice_packages_quantity: calc.pacotesGelo,
        ice_package_unit_value: draft.gelo.valorUnitario,
        ice_total_value: calc.valorGelo,
        has_travel: draft.viagem.incluir,
        fuel_value: calc.valorGasolina,
        miscellaneous_items: draft.gastosDiversos,
        miscellaneous_total_value: calc.valorGastosDiversos,
        profit_value: draft.lucroDesejado,
        final_budget_value: calc.valorTotalOrcamento,
        average_value_per_person: calc.mediaPorPessoa,
        payment_method: draft.pagamento.formaPagamento,
        paid_percentage: draft.pagamento.percentualPago,
        paid_value: calc.valorPago,
        pending_percentage: calc.percPendente,
        pending_value: calc.valorPendente,
        pending_payment_date: draft.pagamento.dataPagamento,
        selected_drinks: { ids: draft.drinks, copos: draft.coposVinculados },
        discount_value: draft.desconto || 0,
        discount_description: draft.descontoMotivo || ""
      };

      // Atualiza evento base com totais financeiros para integração com dashboard/financeiro
      await eventBudgetService.updateEvent(eventoId, {
        client_name: draft.cliente,
        phone: draft.telefone,
        email: draft.email,
        date: draft.data,
        event_time: draft.horario,
        event_location: draft.local,
        city: draft.cidade,
        event_type: draft.tipo,
        guests: draft.convidados,
        drinks: draft.drinks,
        notes: draft.observacoes,
        status: draft.status,
        lead_source: draft.lead_source,
        referral_name: draft.referral_name,
        current_budget_value: calc.valorTotalOrcamento,
        current_profit_value: calc.lucro
      });

      // Salva orçamento
      const newBudget = await eventBudgetService.createBudgetVersion(eventoId, budgetPayload, saveAsNew);
      
      // Adiciona histórico apenas se houver mudança financeira real
      const hasFinancialChange = !currentBudget || currentBudget.final_budget_value !== calc.valorTotalOrcamento;
      
      if (hasFinancialChange) {
          await eventBudgetService.addBudgetHistory({
            event_id: eventoId,
            budget_version_id: newBudget.id,
            action: saveAsNew ? "Nova versão criada" : "Valores financeiros atualizados",
            previous_final_value: currentBudget?.final_budget_value || 0,
            new_final_value: calc.valorTotalOrcamento,
            changed_fields: ["Ajuste de valores"]
          });
      }

      alert(saveAsNew ? "Nova versão do orçamento salva!" : "Orçamento atualizado com sucesso!");
      loadAllData();
    } catch (e: any) {
      alert(`Erro ao salvar orçamento: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (budgetVersions.length <= 1) {
      alert("Não é possível excluir a única versão do orçamento existente.");
      return;
    }

    if (!confirm("Tem certeza que deseja excluir esta versão do orçamento? Esta ação não poderá ser desfeita.")) return;
    
    try {
      const vToDelete = budgetVersions.find(x => x.id === versionId);
      if (!vToDelete) return;

      // Se for a versão atual, precisamos promover outra antes de deletar
      if (vToDelete.is_current) {
        const otherVersions = budgetVersions.filter(x => x.id !== versionId);
        // Pega a versão com maior número (mais recente) entre as que sobraram
        const nextCurrent = otherVersions.sort((a, b) => b.version_number - a.version_number)[0];
        await eventBudgetService.setCurrentVersion(eventoId, nextCurrent.id);
      }

      // Log de Auditoria
      await eventBudgetService.addBudgetHistory({
        event_id: eventoId,
        action: `VERSÃO V${vToDelete.version_number} EXCLUÍDA`,
        previous_final_value: vToDelete.final_budget_value,
        new_final_value: 0
      });
      
      await eventBudgetService.deleteBudgetVersion(versionId);
      loadAllData();
    } catch (e) {
      alert("Erro ao excluir versão.");
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    const newNote = prompt("Editar anotação:");
    if (newNote === null || newNote === "") return;
    try {
      await eventBudgetService.updateNegotiationNote(noteId, newNote);
      loadAllData();
    } catch (e) {
      alert("Erro ao atualizar nota.");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Deseja realmente excluir esta anotação? Esta ação não poderá ser desfeita.")) return;
    try {
      await eventBudgetService.deleteNegotiationNote(noteId);
      loadAllData();
    } catch (e) {
      alert("Erro ao excluir nota.");
    }
  };

  const handleTogglePaidFull = async () => {
    try {
      const newVal = !draft?.is_paid_full;
      const newPerc = newVal ? 100 : 0;
      
      // Atualiza no draft local
      setDraft(p => p ? ({ ...p, is_paid_full: newVal, pagamento: { ...p.pagamento, percentualPago: newPerc } }) : null);
      
      // is_paid_full não existe na tabela events, apenas atualizamos o estado local e pedimos ao usuário para salvar
      alert(newVal ? "Evento marcado como PAGO. Salve o orçamento para persistir." : "Evento marcado como PENDENTE. Salve o orçamento para persistir.");
    } catch (e) {
      alert("Erro ao atualizar status de pagamento.");
    }
  };

  const handleStatusChange = async (newStatus: EventoStatus, note?: string) => {
    try {
      // Sincroniza também os valores financeiros atuais ao mudar status para garantir integração
      const updatePayload: any = { status: newStatus };
      if (calc) {
        updatePayload.current_budget_value = calc.valorTotalOrcamento;
        updatePayload.current_profit_value = calc.lucro;
      }

      await eventBudgetService.updateNegotiationStatus(eventoId, newStatus, note);
      await eventBudgetService.updateEvent(eventoId, updatePayload);
      
      setDraft(p => p ? ({ ...p, status: newStatus }) : null);
      loadAllData();
    } catch (e: any) {
      alert(`Erro ao atualizar status: ${e.message || "Erro desconhecido"}`);
    }
  };

  const toggleDrink = (id: string) => {
    setDraft(p => {
      if (!p) return null;
      const isSelected = p.drinks.includes(id);
      const newDrinks = isSelected ? p.drinks.filter(x => x !== id) : [...p.drinks, id];
      const newCopos = { ...p.coposVinculados };
      if (isSelected) delete newCopos[id];
      return { ...p, drinks: newDrinks, coposVinculados: newCopos };
    });
  };


  const handleGenerateContract = async () => {
    if (!realClientData) { alert("Os dados do cliente são necessários."); return; }
    if (!selectedTemplate || !selectedSigner) { alert("Selecione um template e um assinante."); return; }
    
    try {
      await eventContractsService.createContractForEvent(draft.id, selectedTemplate, selectedSigner);
      handleStatusChange("em_assinatura", "Contrato gerado no sistema.");
      alert("Contrato gerado com sucesso!");
      loadContractModule();
    } catch (e: any) {
      alert(`Erro ao gerar contrato: ${e.message || "Erro desconhecido"}`);
    }
  };

  const handleRequestClientData = async () => {
    try {
      const data = await clientContractFormService.createPublicFormToken(draft.id);
      const link = `${window.location.origin}/contrato/dados/${data.public_token}`;
      navigator.clipboard.writeText(link);
      handleStatusChange("dados_solicitados", "Link de coleta de dados gerado.");
      alert("Link seguro copiado para a área de transferência!");
      loadContractModule();
    } catch (e) {
      alert("Erro ao gerar link de solicitação.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este evento e todos os dados relacionados?")) return;
    try {
      setSaving(true);
      await eventBudgetService.deleteEvent(eventoId);
      navigate({ to: "/eventos" });
    } catch (e) {
      alert("Erro ao excluir evento.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Carregando dados do evento...</p>
      </div>
    );
  }

  if (!draft || !calc) {
    return (
      <div className="p-8 text-center">
        <h2 className="font-display text-2xl">Evento não encontrado</h2>
        <Link to="/eventos" className="text-primary text-sm mt-3 inline-block">Voltar para lista</Link>
      </div>
    );
  }

  return (
    <>

      <PageHeader
        breadcrumb={
          <Link to="/eventos" className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
        }
        title={draft.nome}
        subtitle={`${draft.tipo} · Versão ${currentBudget?.version_number || 1}`}
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="h-10 w-10 flex items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors" title="Excluir Evento">
              <Trash2 className="h-4 w-4" />
            </button>
            <GhostButton onClick={() => handleSave(true)} disabled={saving}>
              <Copy className="h-4 w-4" /> Salvar Nova Versão
            </GhostButton>
            <PrimaryButton onClick={() => handleSave(false)} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Atualizar Atual"}
            </PrimaryButton>
          </div>
        }
      />

      <div className="px-8 py-7 space-y-7 max-w-[1400px] mx-auto">
        
        {/* ALERTAS DE CONFLITO */}
        {sameDateEvents.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="h-12 w-12 bg-destructive/20 rounded-full flex items-center justify-center text-destructive shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-destructive">Atenção: Conflito de Agenda</h4>
              <p className="text-sm text-destructive/80">
                Já existem {sameDateEvents.length} evento(s) cadastrado(s) para o dia {draft.data ? (() => { try { return format(parseISO(draft.data), "dd/MM/yyyy", { locale: ptBR }); } catch { return draft.data; } })() : "esta data"}:
                <span className="font-semibold ml-1">
                  {sameDateEvents.map(e => e.client_name).join(", ")}
                </span>
              </p>
            </div>
            <Link to="/eventos" className="text-xs font-bold uppercase tracking-wider bg-destructive text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Ver Calendário
            </Link>
          </div>
        )}

        {/* CABEÇALHO DO EVENTO — INFORMAÇÕES DO CLIENTE */}
        <div className="card-premium p-6 relative overflow-hidden bg-surface">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-6 border-b border-border/50">
            <div className="flex gap-4 items-center">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isEditingHeader ? "bg-success text-white shadow-success/20" : "bg-primary text-white shadow-primary/20"}`}>
                {isEditingHeader ? <Check className="h-7 w-7" /> : <Users className="h-7 w-7" />}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-display font-bold tracking-tight">
                    {isEditingHeader ? "Editando Cabeçalho" : draft.cliente || draft.nome}
                  </h2>
                  <button 
                    onClick={() => {
                      if (isEditingHeader) handleSave(false);
                      setIsEditingHeader(!isEditingHeader);
                    }}
                    className={`h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${isEditingHeader ? "bg-success text-white hover:bg-success/90" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  >
                    {isEditingHeader ? (
                      <><Check className="h-3.5 w-3.5" /> SALVAR DADOS</>
                    ) : (
                      <><Pencil className="h-3.5 w-3.5" /> EDITAR CABEÇALHO</>
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1 font-medium">
                  {draft.tipo} · {draft.cidade || "Local não definido"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-8 self-end md:self-auto">
              <div className="text-right">
                <div className="label-eyebrow mb-1">Valor do Orçamento</div>
                <div className="font-display text-3xl font-black text-primary">{fmtBRL(calc.valorTotalOrcamento)}</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{fmtBRL(calc.mediaPorPessoa)} / PESSOA</div>
              </div>
              <div className="h-12 w-px bg-border/60 hidden lg:block" />
              <div className="text-right">
                <div className="label-eyebrow mb-2">Status da Negociação</div>
                <select 
                  value={draft.status} 
                  onChange={(e) => handleStatusChange(e.target.value as EventoStatus)}
                  className="bg-surface border-2 border-primary/20 text-primary font-bold text-xs px-4 py-2 rounded-xl outline-none cursor-pointer hover:border-primary/40 transition-all shadow-sm"
                >
                  <option value="novo_orcamento">Novo orçamento</option>
                  <option value="orcamento_enviado">Orçamento enviado</option>
                  <option value="aguardando_retorno">Aguardando retorno</option>
                  <option value="dados_solicitados">Dados solicitados p/ Contrato</option>
                  <option value="em_assinatura">Em assinatura de contrato</option>
                  <option value="proposta_aceita">Proposta aceita</option>
                  <option value="confirmado">Contrato Assinado / Confirmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-y-8 gap-x-10">
            {/* Coluna 1: Principal */}
            <div className="space-y-5">
              <HeaderField label="Nome do Solicitante" value={draft.cliente} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, cliente: v, nome: v}) : null)} icon={<Users className="h-3 w-3 text-primary/60" />} />
              <HeaderField label="Tipo do Evento" value={draft.tipo} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, tipo: v}) : null)} icon={<Save className="h-3 w-3 text-primary/60" />} />
            </div>

            {/* Coluna 2: Contato */}
            <div className="space-y-5">
              <HeaderField label="Telefone / WhatsApp" value={draft.telefone} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, telefone: v}) : null)} icon={<MessageCircle className="h-3 w-3 text-primary/60" />} />
              <HeaderField label="E-mail de Contato" value={draft.email} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, email: v}) : null)} icon={<FileSignature className="h-3 w-3 text-primary/60" />} />
            </div>

            {/* Coluna 3: Logística */}
            <div className="space-y-5">
              <HeaderField label="Data do Evento" type="date" value={draft.data} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, data: v}) : null)} icon={<Calendar className="h-3 w-3 text-primary/60" />} />
              <HeaderField label="Local do Evento" value={draft.local} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, local: v}) : null)} icon={<MapPin className="h-3 w-3 text-primary/60" />} />
            </div>

            {/* Coluna 4: Detalhes */}
            <div className="space-y-5">
              <HeaderField label="Cidade" value={draft.cidade} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, cidade: v}) : null)} icon={<MapPin className="h-3 w-3 text-primary/60" />} />
              <HeaderField label="Convidados" type="number" value={draft.convidados.toString()} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, convidados: Number(v)}) : null)} icon={<Users className="h-3 w-3 text-primary/60" />} />
            </div>

            {/* Coluna 5: Origem */}
            <div className="space-y-5 bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <div className="space-y-1">
                <div className="label-eyebrow flex items-center gap-1"><Megaphone className="h-3 w-3 text-primary" /> Canal de Origem</div>
                {isEditingHeader ? (
                  <select 
                    value={draft.lead_source || ""} 
                    onChange={e => setDraft(p => p ? ({...p, lead_source: e.target.value}) : null)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    <option value="">A definir</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Google">Google</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Site">Site</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Parceiro">Parceiro</option>
                    <option value="Outros">Outros</option>
                  </select>
                ) : (
                  <div className="text-sm font-black text-primary uppercase tracking-tight">{draft.lead_source || "NÃO DEFINIDO"}</div>
                )}
              </div>
              
              {draft.lead_source === "Indicação" && (
                <div className="animate-in zoom-in-95 duration-300">
                  <HeaderField label="Nome da Indicação" value={draft.referral_name || ""} isEditing={isEditingHeader} onChange={v => setDraft(p => p ? ({...p, referral_name: v}) : null)} icon={<UserPlus className="h-3 w-3 text-primary/60" />} />
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border/50">
             <div className="label-eyebrow flex items-center gap-2 mb-3 text-muted-foreground"><History className="h-3.5 w-3.5" /> Observações Gerais do Evento</div>
             {isEditingHeader ? (
               <textarea 
                 value={draft.observacoes || ""} 
                 onChange={e => setDraft(p => p ? ({...p, observacoes: e.target.value}) : null)}
                 className="w-full h-24 p-4 rounded-xl bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all shadow-inner"
                 placeholder="Digite aqui observações importantes, detalhes do cliente ou particularidades da entrega..."
               />
             ) : (
               <div className="p-4 rounded-xl bg-surface border border-border/40 min-h-[60px]">
                 <p className="text-sm text-muted-foreground leading-relaxed italic">
                   {draft.observacoes || "Nenhuma observação cadastrada para este evento."}
                 </p>
               </div>
             )}
          </div>
        </div>


        {/* TABS */}
        <div className="flex flex-wrap gap-2 border-b border-border">
          {[
            { id: "Orçamento", icon: <Save className="h-4 w-4" /> },
            { id: "Contatos & Negociação", icon: <MessageCircle className="h-4 w-4" /> },
            { id: "Contrato", icon: <FileSignature className="h-4 w-4" /> },
            { id: "Histórico & Versões", icon: <History className="h-4 w-4" /> }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === t.id ? "border-primary text-foreground bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-surface"
              }`}
            >
              {t.icon}
              {t.id}
            </button>
          ))}
        </div>

        {/* TAB ORÇAMENTO */}
        {activeTab === "Orçamento" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 animate-in fade-in duration-500">
            {/* Esquerda: Configurações */}
            <div className="xl:col-span-8 space-y-6">
              
              <SectionCard title="1. Drinks & Copos">
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-eyebrow block mb-2">Drinks por pessoa</label>
                      <input type="number" value={draft.drinksPorPessoa || ""} onChange={e => setDraft(p => p ? ({...p, drinksPorPessoa: e.target.value === "" ? 0 : Number(e.target.value)}) : null)} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" />
                    </div>
                    <div>
                      <label className="label-eyebrow block mb-2">Markup adicional (%)</label>
                      <input type="number" value={draft.markupAdicionalDrinks || ""} onChange={e => setDraft(p => p ? ({...p, markupAdicionalDrinks: e.target.value === "" ? 0 : Number(e.target.value)}) : null)} className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        placeholder="Buscar drink pelo nome..." 
                        value={buscaDrink}
                        onChange={e => setBuscaDrink(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[450px] overflow-y-auto p-2 scrollbar-thin">
                      {allDrinks
                        .filter(d => d.nome.toLowerCase().includes(buscaDrink.toLowerCase()))
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map(d => (
                        <div key={d.id} onClick={() => toggleDrink(d.id)} className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer group flex flex-col ${draft.drinks.includes(d.id) ? "border-primary bg-primary/5 shadow-md scale-[0.98]" : "border-border bg-surface hover:border-primary/40 hover:scale-[1.02]"}`}>
                          <div className="h-24 overflow-hidden relative">
                             <img src={d.imagem} alt={d.nome} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                             {draft.drinks.includes(d.id) && (
                               <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center text-white shadow-lg">
                                  <Check className="h-3 w-3 stroke-[4px]" />
                               </div>
                             )}
                          </div>
                          <div className="p-3 space-y-1">
                             <div className={`font-bold text-[11px] uppercase tracking-tighter truncate ${draft.drinks.includes(d.id) ? "text-primary" : "text-foreground"}`}>{d.nome}</div>
                             <div className="flex justify-between items-center text-[10px]">
                                <span className="text-muted-foreground">Custo: <span className="font-bold text-foreground">{fmtBRL(d.custoUnitario)}</span></span>
                             </div>
                             <div className="text-[9px] font-bold text-primary/80">Sugerido: {fmtBRL(d.modalityConfig.steakhouse.price || 0)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {draft.drinks.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <label className="label-eyebrow block mb-3 text-primary">Definição de Copos (Para contrato)</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {draft.drinks.map(dId => {
                          const drink = allDrinks.find(x => x.id === dId);
                          if (!drink) return null;
                          return (
                            <div key={dId} className="flex flex-col gap-1.5 bg-surface p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{drink.nome}</span>
                              <select 
                                value={draft.coposVinculados[dId] || ""}
                                onChange={(e) => setDraft(p => p ? ({...p, coposVinculados: { ...p.coposVinculados, [dId]: e.target.value }}) : null)}
                                className="h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                              >
                                <option value="">Copo Padrão (R$ 15)</option>
                                {glasswares.filter(g => g.isActive).map(g => (
                                  <option key={g.id} value={g.id}>{g.name} (R$ {g.replacementValue})</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="p-5 rounded-xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 shadow-inner gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Análise de Insumos / Custo</div>
                      <div className="text-sm">Média Unitária Insumos: <span className="font-bold">{fmtBRL(calc.mediaCustoDrinks)}</span></div>
                      <div className="text-sm">Soma Insumos (1 de cada): <span className="font-bold">{fmtBRL(calc.custoBaseDrinks)}</span></div>
                      {draft.drinks.length > 0 && (
                        <div className="mt-4 text-xs text-muted-foreground w-full">
                           <div className="font-bold mb-3 uppercase tracking-widest text-primary text-[10px]">Detalhamento por Insumo:</div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             {draft.drinks.map(dId => {
                               const drink = allDrinks.find(d => d.id === dId);
                               if (!drink) return null;
                               return (
                                 <div key={dId} className="bg-surface border border-border p-3 rounded-lg shadow-sm">
                                   <div className="font-bold text-foreground mb-1.5">{drink.nome}</div>
                                   <ul className="space-y-0.5 mb-2">
                                     {drink.insumos?.map((i, idx) => (
                                       <li key={idx} className="flex justify-between text-muted-foreground">
                                         <span>{i.nome}</span>
                                         <span>{fmtBRL(i.custo)}</span>
                                       </li>
                                     ))}
                                     {(!drink.insumos || drink.insumos.length === 0) && (
                                       <li className="italic text-muted-foreground/50">Insumos não detalhados</li>
                                     )}
                                   </ul>
                                   <div className="flex justify-between font-bold text-foreground border-t border-border/50 pt-1.5">
                                     <span>Total</span>
                                     <span>{fmtBRL(drink.custoUnitario)}</span>
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="label-eyebrow text-primary">Valor Sugerido Drinks</div>
                      <div className="font-display text-2xl font-bold text-primary">{fmtBRL(calc.valorDrinksEvento)}</div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="2. Equipe">
                  <div className="space-y-4">
                    {Object.entries(draft.equipe).map(([key, prof]) => (
                      <div key={key} className="flex gap-3 items-end p-3 rounded-lg bg-surface border border-border/50">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">{key}</label>
                          <div className="flex items-center gap-2">
                             <input type="number" value={prof.qtd || ""} onChange={e => setDraft(p => p ? ({...p, equipe: { ...p.equipe, [key]: { ...prof, qtd: e.target.value === "" ? 0 : Number(e.target.value) }}}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold" />
                             <span className="text-xs text-muted-foreground">und</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Valor (R$)</label>
                          <input type="number" value={prof.valorUnitario || ""} onChange={e => setDraft(p => p ? ({...p, equipe: { ...p.equipe, [key]: { ...prof, valorUnitario: e.target.value === "" ? 0 : Number(e.target.value) }}}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm" />
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 text-right font-display text-lg text-primary border-t border-border/50">
                      Total Equipe: <span className="font-bold">{fmtBRL(calc.valorEquipe)}</span>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="3. Insumos & Logística">
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl border border-border bg-surface">
                       <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-3">Gelo (Pacotes 5kg)</label>
                       <div className="flex gap-3 items-center">
                          <div className="flex-1">
                             <input type="number" placeholder={`Sugestão: ${Math.ceil((draft.convidados/100)*35)}`} value={draft.gelo.pacotesOverride || ""} onChange={e => setDraft(p => p ? ({...p, gelo: { ...p.gelo, pacotesOverride: e.target.value ? Number(e.target.value) : undefined }}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold" />
                          </div>
                          <span className="text-muted-foreground text-sm">x</span>
                          <div className="flex-1">
                             <input type="number" value={draft.gelo.valorUnitario || ""} onChange={e => setDraft(p => p ? ({...p, gelo: { ...p.gelo, valorUnitario: e.target.value === "" ? 0 : Number(e.target.value) }}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm" />
                          </div>
                       </div>
                       <div className="mt-2 text-[10px] text-muted-foreground italic">* Estimativa de 35 pacotes a cada 100 convidados</div>
                    </div>
                    
                    <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
                      <label className="flex items-center gap-3 text-sm font-bold cursor-pointer group">
                        <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${draft.viagem.incluir ? "bg-primary border-primary text-white" : "border-border group-hover:border-primary"}`}>
                           {draft.viagem.incluir && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={draft.viagem.incluir} onChange={e => setDraft(p => p ? ({...p, viagem: { ...p.viagem, incluir: e.target.checked }}) : null)} />
                        Taxa de Deslocamento / Gasolina
                      </label>
                      {draft.viagem.incluir && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <input type="number" value={draft.viagem.valor || ""} onChange={e => setDraft(p => p ? ({...p, viagem: { ...p.viagem, valor: e.target.value === "" ? 0 : Number(e.target.value) }}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm" placeholder="Valor total (R$)" />
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-right font-display text-lg text-primary border-t border-border/50">
                       Subtotal: <span className="font-bold">{fmtBRL(calc.valorGelo + calc.valorGasolina)}</span>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="4. Gastos Diversos" subtitle="Itens extras, flores, canudos, etc">
                  <div className="space-y-3">
                    {draft.gastosDiversos.length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground text-xs uppercase tracking-widest">Nenhum item extra</div>
                    )}
                    {draft.gastosDiversos.map((g, i) => (
                      <div key={g.id} className="flex gap-2 group animate-in zoom-in-95 duration-200">
                        <input type="text" value={g.descricao} onChange={e => {
                          const arr = [...draft.gastosDiversos];
                          arr[i].descricao = e.target.value;
                          setDraft(p => p ? ({...p, gastosDiversos: arr}) : null);
                        }} className="flex-1 h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary outline-none transition-colors" placeholder="Descrição do item" />
                        <input type="number" value={g.valor || ""} onChange={e => {
                          const arr = [...draft.gastosDiversos];
                          arr[i].valor = e.target.value === "" ? 0 : Number(e.target.value);
                          setDraft(p => p ? ({...p, gastosDiversos: arr}) : null);
                        }} className="w-24 h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold text-primary" />
                        <button onClick={() => {
                          setDraft(p => p ? ({...p, gastosDiversos: p.gastosDiversos.filter(x => x.id !== g.id)}) : null);
                        }} className="h-10 w-10 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-40 group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <GhostButton onClick={() => setDraft(p => p ? ({...p, gastosDiversos: [...p.gastosDiversos, { id: `g${Date.now()}`, descricao: "", valor: 0 }]}) : null)} className="w-full text-xs font-bold py-3 mt-2 border-dashed border-2">
                      <Plus className="h-3 w-3" /> ADICIONAR ITEM EXTRA
                    </GhostButton>
                  </div>
                </SectionCard>

                <SectionCard title="5. Descontos & Gestão" subtitle="Ajustes finos no valor final">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-border bg-surface">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Valor do Desconto (R$)</label>
                           <input type="number" value={draft.desconto || ""} onChange={e => setDraft(p => p ? ({...p, desconto: e.target.value === "" ? 0 : Number(e.target.value)}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold text-destructive" placeholder="0,00" />
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-surface">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Motivo do Desconto</label>
                           <input type="text" value={draft.descontoMotivo || ""} onChange={e => setDraft(p => p ? ({...p, descontoMotivo: e.target.value}) : null)} className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm" placeholder="Ex: Parceria / Cortesia" />
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-primary/10 border-2 border-primary/20 shadow-lg shadow-primary/5">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-3 text-center">Lucro Líquido Desejado</label>
                      <div className="flex items-center gap-3">
                         <span className="text-2xl font-display text-primary">R$</span>
                         <input type="number" value={draft.lucroDesejado || ""} onChange={e => setDraft(p => p ? ({...p, lucroDesejado: e.target.value === "" ? 0 : Number(e.target.value)}) : null)} className="w-full h-14 text-3xl font-display font-bold bg-transparent border-0 focus:ring-0 text-primary placeholder:text-primary/20" placeholder="0,00" />
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>

            </div>

            {/* Direita: Resumo */}
            <div className="xl:col-span-4">
              <div className="sticky top-6 space-y-6">
                <SectionCard title="Detalhamento da Proposta" className="border-primary/30 shadow-2xl shadow-primary/10 bg-surface/80 backdrop-blur-sm">
                  <div className="space-y-6 text-xs">
                    
                    {/* DRINKS section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> DRINKS SELECIONADOS:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight text-xs">
                        {draft.drinks.length === 0 && <div className="italic">Nenhum drink selecionado</div>}
                        {draft.drinks.filter(dId => allDrinks.some(d => d.id === dId))
                          .sort((a, b) => {
                            const drinkA = allDrinks.find(d => d.id === a);
                            const drinkB = allDrinks.find(d => d.id === b);
                            return (drinkA?.nome || "").localeCompare(drinkB?.nome || "");
                          })
                          .map(dId => {
                          const drink = allDrinks.find(d => d.id === dId);
                          return <div key={dId} className="flex justify-between"><span>- {drink?.nome}</span></div>;
                        })}
                      </div>
                      <div className="pt-2 flex justify-between font-bold border-t border-border/40">
                         <span>VALOR TOTAL SERVIÇO DE DRINKS</span>
                         <span className="text-foreground">{fmtBRL(calc.valorDrinksEvento)}</span>
                      </div>
                    </div>

                    {/* EQUIPE section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> EQUIPE OPERACIONAL:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight text-xs">
                        {Object.entries(draft.equipe).filter(([_, p]) => p.qtd > 0).map(([key, p]) => (
                          <div key={key}>- {p.qtd} {key.toUpperCase()}{p.qtd > 1 && !key.endsWith('s') ? 'S' : ''}</div>
                        ))}
                      </div>
                      <div className="pt-2 flex justify-between font-bold border-t border-border/40">
                         <span>VALOR TOTAL EQUIPE</span>
                         <span className="text-foreground">{fmtBRL(calc.valorEquipe)}</span>
                      </div>
                    </div>

                    {/* GELO section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> GELO & LOGÍSTICA:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight">
                        <div>- {calc.pacotesGelo} PACOTES DE GELO ({fmtBRL(calc.valorGelo)})</div>
                        {draft.viagem.incluir && <div>- TAXA DE DESLOCAMENTO ({fmtBRL(calc.valorGasolina)})</div>}
                      </div>
                    </div>

                    {/* GASTOS section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> GASTOS DIVERSOS:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight text-xs">
                        {draft.gastosDiversos.length === 0 && <div className="italic">Nenhum gasto extra</div>}
                        {draft.gastosDiversos.map(g => (
                          <div key={g.id} className="flex justify-between">
                            <span>- INSUMOS: ({g.descricao.toUpperCase() || "ITEM EXTRA"})</span>
                            <span>{fmtBRL(g.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* TOTAIS section */}
                    <div className="pt-4 border-t-2 border-primary/20 space-y-3">
                       <div className="flex justify-between text-muted-foreground font-medium">
                          <span>SUBTOTAL GERAL</span>
                          <span>{fmtBRL(calc.custoTotalOrcamento)}</span>
                       </div>
                       <div className="flex justify-between text-primary font-bold">
                          <span>LUCRO LÍQUIDO ADICIONADO</span>
                          <span>{fmtBRL(draft.lucroDesejado)}</span>
                       </div>
                       {calc.valorDesconto > 0 && (
                         <div className="flex justify-between text-destructive font-bold">
                            <span>DESCONTO APLICADO ({draft.descontoMotivo || "GERAL"})</span>
                            <span>- {fmtBRL(calc.valorDesconto)}</span>
                         </div>
                       )}
                       
                       <div className="bg-primary p-5 rounded-xl text-primary-foreground shadow-lg shadow-primary/20">
                          <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">Valor Final da Proposta</div>
                          <div className="text-3xl font-display font-bold">{fmtBRL(calc.valorTotalOrcamento)}</div>
                          <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-[10px] font-bold opacity-90">
                             <span>{draft.convidados} CONVIDADOS</span>
                             <span className="bg-white/20 px-2 py-0.5 rounded">{fmtBRL(calc.mediaPorPessoa)} / PAX</span>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <GhostButton onClick={() => handleSave(true)} className="h-10 text-[10px] font-bold" disabled={saving}>GERAR NOVA VERSÃO</GhostButton>
                      <PrimaryButton className="h-10 text-[10px] font-bold" onClick={() => handleSave(false)} disabled={saving}>
                         {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                         {saving ? "SALVANDO..." : "ATUALIZAR ATUAL"}
                      </PrimaryButton>
                    </div>
                  </div>
                </SectionCard>

                {/* VERSÕES RÁPIDAS */}
                <SectionCard title="Versões Recentes" className="bg-surface/50 border-dashed">
                   <div className="space-y-3">
                      {budgetVersions.slice(0, 3).map(v => (
                         <div key={v.id} className={`flex items-center justify-between p-3 rounded-xl border ${v.is_current ? "bg-primary/5 border-primary/30" : "bg-background/50 border-border"}`}>
                            <div className="flex items-center gap-3">
                               <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${v.is_current ? "bg-primary text-white" : "bg-surface text-muted-foreground"}`}>
                                  <Clock className="h-4 w-4" />
                               </div>
                               <div>
                                  <div className="text-xs font-bold">V{v.version_number} - {fmtBRL(v.final_budget_value)}</div>
                                  <div className="text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               {!v.is_current && (
                                  <button onClick={() => {
                                    const selected = budgetVersions.find(x => x.id === v.id);
                                    if(selected) setDraft(mapBudgetToDraft(evento!, selected));
                                  }} className="text-[10px] font-bold text-primary hover:underline">CARREGAR</button>
                               )}
                               {budgetVersions.length > 1 && (
                                  <button 
                                    onClick={() => handleDeleteVersion(v.id)}
                                    className="p-1.5 text-muted-foreground hover:text-white hover:bg-destructive rounded-md transition-all"
                                    title="Excluir Versão"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                               )}
                             </div>
                         </div>
                      ))}
                      <GhostButton onClick={() => setActiveTab("Histórico & Versões")} className="w-full text-[10px] font-bold mt-2">VER TODAS AS VERSÕES</GhostButton>
                   </div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}


        {/* TAB CONTRATO */}
        {activeTab === "Contrato" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 animate-in fade-in duration-500">
            <div className="lg:col-span-8 space-y-6">
              
              {!realClientData ? (
                <SectionCard title="Coleta de Dados Jurídicos" subtitle="Solicite as informações necessárias para emissão do contrato">
                  <div className="flex flex-col items-center justify-center p-12 bg-surface border-2 border-dashed border-border rounded-2xl text-center space-y-6">
                    <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
                      <LinkIcon className="h-10 w-10" />
                    </div>
                    <div className="max-w-md">
                      <h3 className="font-display font-bold text-xl mb-2">Link Seguro para o Cliente</h3>
                      <p className="text-sm text-muted-foreground">O cliente receberá um formulário web premium para preencher CPF/CNPJ, endereço e dados do representante legal. Isso evita erros de digitação e agiliza o processo.</p>
                    </div>
                    <PrimaryButton 
                      onClick={handleRequestClientData}
                      className="h-12 px-8 text-sm font-bold shadow-lg shadow-primary/20"
                    >
                      GERAR E COPIAR LINK DE COLETA
                    </PrimaryButton>
                  </div>
                </SectionCard>
              ) : (
                <SectionCard title="Dados do Contratante" subtitle={`Validado em ${realClientData.submitted_at || realClientData.created_at ? format(parseISO(realClientData.submitted_at || realClientData.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "---"}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <DataField label="Razão Social / Nome" value={realClientData.client_name} />
                    <DataField label="Documento (CPF/CNPJ)" value={realClientData.cpf_cnpj} />
                    <DataField label="E-mail de Contato" value={realClientData.email} />
                    <DataField label="Telefone / WhatsApp" value={realClientData.phone} />
                    <div className="md:col-span-2">
                      <DataField label="Endereço de Faturamento" value={realClientData.address} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {realClientData && !realContract && (
                <SectionCard title="Configuração da Emissão" className="animate-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Modelo de Contrato</label>
                           <select 
                              value={selectedTemplate}
                              onChange={e => setSelectedTemplate(e.target.value)}
                              className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                           >
                              <option value="">-- Selecione o template --</option>
                              {realTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sócio Assinante (Representante Goat)</label>
                           <select 
                              value={selectedSigner}
                              onChange={e => setSelectedSigner(e.target.value)}
                              className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                           >
                              <option value="">-- Selecione o responsável --</option>
                              {realSigners.filter(s => s.is_active).map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                              ))}
                           </select>
                        </div>
                    </div>
                    
                    <div className="bg-surface p-4 rounded-xl border border-border flex gap-4 items-center">
                       <div className="h-10 w-10 bg-success/10 rounded-full flex items-center justify-center text-success shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                       </div>
                       <div className="text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">DICA:</span> O contrato incluirá automaticamente a lista de drinks (<b>{draft.drinks.length} itens</b>), os valores negociados (<b>{fmtBRL(calc.valorTotalOrcamento)}</b>) e a tabela de reposição de copos.
                       </div>
                    </div>

                    <PrimaryButton onClick={handleGenerateContract} className="w-full h-14 text-base font-bold shadow-xl shadow-primary/20">
                       <FileSignature className="h-5 w-5" /> GERAR DOCUMENTO E ENVIAR P/ REVISÃO
                    </PrimaryButton>
                  </div>
                </SectionCard>
              )}

              {realContract && (
                <SectionCard title="Contrato Gerado" subtitle={`Status: ${realContract.status.toUpperCase()}`}>
                  <div className="p-6 rounded-2xl bg-surface border-2 border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                       <div className="h-16 w-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30">
                          <FileSignature className="h-8 w-8" />
                       </div>
                       <div>
                          <div className="font-display font-bold text-lg">Contrato Prestação de Serviços - v{realContract.version}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                             <Clock className="h-3 w-3" /> Gerado em {new Date(realContract.generated_at || realContract.created_at).toLocaleString()}
                          </div>
                       </div>
                    </div>
                    <div className="flex gap-3 shrink-0">
                       <GhostButton className="h-11 px-6 font-bold border-2">VISUALIZAR</GhostButton>
                       <PrimaryButton className="h-11 px-6 font-bold">BAIXAR PDF</PrimaryButton>
                    </div>
                  </div>

                  <div className="mt-10 pt-10 border-t border-border space-y-6">
                     <div className="flex items-center justify-between">
                        <h4 className="font-display font-bold text-xl">Assinatura Eletrônica</h4>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest ${realContract.status === 'signed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                           {realContract.status === 'signed' ? 'CONCLUÍDO' : 'PENDENTE'}
                        </div>
                     </div>
                     
                     {realContract.status === "draft" && (
                       <div className="bg-primary/5 border border-primary/10 p-8 rounded-2xl text-center space-y-4">
                         <p className="text-sm text-muted-foreground max-w-md mx-auto">O contrato está pronto. Ao enviar, os signatários receberão um e-mail para assinar digitalmente através do <b>ZapSign / Docusign</b>.</p>
                         <PrimaryButton onClick={async () => {
                           await eventContractsService.updateContractStatus(realContract.id, "sent");
                           handleStatusChange("em_assinatura", "Contrato disparado para assinatura.");
                           loadAllData();
                         }} className="h-12 px-10 font-bold">DISPARAR ASSINATURAS</PrimaryButton>
                       </div>
                     )}

                     {(realContract.status === "sent" || realContract.status === "partially_signed") && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-center gap-4">
                             <div className="h-10 w-10 bg-warning/20 rounded-full flex items-center justify-center text-warning animate-pulse">
                                <Clock className="h-5 w-5" />
                             </div>
                             <div>
                                <div className="text-xs font-bold text-warning uppercase">AGUARDANDO CLIENTE</div>
                                <div className="text-[10px] text-muted-foreground italic">E-mail enviado há 2 horas</div>
                             </div>
                          </div>
                          <div className="p-4 rounded-xl border border-success/30 bg-success/5 flex items-center gap-4">
                             <div className="h-10 w-10 bg-success/20 rounded-full flex items-center justify-center text-success">
                                <CheckCircle2 className="h-5 w-5" />
                             </div>
                             <div>
                                <div className="text-xs font-bold text-success uppercase">ASSINADO PELA GOAT</div>
                                <div className="text-[10px] text-muted-foreground italic">Assinado por Sócio Diretor</div>
                             </div>
                          </div>
                       </div>
                     )}

                     {realContract.status === "signed" && (
                       <div className="bg-success/10 border-2 border-success/20 p-8 rounded-2xl flex flex-col items-center text-center space-y-4">
                          <div className="h-20 w-20 bg-success text-white rounded-full flex items-center justify-center shadow-xl shadow-success/30">
                             <CheckCircle2 className="h-10 w-10" />
                          </div>
                          <div>
                             <h4 className="font-display font-bold text-2xl text-success">Contrato Formalizado</h4>
                             <p className="text-sm text-muted-foreground mt-1">Todas as partes assinaram o documento. O evento está juridicamente confirmado.</p>
                          </div>
                          <GhostButton className="font-bold text-success border-success/30 hover:bg-success/10">VER CERTIFICADO DE ASSINATURAS</GhostButton>
                       </div>
                     )}
                  </div>
                </SectionCard>
              )}

            </div>

            <div className="lg:col-span-4">
              <SectionCard title="Workflow Jurídico" className="sticky top-6">
                <div className="space-y-6 py-4">
                  <StatusStep done={!!realClientData} title="Coleta de dados concluída" />
                  <StatusStep done={!!realContract} title="Documento base gerado" />
                  <StatusStep done={realContract?.status === "sent" || realContract?.status === "partially_signed" || realContract?.status === "signed"} title="Disparo de e-mails realizado" />
                  <StatusStep done={realContract?.status === "signed"} title="Assinatura das partes colhida" />
                </div>
              </SectionCard>
            </div>
          </div>
        )}


        {/* TAB CONTATOS & NEGOCIAÇÃO */}
        {activeTab === "Contatos & Negociação" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 animate-in fade-in duration-500">
            <div className="xl:col-span-5 space-y-6">
               <SectionCard title="Controle Financeiro" subtitle="Regras de pagamento e prazos">
                 <div className="space-y-5">
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Condição de Pagamento</label>
                     <input type="text" value={draft.pagamento.formaPagamento} onChange={e => setDraft(p => p ? ({...p, pagamento: { ...p.pagamento, formaPagamento: e.target.value }}) : null)} className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium" placeholder="Ex: 50% Sinal / 50% na semana do evento" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sinal Recebido (%)</label>
                        <div className="relative">
                           <input type="number" max={100} min={0} value={draft.pagamento.percentualPago} onChange={e => setDraft(p => p ? ({...p, pagamento: { ...p.pagamento, percentualPago: Number(e.target.value) }}) : null)} className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-bold text-primary" />
                           <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-primary opacity-50">%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data Limite Quitação</label>
                        <input type="date" value={draft.pagamento.dataPagamento} onChange={e => setDraft(p => p ? ({...p, pagamento: { ...p.pagamento, dataPagamento: e.target.value }}) : null)} className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium" />
                      </div>
                   </div>

                   <div className="p-6 rounded-2xl bg-surface border-2 border-primary/20 space-y-4 shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="label-eyebrow text-primary">Status de Quitação</div>
                          <h4 className="font-display font-bold text-lg">Contrato Pago?</h4>
                        </div>
                        <button 
                          onClick={handleTogglePaidFull}
                          className={`h-10 px-6 rounded-xl font-bold text-xs transition-all ${draft.is_paid_full ? "bg-success text-white shadow-lg shadow-success/20" : "bg-primary/10 text-primary border border-primary/20"}`}
                        >
                          {draft.is_paid_full ? "SIM, 100% PAGO" : "MARCAR COMO PAGO"}
                        </button>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-border">
                        <div className="flex justify-between items-center text-xs font-medium">
                           <span className="text-muted-foreground uppercase tracking-widest">Total do Contrato</span>
                           <span>{fmtBRL(calc.valorTotalOrcamento)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                           <span className="text-primary uppercase tracking-widest text-[10px]">Já Recebido (Sinal)</span>
                           <span className="text-primary">{fmtBRL(calc.valorPago)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold">
                           <span className="text-muted-foreground uppercase tracking-widest text-[10px]">Saldo Pendente ({calc.percPendente}%)</span>
                           <span className="text-destructive">{fmtBRL(calc.valorPendente)}</span>
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-primary/5 text-[10px] text-muted-foreground italic flex gap-2 items-center mt-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        Status automático: <span className="font-bold text-primary ml-1">{calc.statusPagamento.toUpperCase()}</span>
                      </div>
                   </div>
                   
                   <PrimaryButton onClick={() => handleSave(false)} className="w-full h-12 font-bold">ATUALIZAR DADOS FINANCEIROS</PrimaryButton>
                 </div>
               </SectionCard>
            </div>

            <div className="xl:col-span-7">
               <SectionCard title="Timeline de Negociação" subtitle="Anotações e histórico de contatos">
                 <div className="space-y-6">
                   <div className="flex gap-3 items-end">
                     <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nova Nota / Registro de Contato</label>
                        <textarea id="noteInput" className="w-full min-h-[80px] p-4 rounded-xl bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none" placeholder="Ex: Cliente solicitou desconto de 5% p/ pagamento à vista..." />
                     </div>
                     <PrimaryButton className="h-12 w-12 rounded-xl shrink-0" onClick={() => {
                       const input = document.getElementById("noteInput") as HTMLTextAreaElement;
                       if(input.value) { handleStatusChange(draft.status, input.value); input.value = ""; }
                     }}><Plus className="h-5 w-5" /></PrimaryButton>
                   </div>

                   <div className="space-y-4 mt-6 max-h-[500px] overflow-y-auto pr-3 scrollbar-thin">
                     {negotiationHistory.length === 0 && (
                        <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
                           <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                           <p className="text-xs text-muted-foreground uppercase tracking-widest">Nenhum registro de contato</p>
                        </div>
                     )}
                     {negotiationHistory.map((n, i) => (
                       <div key={n.id} className="relative pl-8 pb-8 group last:pb-0">
                          <div className="absolute left-0 top-0 bottom-0 w-px bg-border group-last:bg-transparent" />
                          <div className="absolute left-[-4px] top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(var(--primary-rgb),0.1)]" />
                          
                                                    <div className="bg-surface p-4 rounded-2xl border border-border hover:border-primary/30 transition-all hover:shadow-md relative group/note">
                              <div className="flex justify-between items-start mb-3">
                                 <div className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                    {n.status?.replace("_", " ") || "NOTA"}
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-muted-foreground font-mono">{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                                    <div className="flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                       <button 
                                          onClick={() => handleUpdateNote(n.id)}
                                          className="p-1 hover:bg-primary/10 rounded text-primary transition-colors"
                                          title="Editar"
                                       >
                                          <Pencil className="h-3 w-3" />
                                       </button>
                                       <button 
                                          onClick={() => handleDeleteNote(n.id)}
                                          className="p-1 hover:bg-destructive/10 rounded text-destructive transition-colors"
                                          title="Excluir"
                                       >
                                          <Trash2 className="h-3 w-3" />
                                       </button>
                                    </div>
                                 </div>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed">{n.note}</p>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionCard>
             </div>
           </div>
        )}


        {/* TAB HISTÓRICO & VERSÕES */}
        {activeTab === "Histórico & Versões" && (
           <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 animate-in fade-in duration-500">
             <div className="xl:col-span-7 space-y-6">
                <SectionCard title="Histórico de Versões do Orçamento" subtitle="Compare e recupere versões anteriores">
                  <div className="space-y-4">
                    {budgetVersions.map((v, i) => (
                      <div key={v.id} className={`p-5 rounded-2xl border-2 transition-all ${v.is_current ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-border bg-surface hover:border-primary/30"}`}>
                        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                          <div className="flex items-center gap-4">
                             <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-display font-bold text-lg ${v.is_current ? "bg-primary text-white" : "bg-background text-muted-foreground border border-border"}`}>
                                V{v.version_number}
                             </div>
                             <div>
                                <div className="font-bold flex items-center gap-2">
                                   {fmtBRL(v.final_budget_value)}
                                   {v.is_current && <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full uppercase">Atual</span>}
                                </div>
                                <div className="text-[10px] text-muted-foreground">Gerado em {format(parseISO(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                             </div>
                          </div>
                          
                          <div className="flex gap-2 w-full md:w-auto items-center">
                             <GhostButton 
                               onClick={() => {
                                 setDraft(mapBudgetToDraft(evento!, v));
                                 setActiveTab("Orçamento");
                               }} 
                               className="flex-1 md:flex-none h-10 px-4 text-[10px] font-bold"
                             >
                                CARREGAR NA TELA
                             </GhostButton>
                             {!v.is_current && (
                               <PrimaryButton onClick={async () => {
                                 await eventBudgetService.setCurrentVersion(eventoId, v.id);
                                 loadAllData();
                               }} className="flex-1 md:flex-none h-10 px-4 text-[10px] font-bold">TORNAR ATUAL</PrimaryButton>
                             )}
                             {budgetVersions.length > 1 && (
                                <button 
                                  onClick={() => handleDeleteVersion(v.id)}
                                  className="h-10 w-10 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-white hover:bg-destructive hover:border-destructive transition-all shrink-0"
                                  title="Excluir Versão"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                             )}
                          </div>
                        </div>
                        
                        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
                           <div className="text-center">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Convidados</div>
                              <div className="text-sm font-bold">{v.average_value_per_person > 0 ? Math.round(v.final_budget_value / v.average_value_per_person) : '--'}</div>
                           </div>
                           <div className="text-center">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Custo Total</div>
                              <div className="text-sm font-bold">{fmtBRL(v.drinks_base_cost + v.team_total_value + v.ice_total_value + v.fuel_value + v.miscellaneous_total_value)}</div>
                           </div>
                           <div className="text-center">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Margem</div>
                              <div className="text-sm font-bold text-success">{fmtBRL(v.profit_value)}</div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
             </div>

             <div className="xl:col-span-5">
                <SectionCard title="Log de Auditoria de Valores" subtitle="Rastreabilidade de mudanças críticas">
                   <div className="space-y-4">
                      {budgetHistory.length === 0 && (
                        <div className="py-20 text-center bg-surface rounded-2xl border-2 border-dashed">
                           <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                           <p className="text-xs text-muted-foreground uppercase tracking-widest">Nenhuma alteração registrada</p>
                        </div>
                      )}
                      {budgetHistory.map((h) => (
                        <div key={h.id} className="p-4 rounded-xl border border-border bg-surface space-y-3">
                           <div className="flex justify-between items-center">
                              <div className="text-xs font-bold text-primary uppercase tracking-widest">{h.action}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                           </div>
                           
                           <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-border/50">
                              <div className="flex-1 text-center">
                                 <div className="text-[8px] text-muted-foreground uppercase">De</div>
                                 <div className="text-xs font-bold line-through opacity-50">{fmtBRL(h.previous_final_value || 0)}</div>
                              </div>
                              <ArrowLeft className="h-3 w-3 text-muted-foreground rotate-180" />
                              <div className="flex-1 text-center">
                                 <div className="text-[8px] text-muted-foreground uppercase">Para</div>
                                 <div className="text-xs font-bold text-primary">{fmtBRL(h.new_final_value || 0)}</div>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </SectionCard>
             </div>
           </div>
        )}

      </div>
    </>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="font-medium text-sm border-b border-border/50 pb-1">{value || "---"}</div>
    </div>
  );
}

function StatusStep({ done, title }: { done: boolean, title: string }) {
  return (
    <div className="flex items-center gap-4 group">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${done ? "bg-success border-success text-white shadow-lg shadow-success/30" : "border-border text-muted-foreground group-hover:border-primary/50"}`}>
        {done ? <CheckCircle2 className="h-5 w-5" /> : <div className="h-1.5 w-1.5 rounded-full bg-border" />}
      </div>
      <span className={`text-sm font-bold uppercase tracking-wider ${done ? "text-foreground" : "text-muted-foreground"}`}>{title}</span>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 p-2 pr-4 hover:bg-primary/5 rounded-xl transition-colors group">
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-inner">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{label}</div>
        <div className="font-display font-bold text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1 group">
      <span className="text-muted-foreground text-xs uppercase tracking-widest font-medium group-hover:text-foreground transition-colors">{k}</span>
      <span className={`font-bold tabular-nums ${highlight ? "text-success text-base" : "text-foreground"}`}>{v}</span>
    </div>
  );
}

