import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { calcularOrcamentoEvento, type Evento, type EventoStatus } from "@/lib/mock-data";
import { ADDITIONAL_COST_LABEL, calcularTotalShots } from "@/lib/additional-budget-items";
import {
  beveragesToEditorValue,
  normalizeBeveragesForSave,
  preserveBeveragesInput,
} from "@/lib/budget-beverages";
import { fmtBRL } from "@/lib/format";
import {
  formatBrazilianDocument,
  getBrazilianDocumentType,
  validateBrazilianDocument,
} from "@/lib/format-document";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  MessageCircle,
  FileSignature,
  CheckCircle2,
  Download,
  AlertCircle,
  Link as LinkIcon,
  Loader2,
  Copy,
  Megaphone,
  UserPlus,
  History,
  Clock,
  Pencil,
  X,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { googleCalendarService } from "@/services/google-calendar/google-calendar-service";
import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/app-store";
import { DrinkImage } from "@/components/DrinkImage";
import {
  contractTemplatesService,
  contractSignersService,
  eventContractsService,
  clientContractFormService,
  renderContractTemplate,
  renderContractPreview,
  getTemplateContent,
  getTemplateMapping,
  validateContractPlaceholders,
  DEFAULT_CONTRACT_BODY,
  type ContractTemplate,
} from "@/services/contract-service";
import { convertHtmlToPdf } from "@/services/pdf-service";
import {
  convertAndDispatchSignature,
  getSignatureDispatchIdentifiers,
} from "@/services/signature-dispatch";
import { getSignatureProvider } from "@/services/signature-provider";
import { ContractReviewModal } from "@/components/contract-editor/ContractReviewModal";
import {
  eventBudgetService,
  type Event as RealEvent,
  type BudgetVersion,
  type BudgetHistory,
  type NegotiationHistory,
} from "@/services/event-budget-service";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Search, Upload, FileText as FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import {
  proposalTemplatesService,
  generatedProposalsService,
  pdfGenerationService,
  type ProposalData,
  type GeneratedProposal,
  type ProposalTemplate,
} from "@/services/proposal-service";
import { ComprasNotinhasTab } from "@/components/event-tabs/ComprasNotinhasTab";
import { InsumosLevadosTab } from "@/components/event-tabs/InsumosLevadosTab";
import { FechamentoTab } from "@/components/event-tabs/FechamentoTab";
import {
  getSignatureIntegrationState,
  canDeleteOrRegenerateContract,
  canCancelContract,
} from "@/lib/contract-state";
import { cancelAssinafySignature, type AssinafyDiagnostic } from "@/services/assinafy-service";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  deleteGeneratedProposal,
  CanvaGenerationDiagnostic,
  CanvaGenerationError,
  friendlyCanvaProposalError,
  generateCanvaProposal,
  getProposalGenerationFlow,
} from "@/lib/proposal-generation";
import { formatDateDot } from "@/lib/proposal-field-resolver";
import { buildProposalFilename } from "@/lib/proposal-filename";

export const Route = createFileRoute("/eventos/$eventoId")({
  component: EventoInterna,
});

const formatAssinafyDiagnostic = (diagnostic: AssinafyDiagnostic) =>
  [
    "Assinafy diagnostic",
    `Request started: ${diagnostic.requestStarted ? "yes" : "no"}`,
    `Backend reached: ${diagnostic.backendReached ? "yes" : "no"}`,
    `Assinafy request sent: ${diagnostic.assinafyRequestSent ? "yes" : "no"}`,
    `HTTP status: ${diagnostic.httpStatus ?? "no response"}`,
    `Assinafy response: ${JSON.stringify(diagnostic.assinafyResponse)}`,
    `Internal contract ID: ${diagnostic.internalContractId ?? "none"}`,
    `Internal document ID: ${diagnostic.internalDocumentId ?? "none"}`,
    `Assinafy document ID: ${diagnostic.assinafyDocumentId ?? "none"}`,
    `Database updated: ${diagnostic.databaseUpdated ? "yes" : "no"}`,
    `Timed out: ${diagnostic.timedOut ? "yes" : "no"}`,
    `Authentication rejected: ${diagnostic.authenticationRejected ? "yes" : "no"}`,
  ].join("\n");

const parseDiscountsFromDescription = (
  discountValue: number,
  discountDescription?: string | null,
) => {
  if (!discountDescription) return discountValue > 0 ? [{ valor: discountValue, motivo: "" }] : [];
  try {
    const parsed = JSON.parse(discountDescription);
    if (Array.isArray(parsed?.descontos)) {
      return parsed.descontos.map((d: any) => ({
        valor: Number(d.valor) || 0,
        motivo: String(d.motivo || ""),
      }));
    }
  } catch {}
  return discountValue > 0 ? [{ valor: discountValue, motivo: discountDescription }] : [];
};

const HeaderField = ({
  label,
  value,
  isEditing,
  onChange,
  icon,
  type = "text",
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  type?: string;
}) => {
  let displayValue = value || "---";
  if (!isEditing && type === "date" && value) {
    try {
      // Formata YYYY-MM-DD para DD/MM/YYYY
      const [y, m, d] = value.split("-");
      if (y && m && d) displayValue = `${d}/${m}/${y}`;
    } catch {}
  }
  return (
    <div className="space-y-1">
      <div className="label-eyebrow flex items-center gap-1">
        {icon} {label}
      </div>
      {isEditing ? (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-8 px-2 rounded bg-input border border-border text-xs focus:ring-1 focus:ring-primary outline-none transition-all"
        />
      ) : (
        <div className="text-sm font-bold truncate" title={displayValue}>
          {displayValue}
        </div>
      )}
    </div>
  );
};

function EventoInterna() {
  const { eventoId } = Route.useParams();
  const { glasswares, drinks: allDrinks } = useAppStore();

  // --- Estados Reais (Supabase) ---
  const [evento, setEvento] = useState<RealEvent | null>(null);
  const [currentBudget, setCurrentBudget] = useState<BudgetVersion | null>(null);
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [budgetHistory, setBudgetHistory] = useState<BudgetHistory[]>([]);
  const [negotiationHistory, setNegotiationHistory] = useState<NegotiationHistory[]>([]);
  const [sameDateEvents, setSameDateEvents] = useState<RealEvent[]>([]);

  const [realTemplates, setRealTemplates] = useState<ContractTemplate[]>([]);
  // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
  const [realSigners, setRealSigners] = useState<ContractSigner[]>([]);
  const [realClientData, setRealClientData] = useState<any>(null);
  const [realContract, setRealContract] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Visão Geral");
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [buscaDrink, setBuscaDrink] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedSigner, setSelectedSigner] = useState("");
  const [contractMode, setContractMode] = useState<"system" | "upload">("system");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [isProcessingContract, setIsProcessingContract] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteContractDialog, setShowDeleteContractDialog] = useState(false);
  const [showRegenerateContractDialog, setShowRegenerateContractDialog] = useState(false);

  // --- Contract Viewer States ---
  const [showContractPreviewModal, setShowContractPreviewModal] = useState(false);
  const [compiledContractText, setCompiledContractText] = useState("");
  const [compiledVariables, setCompiledVariables] = useState<Record<string, string>>({});

  // --- Proposal Modal States ---
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [existingProposal, setExistingProposal] = useState<GeneratedProposal | null>(null);
  const [proposalTemplate, setProposalTemplate] = useState<ProposalTemplate | null>(null);
  const [showDeleteProposalDialog, setShowDeleteProposalDialog] = useState(false);
  const [isDeletingProposal, setIsDeletingProposal] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [canvaGeneration, setCanvaGeneration] = useState<{
    open: boolean;
    status: "loading" | "success" | "error";
    pdfUrl?: string;
    filename?: string;
    message?: string;
    code?: string;
    upsellUrl?: string | null;
    diagnostic?: CanvaGenerationDiagnostic;
  }>({ open: false, status: "loading" });

  const handleGenerateProposal = async () => {
    if (canvaGeneration.status === "loading" && canvaGeneration.open) {
      return; // prevent duplicate clicks
    }
    const evType = evento?.event_type?.toLowerCase() || "";
    const mappedType: "casamento" | "aniversario" | "comemoracao" = evType.includes("casamento")
      ? "casamento"
      : evType.includes("aniversario") || evType.includes("aniversário")
        ? "aniversario"
        : "comemoracao";
    try {
      const template = await proposalTemplatesService.getDefaultTemplate(mappedType);
      setProposalTemplate(template);
      if (!template) {
        throw new Error(
          "Nenhum modelo de proposta ativo foi configurado para este tipo de evento.",
        );
      }
      if (getProposalGenerationFlow(template) === "internal") {
        setShowProposalModal(true);
        return;
      }
      if (!currentBudget?.id) {
        toast.error("Salve uma versão do orçamento antes de gerar a proposta.");
        return;
      }
      setCanvaGeneration({ open: true, status: "loading" });
      const result = await generateCanvaProposal(eventoId, currentBudget.id);
      setExistingProposal(result.proposal);
      setCanvaGeneration({
        open: true,
        status: "success",
        pdfUrl: result.pdf_url,
        filename: result.filename,
      });
    } catch (error: any) {
      const message = friendlyCanvaProposalError(error);
      const code = error?.code || error?.error_code || error?.diagnostic?.code;
      const upsellUrl =
        error?.upsellUrl || error?.upsell_url || error?.diagnostic?.upsell_url || null;
      const diagnostic = error instanceof CanvaGenerationError ? error.diagnostic : undefined;
      setCanvaGeneration({
        open: true,
        status: "error",
        message,
        code,
        upsellUrl,
        diagnostic,
      });
    }
  };

  const handleDeleteProposal = async () => {
    if (!existingProposal?.id) return;
    try {
      setIsDeletingProposal(true);
      await deleteGeneratedProposal(existingProposal.id);
      toast.success("Proposta excluída com sucesso.");
      setExistingProposal(null);
      setShowDeleteProposalDialog(false);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível excluir a proposta.");
    } finally {
      setIsDeletingProposal(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [eventoId]);

  const loadProposal = async () => {
    try {
      const prop = await generatedProposalsService.getProposalByEventId(eventoId);
      setExistingProposal(prop);
    } catch (err) {
      console.warn("Erro ao carregar proposta existente:", err);
    }
  };

  const loadContractModule = async () => {
    const [tps, sigs, contract] = await Promise.all([
      contractTemplatesService.listTemplates(),
      contractSignersService.listSigners(),
      eventContractsService.getContractByEventId(eventoId),
    ]);
    setRealTemplates(tps);
    setRealSigners(sigs);
    setRealContract(contract);

    if (contract?.id) {
      try {
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        const provider = getSignatureProvider(contract.signature_provider || contract.provider);
        const sigData = await provider.syncStatus(contract.id);
        setProviderDetails(sigData);
      } catch (e) {
        console.warn("Status de assinatura não pôde ser consultado:", e);
      }
    }

    if (tps.length > 0) {
      const defT = tps.find((t) => t.is_default) || tps[0];
      if (defT) setSelectedTemplate(defT.id);
    }
    if (sigs.length > 0) {
      const defS = sigs.find((s) => s.is_active) || sigs[0];
      if (defS) setSelectedSigner(defS.id);
    }
    if (contract?.signed_file_url && !contract?.template_id) {
      setContractMode("upload");
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ev, budget, versions, bHist, nHist, tps, sigs, contract] = await Promise.all([
        eventBudgetService.getEventById(eventoId),
        eventBudgetService.getCurrentBudget(eventoId),
        eventBudgetService.listBudgetVersions(eventoId),
        eventBudgetService.getBudgetHistory(eventoId),
        eventBudgetService.getNegotiationHistory(eventoId),
        contractTemplatesService.listTemplates(),
        contractSignersService.listSigners(),
        eventContractsService.getContractByEventId(eventoId),
      ]);

      setEvento(ev);
      setCurrentBudget(budget);
      setBudgetVersions(versions);
      setBudgetHistory(bHist);
      setNegotiationHistory(nHist);
      setRealTemplates(tps);
      setRealSigners(sigs);
      setRealContract(contract);
      if (contract?.signed_file_url && !contract?.template_id) {
        setContractMode("upload");
      }
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
          setSameDateEvents(conflicts.filter((c) => c.id !== eventoId));
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
    loadProposal();
  };

  const mapEventToDraft = (ev: RealEvent): Evento => ({
    id: ev.id,
    nome: ev.event_name || ev.client_name,
    // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
    evento_nome: ev.event_name || "",
    cliente: ev.client_name,
    nomeNoivo: ev.groom_name || "",
    nomeNoiva: ev.bride_name || "",
    telefone: ev.phone || "",
    email: ev.email || "",
    data: ev.date,
    horario: ev.event_time || "",
    // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
    duracao: ev.duration_hours || "",
    local: ev.event_location || "",
    cidade: ev.city || "",
    tipo: ev.event_type,
    convidados: ev.guests || 0,
    drinks: Array.isArray(ev.drinks) ? ev.drinks : [],
    observacoes: ev.notes || "",
    status: ev.status as any,
    lead_source: ev.lead_source || "",
    referral_name: ev.referral_name || "",
    is_paid_full: (ev.payment_percent_received || 0) >= 100,
    drinksPorPessoa: 4,
    markupAdicionalDrinks: 0,
    hasWelcomeDrinks: false,
    welcomeDrinksPerPerson: 0,
    welcomeDrinksProfitPercentage: 0,
    welcomeDrinksSelected: [],
    hasShots: false,
    shotsItems: [],
    equipe: {
      bartender: { qtd: 0, valorUnitario: 200 },
      keeper: { qtd: 0, valorUnitario: 200 },
      copeira: { qtd: 0, valorUnitario: 200 },
    },
    gelo: { valorUnitario: 6 },
    viagem: { incluir: false, valor: 0 },
    gastosDiversos: [],
    lucroDesejado: 0,
    pagamento: {
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      formaPagamento: ev.payment_method || "",
      percentualPago: ev.payment_percent_received || 0,
      dataPagamento: ev.payment_due_date,
    },
    coposVinculados: {},
    historicoAlteracoes: [],
    historicoNegociacao: [],
    valorNegociado: ev.current_budget_value || 0,
    custoPrevisto: 0,
    desconto: 0,
    descontoMotivo: "",
    descontos: [],
    descricaoBebidas: "",
    bebidas: [],
    bebidasInput: "",
  });

  const mapBudgetToDraft = (ev: RealEvent, b: BudgetVersion): Evento => ({
    id: ev.id,
    nome: ev.event_name || ev.client_name,
    // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
    evento_nome: ev.event_name || "",
    cliente: ev.client_name,
    nomeNoivo: ev.groom_name || "",
    nomeNoiva: ev.bride_name || "",
    telefone: ev.phone || "",
    email: ev.email || "",
    data: ev.date,
    horario: ev.event_time || "",
    // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
    duracao: ev.duration_hours || "",
    local: ev.event_location || "",
    cidade: ev.city || "",
    tipo: ev.event_type,
    convidados: ev.guests || 0,
    drinks: (b.selected_drinks as any)?.ids || [],
    observacoes: ev.notes || "",
    status: ev.status as any,
    lead_source: ev.lead_source || "",
    referral_name: ev.referral_name || "",
    is_paid_full: (ev.payment_percent_received || 0) >= 100,
    drinksPorPessoa: b.drinks_per_person,
    markupAdicionalDrinks: b.drinks_markup_percentage,
    hasWelcomeDrinks: b.has_welcome_drinks ?? false,
    welcomeDrinksPerPerson: b.welcome_drinks_per_person ?? 0,
    welcomeDrinksProfitPercentage: b.welcome_drinks_profit_percentage ?? 0,
    welcomeDrinksSelected: Array.isArray(b.welcome_drinks_selected)
      ? b.welcome_drinks_selected
      : [],
    hasShots: b.has_shots ?? false,
    shotsItems: Array.isArray(b.shots_items) ? b.shots_items : [],
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
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      formaPagamento: b.payment_method || ev.payment_method || "",
      percentualPago: b.paid_percentage || ev.payment_percent_received || 0,
      dataPagamento: b.pending_payment_date || ev.payment_due_date,
    },
    coposVinculados: (b.selected_drinks as any)?.copos || {},
    historicoAlteracoes: [],
    historicoNegociacao: [],
    valorNegociado: b.final_budget_value || ev.current_budget_value || 0,
    custoPrevisto:
      b.drinks_base_cost +
      b.team_total_value +
      b.ice_total_value +
      b.fuel_value +
      b.miscellaneous_total_value,
    desconto: b.discount_value,
    descontoMotivo: b.discount_description || "",
    descontos: parseDiscountsFromDescription(b.discount_value, b.discount_description),
    descricaoBebidas: (b.selected_drinks as any)?.descricaoBebidas || "",
    bebidas: Array.isArray(b.beverages)
      ? b.beverages.filter((item): item is string => typeof item === "string")
      : [],
    bebidasInput: beveragesToEditorValue(b.beverages),
  });

  const [draft, setDraft] = useState<Evento | null>(null);

  const calc = draft ? calcularOrcamentoEvento(draft, allDrinks) : null;

  const handleSave = async (saveAsNew: boolean = false) => {
    if (!draft || !calc) return;
    setSaving(true);
    try {
      const descontosValidos = (draft.descontos || []).filter((d) => (Number(d.valor) || 0) > 0);
      const totalDescontos = descontosValidos.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
      const budgetPayload = {
        drinks_per_person: draft.drinksPorPessoa,
        drinks_markup_percentage: draft.markupAdicionalDrinks,
        drinks_cost_sum: calc.mediaCustoDrinks * draft.drinks.length,
        average_drink_cost: calc.mediaCustoDrinks,
        drinks_base_cost: calc.mediaCustoDrinks * (draft.convidados * draft.drinksPorPessoa),
        drinks_final_value: calc.valorDrinksEvento,
        has_welcome_drinks: draft.hasWelcomeDrinks,
        welcome_drinks_per_person: draft.welcomeDrinksPerPerson,
        welcome_drinks_profit_percentage: draft.welcomeDrinksProfitPercentage,
        welcome_drinks_selected: draft.welcomeDrinksSelected,
        welcome_drinks_cost: calc.welcomeDrinks.custoTotal,
        welcome_drinks_final_value: calc.welcomeDrinks.valorFinal,
        has_shots: draft.hasShots,
        shots_items: draft.shotsItems,
        shots_total_value: calc.shotsTotal,
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
        beverages: normalizeBeveragesForSave(draft.bebidasInput),
        selected_drinks: {
          ids: draft.drinks,
          copos: draft.coposVinculados,
          descricaoBebidas: draft.descricaoBebidas,
        },
        discount_value: totalDescontos,
        discount_description: JSON.stringify({ descontos: descontosValidos }),
      };

      // Atualiza evento base com totais financeiros para integração com dashboard/financeiro
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      await eventBudgetService.updateEvent(evento.id, {
        client_name: draft.cliente,
        groom_name: draft.nomeNoivo || null,
        bride_name: draft.nomeNoiva || null,
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        event_name: draft.evento_nome,
        phone: draft.telefone,
        email: draft.email,
        date: draft.data,
        event_time: draft.horario,
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        duration_hours: draft.duracao ? Number(draft.duracao) : null,
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
        current_profit_value: calc.lucro,
        payment_due_date: draft.pagamento.dataPagamento,
        payment_percent_received: draft.pagamento.percentualPago,
      });

      // Salva orçamento
      const newBudget = await eventBudgetService.createBudgetVersion(
        eventoId,
        budgetPayload,
        saveAsNew,
      );

      // Adiciona histórico apenas se houver mudança financeira real
      const hasFinancialChange =
        !currentBudget || currentBudget.final_budget_value !== calc.valorTotalOrcamento;

      if (hasFinancialChange) {
        await eventBudgetService.addBudgetHistory({
          event_id: eventoId,
          budget_version_id: newBudget.id,
          action: saveAsNew ? "Nova versão criada" : "Valores financeiros atualizados",
          previous_final_value: currentBudget?.final_budget_value || 0,
          new_final_value: calc.valorTotalOrcamento,
          changed_fields: ["Ajuste de valores"],
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

    if (
      !confirm(
        "Tem certeza que deseja excluir esta versão do orçamento? Esta ação não poderá ser desfeita.",
      )
    )
      return;

    try {
      const vToDelete = budgetVersions.find((x) => x.id === versionId);
      if (!vToDelete) return;

      // Se for a versão atual, precisamos promover outra antes de deletar
      if (vToDelete.is_current) {
        const otherVersions = budgetVersions.filter((x) => x.id !== versionId);
        // Pega a versão com maior número (mais recente) entre as que sobraram
        const nextCurrent = otherVersions.sort((a, b) => b.version_number - a.version_number)[0];
        await eventBudgetService.setCurrentVersion(eventoId, nextCurrent.id);
      }

      // Log de Auditoria
      await eventBudgetService.addBudgetHistory({
        event_id: eventoId,
        action: `VERSÃO V${vToDelete.version_number} EXCLUÍDA`,
        previous_final_value: vToDelete.final_budget_value,
        new_final_value: 0,
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
    if (!confirm("Deseja realmente excluir esta anotação? Esta ação não poderá ser desfeita."))
      return;
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
      setDraft((p) =>
        p
          ? { ...p, is_paid_full: newVal, pagamento: { ...p.pagamento, percentualPago: newPerc } }
          : null,
      );

      // Mensagem instrutiva
      alert(
        newVal
          ? "Evento marcado como PAGO. Salve o orçamento para persistir no Dashboard."
          : "Evento marcado como PENDENTE. Salve o orçamento para persistir.",
      );
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

      setDraft((p) => (p ? { ...p, status: newStatus } : null));
      loadAllData();
    } catch (e: any) {
      alert(`Erro ao atualizar status: ${e.message || "Erro desconhecido"}`);
    }
  };

  const toggleDrink = (id: string) => {
    setDraft((p) => {
      if (!p) return null;
      const isSelected = p.drinks.includes(id);
      const newDrinks = isSelected ? p.drinks.filter((x) => x !== id) : [...p.drinks, id];
      const newCopos = { ...p.coposVinculados };
      if (isSelected) delete newCopos[id];
      return { ...p, drinks: newDrinks, coposVinculados: newCopos };
    });
  };

  const handlePreviewGeneratedContract = async () => {
    try {
      console.log("🔹 [Contract Preview] 1. Iniciando carregamento dos dados...");
      const sId =
        selectedSigner ||
        realContract?.signer_id ||
        (realSigners && realSigners.find((s) => s.is_active)?.id);

      console.log(
        "🔹 [Contract Preview] 2. Compilando variáveis do evento:",
        eventoId,
        "Sócio ID:",
        sId,
      );
      const vars = await eventContractsService.compileContractVariables(eventoId, sId);
      setCompiledVariables(vars);

      const templateToUse =
        (realTemplates &&
          realTemplates.find((t) => t.id === (selectedTemplate || realContract?.template_id))) ||
        (realTemplates && realTemplates.find((t) => t.is_default)) ||
        (realTemplates && realTemplates[0]);

      if (!templateToUse) {
        console.warn("⚠️ [Contract Preview] Nenhum modelo de contrato anexado ou selecionado.");
        toast.error(
          "Nenhum modelo de contrato anexado. Por favor, acesse Documentos > Contratos e anexe seu modelo primeiro.",
        );
        return;
      }

      console.log("🔹 [Contract Preview] 3. Template carregado com sucesso:", templateToUse.name);

      const templateContent = getTemplateContent(templateToUse);
      const mapping = getTemplateMapping(templateToUse);

      console.log(
        "🔹 [Contract Preview] 4. Match de campos carregado:",
        Object.keys(mapping || {}).length,
        "mapeamento(s)",
      );

      console.debug("[Contract Preview] Conteúdo antes da normalização:", templateContent);
      // A minuta deve abrir mesmo quando houver campos pendentes. Esses campos
      // ficam visíveis no painel de validação e só bloqueiam a exportação/envio.
      const text = renderContractPreview(templateContent, vars, mapping);
      console.log(
        "🔹 [Contract Preview] 5. Documento gerado com sucesso! Tamanho final:",
        text.length,
        "caracteres",
      );
      console.log("🔹 [Contract Preview] 6. Pré-visualização iniciada.");

      setCompiledContractText(text);
      setShowContractPreviewModal(true);
    } catch (e: any) {
      console.error("❌ [Contract Preview] EXCEÇÃO DETALHADA ao gerar pré-visualização:", e);
      console.error("Stack trace completo:", e?.stack);
      const pendingTokens = Array.isArray(e?.unresolvedFields) ? e.unresolvedFields : [];
      if (Array.isArray(e?.issues)) {
        console.error("[Contract Preview] Tokens/elementos reprovados:", e.issues);
      }
      const message =
        pendingTokens.length > 0
          ? `Não foi possível gerar a pré-visualização. Campos pendentes: ${pendingTokens.join(", ")}.`
          : `Não foi possível gerar a pré-visualização. ${e?.message || "Verifique as configurações do modelo ou evento."}`;
      toast.error(message);
    }
  };

  const [isDispatchingSignature, setIsDispatchingSignature] = useState(false);
  const isSignatureDispatchLocked = useRef(false);
  const [isRefreshingSignature, setIsRefreshingSignature] = useState(false);
  const [providerDetails, setProviderDetails] = useState<any>(null);

  const handleDispatchSignature = async (overrideHtml?: string) => {
    if (!realContract) {
      toast.error("Nenhum contrato gerado para este evento.");
      return;
    }

    if (!realClientData?.email) {
      alert(
        "O e-mail do contratante é obrigatório para envio de assinatura. Atualize os Dados do Contratante.",
      );
      return;
    }

    if (isSignatureDispatchLocked.current) return;
    isSignatureDispatchLocked.current = true;
    setIsDispatchingSignature(true);
    try {
      let compiledHtml = overrideHtml;
      if (!compiledHtml) {
        const sId =
          selectedSigner ||
          realContract.signer_id ||
          (realSigners && realSigners.find((s) => s.is_active)?.id);
        const vars = await eventContractsService.compileContractVariables(eventoId, sId);
        const templateToUse =
          (realTemplates &&
            realTemplates.find((t) => t.id === (selectedTemplate || realContract.template_id))) ||
          (realTemplates && realTemplates.find((t) => t.is_default)) ||
          (realTemplates && realTemplates[0]);

        if (!templateToUse) {
          toast.error("Nenhum modelo de contrato selecionado.");
          setIsDispatchingSignature(false);
          return;
        }

        const templateContent = getTemplateContent(templateToUse);
        const { unfilled } = validateContractPlaceholders(templateContent, vars);

        if (unfilled.length > 0) {
          const pendings = unfilled.map((u) => u.token).join("\n- ");
          alert(
            `Não é possível enviar o contrato para assinatura, pois faltam informações nos seguintes campos:\n\n- ${pendings}\n\nPor favor, preencha as informações pendentes (atualize o evento) ou regenere o contrato.`,
          );
          setIsDispatchingSignature(false);
          return;
        }

        const mapping = getTemplateMapping(templateToUse);
        compiledHtml = renderContractTemplate(templateContent, vars, mapping);
      }

      // 2. Converte o resultado compilado existente para PDF imutável (etapa adicional única)
      // 3. Dispara para o Provedor Ativo somente depois que o PDF estiver pronto
      const provider = getSignatureProvider(
        realContract.signature_provider || realContract.provider,
      );
      const identifiers = getSignatureDispatchIdentifiers(eventoId, realContract);
      const routeId = eventoId;
      const contractRecordId = realContract?.id;
      const contractEventId = realContract?.event_id;
      const contractStatus = realContract?.status;
      console.info("[assinafy-send] resolved identifiers", {
        routeId,
        eventId: eventoId,
        contractId: identifiers.contractId,
        contractRecordId,
        contractEventId,
        contractStatus,
      });
      const { pdf, result } = await convertAndDispatchSignature({
        html: compiledHtml,
        title: `Contrato_${realClientData.client_name || "Evento"}`,
        contractId: identifiers.contractId,
        convert: convertHtmlToPdf,
        provider,
      });
      const { hash } = pdf;

      console.log("🔹 [Signature Dispatch] Hash SHA-256 do PDF imutável:", hash);

      if (result.success && result.externalDocumentId) {
        await handleStatusChange(
          // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
          "em_assinatura",
          `Contrato enviado para assinatura digital via ${provider.name}.`,
        );
        alert(
          `Contrato enviado para ${provider.name} com sucesso!\n\nID do Documento: ${result.externalDocumentId}\nHash SHA-256: ${hash.substring(0, 16)}...${result.diagnostic ? `\n\n${formatAssinafyDiagnostic(result.diagnostic)}` : ""}`,
        );
        await loadContractModule();
      } else {
        alert(`Erro ao enviar contrato: Resultado vazio.`);
      }
    } catch (err: any) {
      console.error("Erro no disparo de assinatura:", err);
      const diagnostic = err?.diagnostic ? `\n\n${formatAssinafyDiagnostic(err.diagnostic)}` : "";
      alert(`Erro ao enviar: ${err.message || "Erro inesperado"}${diagnostic}`);
    } finally {
      isSignatureDispatchLocked.current = false;
      setIsDispatchingSignature(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!realClientData) {
      alert("Os dados do cliente são necessários. Solicite os dados primeiro ou gere o link.");
      return;
    }

    if (realClientData.cpf_cnpj) {
      const docVal = validateBrazilianDocument(realClientData.cpf_cnpj);
      if (!docVal.valid) {
        alert(
          `Não foi possível gerar o contrato.\n\nMotivo: ${docVal.error || "O documento informado é inválido."}\n\nPor favor, corrija os dados do contratante antes de prosseguir.`,
        );
        return;
      }
    }
    const tId =
      selectedTemplate || realTemplates.find((t) => t.is_default)?.id || realTemplates[0]?.id;
    const sId = selectedSigner || realSigners.find((s) => s.is_active)?.id || realSigners[0]?.id;

    if (!tId || !sId) {
      alert("Selecione um modelo de contrato e um sócio assinante.");
      return;
    }

    try {
      if (!draft) return;
      await eventContractsService.createContractForEvent(draft.id, tId, sId);
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      await handleStatusChange("em_assinatura", "Contrato gerado automaticamente no sistema.");
      alert(
        "Contrato gerado com sucesso! Todas as variáveis do cliente e orçamento foram preenchidas automaticamente.",
      );
      await loadContractModule();
      handlePreviewGeneratedContract();
    } catch (e: any) {
      toast.error(`Erro ao gerar contrato: ${e.message || "Erro desconhecido"}`);
    }
  };

  const handleCancelSignature = async () => {
    if (isCanceling || !realContract) return;
    setIsCanceling(true);
    try {
      await cancelAssinafySignature(realContract.id);
      toast.success("Envio cancelado com sucesso.");
      await loadContractModule();
    } catch (e: any) {
      toast.error(`Falha ao cancelar: ${e.message}`);
      await loadContractModule();
    } finally {
      setIsCanceling(false);
      setShowCancelDialog(false);
    }
  };

  const integrationState = realContract
    ? getSignatureIntegrationState(realContract.status, providerDetails)
    : "not_sent";

  const refreshSignatureStatus = async () => {
    if (!realContract?.id || isRefreshingSignature) return;
    setIsRefreshingSignature(true);
    try {
      const provider = getSignatureProvider(
        realContract.signature_provider || realContract.provider,
      );
      setProviderDetails(await provider.syncStatus(realContract.id));
      toast.success("Status da assinatura atualizado.");
    } catch (e: any) {
      toast.error(`Não foi possível atualizar o status: ${e.message}`);
    } finally {
      setIsRefreshingSignature(false);
    }
  };

  const handleDeleteContract = async () => {
    if (isProcessingContract) return;
    if (!realContract || realContract.status !== "draft") return;

    if (!canDeleteOrRegenerateContract(integrationState)) {
      alert(
        "Não é possível excluir um contrato que já foi enviado ou possui integrações ativas com o provedor de assinatura.",
      );
      return;
    }

    if (
      !confirm("Tem certeza que deseja excluir o contrato atual? Esta ação não pode ser desfeita.")
    )
      return;

    setIsProcessingContract(true);
    try {
      await eventContractsService.deleteContract(realContract.id);

      await eventBudgetService.addBudgetHistory({
        event_id: eventoId,
        action: "Contrato em rascunho excluído",
        previous_final_value: 0,
        new_final_value: 0,
        changed_fields: ["Contrato"],
      });

      alert("Contrato excluído com sucesso.");
      await loadContractModule();
      setShowContractPreviewModal(false);
    } catch (e: any) {
      toast.error(`Erro ao excluir contrato: ${e.message}`);
    } finally {
      setIsProcessingContract(false);
    }
  };

  const handleRegenerateContract = async () => {
    if (isProcessingContract) return;
    if (!draft || !realContract || realContract.status !== "draft") return;

    if (!canDeleteOrRegenerateContract(integrationState)) {
      alert(
        "Não é possível regenerar um contrato que já foi enviado ou possui integrações ativas com o provedor de assinatura.",
      );
      return;
    }

    const tId =
      selectedTemplate ||
      realContract.template_id ||
      realTemplates.find((t) => t.is_default)?.id ||
      realTemplates[0]?.id;
    const sId =
      selectedSigner ||
      realContract.signer_id ||
      realSigners.find((s) => s.is_active)?.id ||
      realSigners[0]?.id;

    if (!tId || !sId) {
      alert("Selecione um modelo de contrato e um sócio assinante.");
      return;
    }

    if (
      !confirm(
        "A regeneração substituirá o contrato atual pelos dados e serviços atualizados do evento. Deseja prosseguir?",
      )
    ) {
      return;
    }

    setIsProcessingContract(true);
    try {
      const vars = await eventContractsService.compileContractVariables(eventoId, sId);
      const templateToUse = realTemplates.find((t) => t.id === tId);
      if (!templateToUse) throw new Error("Template não encontrado.");

      const templateContent = getTemplateContent(templateToUse);
      const { unfilled } = validateContractPlaceholders(templateContent, vars);

      if (unfilled.length > 0) {
        const pendings = unfilled.map((u) => u.token).join("\n- ");
        alert(
          `Não é possível regenerar o contrato pois ainda faltam informações para os seguintes campos:\n\n- ${pendings}\n\nPor favor, preencha as informações pendentes antes de prosseguir.`,
        );
        return;
      }

      await eventContractsService.updateDraftContract(realContract.id, tId, sId);

      await eventBudgetService.addBudgetHistory({
        event_id: eventoId,
        action: "Contrato regenerado a partir de dados atualizados",
        previous_final_value: 0,
        new_final_value: 0,
        changed_fields: ["Contrato"],
      });

      toast.success("Contrato regenerado com sucesso!");
      await loadContractModule();
      setShowContractPreviewModal(false);
    } catch (e: any) {
      toast.error(`Erro ao regenerar contrato: ${e.message || "Erro desconhecido"}`);
    } finally {
      setIsProcessingContract(false);
    }
  };

  const handleRequestClientData = async () => {
    try {
      if (!draft) return;
      const data = await clientContractFormService.createPublicFormToken(draft.id);
      const link = `${window.location.origin}/contrato/dados/${data.public_token}`;
      navigator.clipboard.writeText(link);
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      handleStatusChange("dados_solicitados", "Link de coleta de dados gerado.");
      alert("Link seguro copiado para a área de transferência!");
      loadContractModule();
    } catch (e) {
      alert("Erro ao gerar link de solicitação.");
    }
  };

  const handleManualContractUpload = async (file: File) => {
    try {
      setUploadingContract(true);
      const publicUrl = await eventContractsService.uploadSignedContractFile(eventoId, file);
      await eventContractsService.saveSignedContract(eventoId, publicUrl, realContract?.id);
      await handleStatusChange("CONFIRMADO", "Contrato assinado anexado manualmente.");
      toast.success("Contrato assinado enviado com sucesso!");
      loadContractModule();
      loadAllData();
    } catch (e: any) {
      console.error("Erro no upload do contrato:", e);
      toast.error(`Erro ao fazer upload do contrato: ${e.message || "Erro desconhecido"}`);
    } finally {
      setUploadingContract(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este evento e todos os dados relacionados?"))
      return;
    try {
      setSaving(true);
      await eventBudgetService.deleteEvent(eventoId);
      window.history.back();
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
        <Link to="/eventos" className="text-primary text-sm mt-3 inline-block">
          Voltar para lista
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            to="/eventos"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
        }
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        title={draft.evento_nome || draft.cliente || draft.nome}
        subtitle={`${draft.tipo} · Versão ${currentBudget?.version_number || 1}`}
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
            <button
              onClick={handleDelete}
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors"
              title="Excluir Evento"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <GhostButton
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 min-w-0 justify-center sm:flex-none"
            >
              <Copy className="h-4 w-4" /> Salvar Nova Versão
            </GhostButton>
            <PrimaryButton
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 min-w-0 justify-center sm:flex-none"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Atualizar Atual"}
            </PrimaryButton>
          </div>
        }
      />

      <div className="w-full max-w-[1400px] mx-auto px-3 py-5 space-y-6 sm:px-5 sm:py-6 md:px-8 md:py-7 md:space-y-7">
        {/* ALERTAS DE CONFLITO */}
        {sameDateEvents.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex gap-4 items-center animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="h-12 w-12 bg-destructive/20 rounded-full flex items-center justify-center text-destructive shrink-0">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-destructive">Atenção: Conflito de Agenda</h4>
              <p className="text-sm text-destructive/80">
                Já existem {sameDateEvents.length} evento(s) cadastrado(s) para o dia{" "}
                {draft.data
                  ? (() => {
                      try {
                        return format(parseISO(draft.data), "dd/MM/yyyy", { locale: ptBR });
                      } catch {
                        return draft.data;
                      }
                    })()
                  : "esta data"}
                :
                <span className="font-semibold ml-1">
                  {sameDateEvents.map((e) => e.event_name || e.client_name).join(", ")}
                </span>
              </p>
            </div>
            <Link
              to="/eventos"
              className="text-xs font-bold uppercase tracking-wider bg-destructive text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Ver Calendário
            </Link>
          </div>
        )}

        {/* CABEÇALHO DO EVENTO — INFORMAÇÕES DO CLIENTE */}
        <div className="card-premium relative overflow-hidden bg-surface p-4 sm:p-5 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-6 border-b border-border/50">
            <div className="flex gap-4 items-center">
              <div
                className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isEditingHeader ? "bg-success text-white shadow-success/20" : "bg-primary text-white shadow-primary/20"}`}
              >
                {isEditingHeader ? <Check className="h-7 w-7" /> : <Users className="h-7 w-7" />}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-display font-bold tracking-tight">
                    {isEditingHeader
                      ? "Editando Cabeçalho"
                      : // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
                        draft.evento_nome || draft.cliente || draft.nome}
                  </h2>
                  <button
                    onClick={() => {
                      if (isEditingHeader) handleSave(false);
                      setIsEditingHeader(!isEditingHeader);
                    }}
                    className={`h-9 px-4 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${isEditingHeader ? "bg-success text-white hover:bg-success/90" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                  >
                    {isEditingHeader ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> SALVAR DADOS
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3.5 w-3.5" /> EDITAR CABEÇALHO
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1 font-medium">
                  {draft.tipo} · {draft.cidade || "Local não definido"}
                </p>
              </div>
            </div>

            <div className="flex w-full md:w-auto flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 self-stretch md:self-auto">
              <div className="text-left sm:text-right min-w-0">
                <div className="label-eyebrow mb-1">Valor do Orçamento</div>
                <div className="font-display text-2xl sm:text-3xl font-black text-primary leading-tight break-words">
                  {fmtBRL(calc.valorTotalOrcamento)}
                </div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest break-words">
                  {fmtBRL(calc.mediaPorPessoa)} / PESSOA
                </div>
              </div>
              <div className="h-px sm:h-12 sm:w-px bg-border/60 hidden lg:block" />
              <div className="text-left sm:text-right min-w-0">
                <div className="label-eyebrow mb-2">Status da Negociação</div>
                <select
                  value={draft.status}
                  onChange={(e) => handleStatusChange(e.target.value as EventoStatus)}
                  className="bg-surface border-2 border-primary/20 text-primary font-bold text-xs px-4 py-2 rounded-xl outline-none cursor-pointer hover:border-primary/40 transition-all shadow-sm"
                >
                  <option value="NOVO">Novo Orçamento</option>
                  <option value="ORCAMENTO_ENVIADO">Orçamento Enviado</option>
                  <option value="AGUARDANDO_RESPOSTA">Aguardando Resposta</option>
                  <option value="DADOS_SOLICITADOS">Dados p/ Contrato</option>
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>

                {evento && (
                  <div className="flex items-center gap-2 mt-2 justify-start sm:justify-end text-xs">
                    {evento.google_calendar_sync_status === "synced" ? (
                      <div className="flex items-center gap-1.5 text-[#22c55e]">
                        <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                        <span className="font-semibold text-[11px]">Calendar: Sincronizado</span>
                        {evento.google_calendar_html_link && (
                          <a
                            href={evento.google_calendar_html_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
                            title="Abrir no Google Calendar"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ) : evento.google_calendar_sync_status === "error" ? (
                      <div className="flex items-center gap-1.5 text-destructive">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="font-semibold text-[11px]">Erro no Calendar</span>
                        <button
                          onClick={async () => {
                            setIsSyncingCalendar(true);
                            try {
                              const res = await googleCalendarService.syncEvent(eventoId);
                              if (res.success) {
                                toast.success("Evento sincronizado com o Google Calendar!");
                                loadAllData();
                              } else {
                                toast.error(res.error || "Erro ao sincronizar.");
                              }
                            } finally {
                              setIsSyncingCalendar(false);
                            }
                          }}
                          disabled={isSyncingCalendar}
                          className="text-[11px] text-primary underline hover:text-primary/80 ml-1 cursor-pointer"
                        >
                          {isSyncingCalendar ? "..." : "Tentar novamente"}
                        </button>
                      </div>
                    ) : evento.google_calendar_sync_status === "cancelled" ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                        <span className="font-semibold text-[11px]">Calendar: Cancelado</span>
                      </div>
                    ) : draft.status.toLowerCase().includes("conf") ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <button
                          onClick={async () => {
                            setIsSyncingCalendar(true);
                            try {
                              const res = await googleCalendarService.syncEvent(eventoId);
                              if (res.success) {
                                toast.success("Evento sincronizado com o Google Calendar!");
                                loadAllData();
                              } else {
                                toast.error(res.error || "Erro ao sincronizar.");
                              }
                            } finally {
                              setIsSyncingCalendar(false);
                            }
                          }}
                          disabled={isSyncingCalendar}
                          className="text-[11px] text-primary underline hover:text-primary/80 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${isSyncingCalendar ? "animate-spin" : ""}`}
                          />
                          {isSyncingCalendar ? "Sincronizando..." : "Sincronizar no Calendar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-y-8 gap-x-10">
            {/* Coluna 1: Principal */}
            <div className="space-y-5">
              <HeaderField
                label="Nome do Solicitante"
                value={draft.cliente}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, cliente: v, nome: v } : null))}
                icon={<Users className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Tipo do Evento"
                value={draft.tipo}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, tipo: v } : null))}
                icon={<Save className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Nome do Evento / Casal"
                // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
                value={draft.evento_nome}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, evento_nome: v } : null))}
                icon={<Users className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Nome do noivo"
                value={draft.nomeNoivo || ""}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, nomeNoivo: v } : null))}
                icon={<Users className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Nome da noiva"
                value={draft.nomeNoiva || ""}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, nomeNoiva: v } : null))}
                icon={<Users className="h-3 w-3 text-primary/60" />}
              />
            </div>

            {/* Coluna 2: Contato */}
            <div className="space-y-5">
              <HeaderField
                label="Telefone / WhatsApp"
                value={draft.telefone}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, telefone: v } : null))}
                icon={<MessageCircle className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="E-mail de Contato"
                value={draft.email}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, email: v } : null))}
                icon={<FileSignature className="h-3 w-3 text-primary/60" />}
              />
            </div>

            {/* Coluna 3: Logística */}
            <div className="space-y-5">
              <HeaderField
                label="Data do Evento"
                type="date"
                value={draft.data}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, data: v } : null))}
                icon={<Calendar className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Horário do Evento"
                value={draft.horario}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, horario: v } : null))}
                icon={<Clock className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Duração (horas)"
                value={draft.duracao ? String(draft.duracao) : ""}
                isEditing={isEditingHeader}
                type="number"
                onChange={(v) =>
                  setDraft((p) => (p ? { ...p, duracao: v ? Number(v) : "" } : null))
                }
                icon={<Clock className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Local do Evento"
                value={draft.local}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, local: v } : null))}
                icon={<MapPin className="h-3 w-3 text-primary/60" />}
              />
            </div>

            {/* Coluna 4: Detalhes */}
            <div className="space-y-5">
              <HeaderField
                label="Cidade"
                value={draft.cidade}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, cidade: v } : null))}
                icon={<MapPin className="h-3 w-3 text-primary/60" />}
              />
              <HeaderField
                label="Convidados"
                type="number"
                value={draft.convidados.toString()}
                isEditing={isEditingHeader}
                onChange={(v) => setDraft((p) => (p ? { ...p, convidados: Number(v) } : null))}
                icon={<Users className="h-3 w-3 text-primary/60" />}
              />
            </div>

            {/* Coluna 5: Origem */}
            <div className="space-y-5 bg-primary/5 p-4 rounded-2xl border border-primary/10">
              <div className="space-y-1">
                <div className="label-eyebrow flex items-center gap-1">
                  <Megaphone className="h-3 w-3 text-primary" /> Canal de Origem
                </div>
                {isEditingHeader ? (
                  <select
                    value={draft.lead_source || ""}
                    onChange={(e) =>
                      setDraft((p) => (p ? { ...p, lead_source: e.target.value } : null))
                    }
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
                  <div className="text-sm font-black text-primary uppercase tracking-tight">
                    {draft.lead_source || "NÃO DEFINIDO"}
                  </div>
                )}
              </div>

              {draft.lead_source === "Indicação" && (
                <div className="animate-in zoom-in-95 duration-300">
                  <HeaderField
                    label="Nome da Indicação"
                    value={draft.referral_name || ""}
                    isEditing={isEditingHeader}
                    onChange={(v) => setDraft((p) => (p ? { ...p, referral_name: v } : null))}
                    icon={<UserPlus className="h-3 w-3 text-primary/60" />}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border/50">
            <div className="label-eyebrow flex items-center gap-2 mb-3 text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Observações Gerais do Evento
            </div>
            {isEditingHeader ? (
              <textarea
                value={draft.observacoes || ""}
                onChange={(e) =>
                  setDraft((p) => (p ? { ...p, observacoes: e.target.value } : null))
                }
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
            { id: "Visão Geral", icon: <Calendar className="h-4 w-4" /> },
            { id: "Orçamento", icon: <Save className="h-4 w-4" /> },
            { id: "Contatos & Negociação", icon: <MessageCircle className="h-4 w-4" /> },
            { id: "Contrato", icon: <FileSignature className="h-4 w-4" /> },
            { id: "Compras e Notinhas", icon: <FileTextIcon className="h-4 w-4" /> },
            { id: "Insumos Levados", icon: <Download className="h-4 w-4" /> },
            { id: "Fechamento do Evento", icon: <CheckCircle2 className="h-4 w-4" /> },
            { id: "Histórico & Versões", icon: <History className="h-4 w-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === t.id
                  ? "border-primary text-foreground bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-surface"
              }`}
            >
              {t.icon}
              {t.id}
            </button>
          ))}
        </div>

        {activeTab === "Visão Geral" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-300">
            <SectionCard title="Status do Evento">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <strong>{evento?.status || "—"}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Data</span>
                  <strong>{draft?.data || "—"}</strong>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Indicador Financeiro">
              <div className="text-sm">
                {(evento as any)?.status === "Fechado" ? (
                  <p>Margem Real disponível após fechamento do evento.</p>
                ) : (
                  <p>Margem Prevista baseada no orçamento atual.</p>
                )}
              </div>
            </SectionCard>
            <SectionCard title="Atalho">
              <p className="text-sm text-muted-foreground">
                Use as abas abaixo para compras, insumos e fechamento operacional.
              </p>
            </SectionCard>
          </div>
        )}

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
                      <input
                        type="number"
                        value={draft.drinksPorPessoa || ""}
                        onChange={(e) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  drinksPorPessoa:
                                    e.target.value === "" ? 0 : Number(e.target.value),
                                }
                              : null,
                          )
                        }
                        className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="label-eyebrow block mb-2">
                        {ADDITIONAL_COST_LABEL} (%)
                      </label>
                      <input
                        type="number"
                        value={draft.markupAdicionalDrinks || ""}
                        onChange={(e) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  markupAdicionalDrinks:
                                    e.target.value === "" ? 0 : Number(e.target.value),
                                }
                              : null,
                          )
                        }
                        className="w-full h-10 px-4 rounded-lg bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar drink pelo nome..."
                        value={buscaDrink}
                        onChange={(e) => setBuscaDrink(e.target.value)}
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-input border border-border focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[450px] overflow-y-auto p-2 scrollbar-thin">
                      {allDrinks
                        .filter((d) => d.nome.toLowerCase().includes(buscaDrink.toLowerCase()))
                        .sort((a, b) => a.nome.localeCompare(b.nome))
                        .map((d) => (
                          <div
                            key={d.id}
                            onClick={() => toggleDrink(d.id)}
                            className={`relative overflow-hidden rounded-xl border-2 transition-all cursor-pointer group flex flex-col ${draft.drinks.includes(d.id) ? "border-primary bg-primary/5 shadow-md scale-[0.98]" : "border-border bg-surface hover:border-primary/40 hover:scale-[1.02]"}`}
                          >
                            <div className="h-24 overflow-hidden relative">
                              <DrinkImage
                                src={d.imagem}
                                alt={d.nome}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                              {draft.drinks.includes(d.id) && (
                                <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center text-white shadow-lg">
                                  <Check className="h-3 w-3 stroke-[4px]" />
                                </div>
                              )}
                            </div>
                            <div className="p-3 space-y-1">
                              <div
                                className={`font-bold text-[11px] uppercase tracking-tighter truncate ${draft.drinks.includes(d.id) ? "text-primary" : "text-foreground"}`}
                              >
                                {d.nome}
                              </div>
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-muted-foreground">
                                  Custo:{" "}
                                  <span className="font-bold text-foreground">
                                    {fmtBRL(d.custoUnitario)}
                                  </span>
                                </span>
                              </div>
                              <div className="text-[9px] font-bold text-primary/80">
                                Sugerido: {fmtBRL(d.modalityConfig?.steakhouse?.price || 0)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-2 mt-6 border-t border-border/40 pt-6">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Bebidas
                    </label>
                    <textarea
                      aria-label="Bebidas"
                      placeholder={"Uma bebida por linha (ex: Água\nRefrigerante)"}
                      value={draft.bebidasInput}
                      onChange={(e) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                bebidasInput: preserveBeveragesInput(e.target.value),
                              }
                            : null,
                        )
                      }
                      className="w-full h-24 p-3 rounded-xl bg-input border border-border text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Itens deste orçamento; separados dos coquetéis selecionados acima.
                    </p>
                  </div>

                  <div className="space-y-2 mt-6 border-t border-border/40 pt-6">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 bg-primary rounded-full" /> Descrição das Bebidas
                      Negociadas (Opcional)
                    </label>
                    <textarea
                      placeholder="Descreva detalhes das marcas e bebidas negociadas para este orçamento (ex: Vodka Absolut, Gin Tanqueray, Tônica Antarctica, etc...)"
                      value={draft.descricaoBebidas || ""}
                      onChange={(e) =>
                        setDraft((p) => (p ? { ...p, descricaoBebidas: e.target.value } : null))
                      }
                      className="w-full h-24 p-3 rounded-xl bg-input border border-border text-xs font-medium focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none placeholder:text-muted-foreground/60"
                    />
                  </div>

                  <div className="p-5 rounded-xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 shadow-inner gap-4">
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        Análise de Insumos / Custo
                      </div>
                      <div className="text-sm">
                        Média Unitária Insumos:{" "}
                        <span className="font-bold">{fmtBRL(calc.mediaCustoDrinks)}</span>
                      </div>
                      <div className="text-sm">
                        Soma Insumos (1 de cada):{" "}
                        <span className="font-bold">{fmtBRL(calc.custoBaseDrinks)}</span>
                      </div>
                      {draft.drinks.length > 0 && (
                        <div className="mt-4 text-xs text-muted-foreground w-full">
                          <div className="font-bold mb-3 uppercase tracking-widest text-primary text-[10px]">
                            Detalhamento por Insumo:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {draft.drinks.map((dId) => {
                              const drink = allDrinks.find((d) => d.id === dId);
                              if (!drink) return null;
                              return (
                                <div
                                  key={dId}
                                  className="bg-surface border border-border p-3 rounded-lg shadow-sm"
                                >
                                  <div className="font-bold text-foreground mb-1.5">
                                    {drink.nome}
                                  </div>
                                  <ul className="space-y-0.5 mb-2">
                                    {drink.insumos?.map((i, idx) => (
                                      <li
                                        key={idx}
                                        className="flex justify-between text-muted-foreground"
                                      >
                                        <span>{i.nome}</span>
                                        <span>{fmtBRL(i.custo)}</span>
                                      </li>
                                    ))}
                                    {(!drink.insumos || drink.insumos.length === 0) && (
                                      <li className="italic text-muted-foreground/50">
                                        Insumos não detalhados
                                      </li>
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
                      <div className="font-display text-2xl font-bold text-primary">
                        {fmtBRL(calc.valorDrinksEvento)}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="2. Welcome Drinks & Rodada de Shots"
                subtitle="Adicionais com valores congelados nesta versão"
              >
                <div className="space-y-6">
                  <div className="space-y-4 rounded-xl border border-border p-4">
                    <label className="flex items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        checked={draft.hasWelcomeDrinks}
                        onChange={(e) =>
                          setDraft((p) => (p ? { ...p, hasWelcomeDrinks: e.target.checked } : null))
                        }
                      />{" "}
                      Welcome Drinks
                    </label>
                    {draft.hasWelcomeDrinks && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="text-xs">
                            Drinks por pessoa
                            <input
                              min="0"
                              type="number"
                              value={draft.welcomeDrinksPerPerson || ""}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        welcomeDrinksPerPerson: Math.max(
                                          0,
                                          Number(e.target.value) || 0,
                                        ),
                                      }
                                    : null,
                                )
                              }
                              className="mt-1 w-full h-10 px-3 rounded-lg bg-input border border-border"
                            />
                          </label>
                          <label className="text-xs">
                            Lucro (%)
                            <input
                              min="0"
                              type="number"
                              value={draft.welcomeDrinksProfitPercentage || ""}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        welcomeDrinksProfitPercentage: Math.max(
                                          0,
                                          Number(e.target.value) || 0,
                                        ),
                                      }
                                    : null,
                                )
                              }
                              className="mt-1 w-full h-10 px-3 rounded-lg bg-input border border-border"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {allDrinks.map((drink) => {
                            const selected = draft.welcomeDrinksSelected.some(
                              (item) => item.drinkId === drink.id,
                            );
                            return (
                              <button
                                type="button"
                                key={drink.id}
                                onClick={() =>
                                  setDraft((p) =>
                                    p
                                      ? {
                                          ...p,
                                          welcomeDrinksSelected: selected
                                            ? p.welcomeDrinksSelected.filter(
                                                (item) => item.drinkId !== drink.id,
                                              )
                                            : [
                                                ...p.welcomeDrinksSelected,
                                                {
                                                  drinkId: drink.id,
                                                  nameSnapshot: drink.nome,
                                                  unitCostSnapshot: Math.max(
                                                    0,
                                                    Number(drink.custoUnitario) || 0,
                                                  ),
                                                },
                                              ],
                                        }
                                      : null,
                                  )
                                }
                                className={`text-left p-2 rounded-lg border text-xs ${selected ? "border-primary bg-primary/10" : "border-border"}`}
                              >
                                <strong>{drink.nome}</strong>
                                <br />
                                {fmtBRL(drink.custoUnitario)}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Custo: {fmtBRL(calc.welcomeDrinks.custoTotal)}</span>
                          <strong>Valor final: {fmtBRL(calc.welcomeDrinks.valorFinal)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <label className="flex items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        checked={draft.hasShots}
                        onChange={(e) =>
                          setDraft((p) => (p ? { ...p, hasShots: e.target.checked } : null))
                        }
                      />{" "}
                      Rodada de Shots
                    </label>
                    {draft.hasShots && (
                      <>
                        {draft.shotsItems.map((item, index) => (
                          <div key={item.id} className="grid grid-cols-[1fr_75px_105px_36px] gap-2">
                            <input
                              aria-label="Nome do shot"
                              value={item.nome}
                              placeholder="Produto"
                              onChange={(e) =>
                                setDraft((p) => {
                                  if (!p) return null;
                                  const shotsItems = [...p.shotsItems];
                                  shotsItems[index] = { ...item, nome: e.target.value };
                                  return { ...p, shotsItems };
                                })
                              }
                              className="h-9 px-2 rounded bg-input border border-border"
                            />
                            <input
                              aria-label="Quantidade"
                              min="0"
                              type="number"
                              value={item.quantidade || ""}
                              onChange={(e) =>
                                setDraft((p) => {
                                  if (!p) return null;
                                  const shotsItems = [...p.shotsItems];
                                  shotsItems[index] = {
                                    ...item,
                                    quantidade: Math.max(0, Number(e.target.value) || 0),
                                  };
                                  return { ...p, shotsItems };
                                })
                              }
                              className="h-9 px-2 rounded bg-input border border-border"
                            />
                            <input
                              aria-label="Valor unitário"
                              min="0"
                              type="number"
                              value={item.valorUnitario || ""}
                              onChange={(e) =>
                                setDraft((p) => {
                                  if (!p) return null;
                                  const shotsItems = [...p.shotsItems];
                                  shotsItems[index] = {
                                    ...item,
                                    valorUnitario: Math.max(0, Number(e.target.value) || 0),
                                  };
                                  return { ...p, shotsItems };
                                })
                              }
                              className="h-9 px-2 rounded bg-input border border-border"
                            />
                            <button
                              aria-label="Remover shot"
                              onClick={() =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        shotsItems: p.shotsItems.filter(
                                          (shot) => shot.id !== item.id,
                                        ),
                                      }
                                    : null,
                                )
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <span className="col-span-4 text-right text-xs">
                              Subtotal:{" "}
                              {fmtBRL(
                                Math.max(0, item.quantidade) * Math.max(0, item.valorUnitario),
                              )}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between">
                          <GhostButton
                            onClick={() =>
                              setDraft((p) =>
                                p
                                  ? {
                                      ...p,
                                      shotsItems: [
                                        ...p.shotsItems,
                                        {
                                          id: crypto.randomUUID(),
                                          nome: "",
                                          quantidade: 0,
                                          valorUnitario: 0,
                                        },
                                      ],
                                    }
                                  : null,
                              )
                            }
                          >
                            <Plus className="h-3 w-3" /> Adicionar shot
                          </GhostButton>
                          <strong>Total: {fmtBRL(calcularTotalShots(draft.shotsItems))}</strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="2. Equipe">
                  <div className="space-y-4">
                    {Object.entries(draft.equipe).map(([key, prof]) => (
                      <div
                        key={key}
                        className="flex gap-3 items-end p-3 rounded-lg bg-surface border border-border/50"
                      >
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                            {key}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={prof.qtd || ""}
                              onChange={(e) =>
                                setDraft((p) =>
                                  p
                                    ? {
                                        ...p,
                                        equipe: {
                                          ...p.equipe,
                                          [key]: {
                                            ...prof,
                                            qtd: e.target.value === "" ? 0 : Number(e.target.value),
                                          },
                                        },
                                      }
                                    : null,
                                )
                              }
                              className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold"
                            />
                            <span className="text-xs text-muted-foreground">und</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                            Valor (R$)
                          </label>
                          <input
                            type="number"
                            value={prof.valorUnitario || ""}
                            onChange={(e) =>
                              setDraft((p) =>
                                p
                                  ? {
                                      ...p,
                                      equipe: {
                                        ...p.equipe,
                                        [key]: {
                                          ...prof,
                                          valorUnitario:
                                            e.target.value === "" ? 0 : Number(e.target.value),
                                        },
                                      },
                                    }
                                  : null,
                              )
                            }
                            className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm"
                          />
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
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-3">
                        Gelo (Pacotes 5kg)
                      </label>
                      <div className="flex gap-3 items-center">
                        <div className="flex-1">
                          <input
                            type="number"
                            placeholder={`Sugestão: ${Math.ceil((draft.convidados / 100) * 35)}`}
                            value={draft.gelo.pacotesOverride || ""}
                            onChange={(e) =>
                              setDraft((p) =>
                                p
                                  ? {
                                      ...p,
                                      gelo: {
                                        ...p.gelo,
                                        pacotesOverride: e.target.value
                                          ? Number(e.target.value)
                                          : undefined,
                                      },
                                    }
                                  : null,
                              )
                            }
                            className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold"
                          />
                        </div>
                        <span className="text-muted-foreground text-sm">x</span>
                        <div className="flex-1">
                          <input
                            type="number"
                            value={draft.gelo.valorUnitario || ""}
                            onChange={(e) =>
                              setDraft((p) =>
                                p
                                  ? {
                                      ...p,
                                      gelo: {
                                        ...p.gelo,
                                        valorUnitario:
                                          e.target.value === "" ? 0 : Number(e.target.value),
                                      },
                                    }
                                  : null,
                              )
                            }
                            className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-muted-foreground italic">
                        * Estimativa de 35 pacotes a cada 100 convidados
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
                      <label className="flex items-center gap-3 text-sm font-bold cursor-pointer group">
                        <div
                          className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${draft.viagem.incluir ? "bg-primary border-primary text-white" : "border-border group-hover:border-primary"}`}
                        >
                          {draft.viagem.incluir && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={draft.viagem.incluir}
                          onChange={(e) =>
                            setDraft((p) =>
                              p
                                ? { ...p, viagem: { ...p.viagem, incluir: e.target.checked } }
                                : null,
                            )
                          }
                        />
                        Taxa de Deslocamento / Gasolina
                      </label>
                      {draft.viagem.incluir && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <input
                            type="number"
                            value={draft.viagem.valor || ""}
                            onChange={(e) =>
                              setDraft((p) =>
                                p
                                  ? {
                                      ...p,
                                      viagem: {
                                        ...p.viagem,
                                        valor: e.target.value === "" ? 0 : Number(e.target.value),
                                      },
                                    }
                                  : null,
                              )
                            }
                            className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm"
                            placeholder="Valor total (R$)"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-right font-display text-lg text-primary border-t border-border/50">
                      Subtotal:{" "}
                      <span className="font-bold">
                        {fmtBRL(calc.valorGelo + calc.valorGasolina)}
                      </span>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard
                  title="4. Gastos Diversos"
                  subtitle="Itens extras, flores, canudos, etc"
                >
                  <div className="space-y-3">
                    {draft.gastosDiversos.length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground text-xs uppercase tracking-widest">
                        Nenhum item extra
                      </div>
                    )}
                    {draft.gastosDiversos.map((g, i) => (
                      <div
                        key={g.id}
                        className="flex gap-2 group animate-in zoom-in-95 duration-200"
                      >
                        <input
                          type="text"
                          value={g.descricao}
                          onChange={(e) => {
                            const arr = [...draft.gastosDiversos];
                            arr[i].descricao = e.target.value;
                            setDraft((p) => (p ? { ...p, gastosDiversos: arr } : null));
                          }}
                          className="flex-1 h-10 px-4 rounded-lg bg-input border border-border text-sm focus:border-primary outline-none transition-all"
                          placeholder="Descrição do item"
                        />
                        <input
                          type="number"
                          value={g.valor || ""}
                          onChange={(e) => {
                            const arr = [...draft.gastosDiversos];
                            arr[i].valor = e.target.value === "" ? 0 : Number(e.target.value);
                            setDraft((p) => (p ? { ...p, gastosDiversos: arr } : null));
                          }}
                          className="w-24 h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold text-primary"
                        />
                        <button
                          onClick={() => {
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    gastosDiversos: p.gastosDiversos.filter((x) => x.id !== g.id),
                                  }
                                : null,
                            );
                          }}
                          className="h-10 w-10 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-40 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <GhostButton
                      onClick={() =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                gastosDiversos: [
                                  ...p.gastosDiversos,
                                  { id: `g${Date.now()}`, descricao: "", valor: 0 },
                                ],
                              }
                            : null,
                        )
                      }
                      className="w-full text-xs font-bold py-3 mt-2 border-dashed border-2"
                    >
                      <Plus className="h-3 w-3" /> ADICIONAR ITEM EXTRA
                    </GhostButton>
                  </div>
                </SectionCard>

                <SectionCard title="5. Descontos & Gestão" subtitle="Ajustes finos no valor final">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      {(draft.descontos || []).map((d, i) => (
                        <div
                          key={`desconto-${i}`}
                          className="p-4 rounded-xl border border-border bg-surface/30 space-y-3 relative group"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Valor do Desconto (R$)
                              </label>
                              <input
                                type="number"
                                value={d.valor || ""}
                                onChange={(e) =>
                                  setDraft((p) => {
                                    if (!p) return null;
                                    const descontos = [...(p.descontos || [])];
                                    descontos[i] = {
                                      ...descontos[i],
                                      valor: e.target.value === "" ? 0 : Number(e.target.value),
                                    };
                                    return { ...p, descontos };
                                  })
                                }
                                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm font-bold text-destructive"
                                placeholder="0,00"
                              />
                            </div>
                            <div className="relative pr-10">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                Motivo do Desconto
                              </label>
                              <input
                                type="text"
                                value={d.motivo || ""}
                                onChange={(e) =>
                                  setDraft((p) => {
                                    if (!p) return null;
                                    const descontos = [...(p.descontos || [])];
                                    descontos[i] = { ...descontos[i], motivo: e.target.value };
                                    return { ...p, descontos };
                                  })
                                }
                                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm"
                                placeholder="Ex: Parceria / Cortesia"
                              />
                              <button
                                onClick={() =>
                                  setDraft((p) =>
                                    p
                                      ? {
                                          ...p,
                                          descontos: (p.descontos || []).filter(
                                            (_, idx) => idx !== i,
                                          ),
                                        }
                                      : null,
                                  )
                                }
                                className="absolute right-0 bottom-0 h-10 w-10 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none font-medium hover:text-foreground transition-colors pt-1">
                            <input
                              type="checkbox"
                              checked={!!d.deduzirCustoDrinks}
                              onChange={(e) =>
                                setDraft((p) => {
                                  if (!p) return null;
                                  const descontos = [...(p.descontos || [])];
                                  descontos[i] = {
                                    ...descontos[i],
                                    deduzirCustoDrinks: e.target.checked,
                                  };
                                  return { ...p, descontos };
                                })
                              }
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                            />
                            <span>Deduzir do custo de drinks (Cliente fornece as bebidas)</span>
                          </label>
                        </div>
                      ))}
                      <GhostButton
                        onClick={() =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  descontos: [
                                    ...(p.descontos || []),
                                    { valor: 0, motivo: "", deduzirCustoDrinks: false },
                                  ],
                                }
                              : null,
                          )
                        }
                        className="w-full text-xs font-bold py-3 border-dashed border-2"
                      >
                        <Plus className="h-3 w-3" /> ADICIONAR DESCONTO
                      </GhostButton>
                    </div>

                    <div className="p-5 rounded-2xl bg-primary/10 border-2 border-primary/20 shadow-lg shadow-primary/5">
                      <label className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-3 text-center">
                        Lucro Líquido Desejado
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-display text-primary">R$</span>
                        <input
                          type="number"
                          value={draft.lucroDesejado || ""}
                          onChange={(e) =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    lucroDesejado:
                                      e.target.value === "" ? 0 : Number(e.target.value),
                                  }
                                : null,
                            )
                          }
                          className="w-full h-14 text-3xl font-display font-bold bg-transparent border-0 focus:ring-0 text-primary placeholder:text-primary/20"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>

            {/* Direita: Resumo */}
            <div className="xl:col-span-4">
              <div className="sticky top-6 space-y-6">
                <SectionCard
                  title="Detalhamento da Proposta"
                  className="border-primary/30 shadow-2xl shadow-primary/10 bg-surface/80 backdrop-blur-sm"
                >
                  <div className="space-y-6 text-xs">
                    {/* DRINKS section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> DRINKS SELECIONADOS:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight text-xs">
                        {draft.drinks.length === 0 && (
                          <div className="italic">Nenhum drink selecionado</div>
                        )}
                        {draft.drinks
                          .filter((dId) => allDrinks.some((d) => d.id === dId))
                          .sort((a, b) => {
                            const drinkA = allDrinks.find((d) => d.id === a);
                            const drinkB = allDrinks.find((d) => d.id === b);
                            return (drinkA?.nome || "").localeCompare(drinkB?.nome || "");
                          })
                          .map((dId) => {
                            const drink = allDrinks.find((d) => d.id === dId);
                            return (
                              <div key={dId} className="flex justify-between">
                                <span>- {drink?.nome}</span>
                              </div>
                            );
                          })}
                      </div>
                      {draft.descricaoBebidas && (
                        <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs normal-case text-foreground whitespace-pre-wrap font-medium">
                          <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                            Bebidas Negociadas:
                          </div>
                          {draft.descricaoBebidas}
                        </div>
                      )}
                      <div className="pt-2 flex justify-between font-bold border-t border-border/40">
                        <span>VALOR TOTAL SERVIÇO DE DRINKS</span>
                        <span className="text-foreground">{fmtBRL(calc.valorDrinksEvento)}</span>
                      </div>
                    </div>

                    {draft.hasWelcomeDrinks && (
                      <div className="space-y-1 border-t border-border/40 pt-3 text-xs">
                        <div className="font-bold text-primary uppercase">Welcome Drinks</div>
                        <div className="flex justify-between">
                          <span>Custo</span>
                          <span>{fmtBRL(calc.welcomeDrinks.custoTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lucro</span>
                          <span>{draft.welcomeDrinksProfitPercentage}%</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Valor final</span>
                          <span>{fmtBRL(calc.welcomeDrinks.valorFinal)}</span>
                        </div>
                      </div>
                    )}
                    {draft.hasShots && (
                      <div className="flex justify-between border-t border-border/40 pt-3 text-xs font-bold">
                        <span>RODADA DE SHOTS</span>
                        <span>{fmtBRL(calc.shotsTotal)}</span>
                      </div>
                    )}

                    {/* EQUIPE section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> EQUIPE OPERACIONAL:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight text-xs">
                        {Object.entries(draft.equipe)
                          .filter(([_, p]) => p.qtd > 0)
                          .map(([key, p]) => (
                            <div key={key}>
                              - {p.qtd} {key.toUpperCase()}
                              {p.qtd > 1 && !key.endsWith("s") ? "S" : ""}
                            </div>
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
                        <div>
                          - {calc.pacotesGelo} PACOTES DE GELO ({fmtBRL(calc.valorGelo)})
                        </div>
                        {draft.viagem.incluir && (
                          <div>- TAXA DE DESLOCAMENTO ({fmtBRL(calc.valorGasolina)})</div>
                        )}
                      </div>
                    </div>

                    {/* GASTOS section */}
                    <div className="space-y-2">
                      <div className="font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                        <div className="h-1 w-1 bg-primary rounded-full" /> GASTOS DIVERSOS:
                      </div>
                      <div className="pl-3 space-y-1 text-muted-foreground font-medium uppercase tracking-tight text-xs">
                        {draft.gastosDiversos.length === 0 && (
                          <div className="italic">Nenhum gasto extra</div>
                        )}
                        {draft.gastosDiversos.map((g) => (
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
                        <div className="space-y-2">
                          <div className="flex justify-between text-destructive font-bold">
                            <span>
                              DESCONTOS APLICADOS (
                              {(draft.descontos || []).filter((d) => (Number(d.valor) || 0) > 0)
                                .length || 1}
                              )
                            </span>
                            <span>- {fmtBRL(calc.valorDesconto)}</span>
                          </div>
                          <div className="pl-3 space-y-1 text-[11px] text-destructive/90 font-medium">
                            {(draft.descontos || [])
                              .filter((d) => (Number(d.valor) || 0) > 0)
                              .map((d, idx) => (
                                <div
                                  key={`preview-desconto-${idx}`}
                                  className="flex justify-between gap-3"
                                >
                                  <span>
                                    - {d.motivo?.trim() ? d.motivo : `Desconto ${idx + 1}`}
                                  </span>
                                  <span>{fmtBRL(Number(d.valor) || 0)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between text-success font-bold pt-1 border-t border-primary/20">
                        <span>LUCRO LÍQUIDO FINAL</span>
                        <span>{fmtBRL(calc.lucro)}</span>
                      </div>

                      <div className="bg-primary p-5 rounded-xl text-primary-foreground shadow-lg shadow-primary/20">
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">
                          Valor Final da Proposta
                        </div>
                        <div className="text-3xl font-display font-bold">
                          {fmtBRL(calc.valorTotalOrcamento)}
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-[10px] font-bold opacity-90">
                          <span>{draft.convidados} CONVIDADOS</span>
                          <span className="bg-white/20 px-2 py-0.5 rounded">
                            {fmtBRL(calc.mediaPorPessoa)} / PAX
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                      <GhostButton
                        onClick={() => handleSave(true)}
                        className="h-10 text-[10px] font-bold"
                        disabled={saving}
                      >
                        GERAR NOVA VERSÃO
                      </GhostButton>
                      <PrimaryButton
                        className="h-10 text-[10px] font-bold"
                        onClick={() => handleSave(false)}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {saving ? "SALVANDO..." : "ATUALIZAR ATUAL"}
                      </PrimaryButton>
                    </div>
                  </div>
                </SectionCard>

                {/* GERAR PROPOSTA COMERCIAL BUTTON & LIFECYCLE */}
                {(() => {
                  const isProposalCurrent = Boolean(
                    existingProposal &&
                    currentBudget?.id &&
                    existingProposal.budget_id === currentBudget.id,
                  );
                  const isProposalOutdated = Boolean(
                    existingProposal &&
                    currentBudget?.id &&
                    existingProposal.budget_id !== currentBudget.id,
                  );

                  return (
                    <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/25 rounded-2xl flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileTextIcon className="h-5 w-5 text-primary" />
                          <span className="font-display font-semibold text-sm">
                            Proposta Comercial em PDF
                          </span>
                        </div>
                        {existingProposal && isProposalCurrent && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                            Versão Atual
                          </span>
                        )}
                      </div>

                      {/* Aviso de Proposta Desatualizada */}
                      {isProposalOutdated && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <div className="font-bold">Proposta desatualizada</div>
                            <div className="text-[11px] opacity-90">
                              Esta proposta foi gerada a partir de uma versão anterior do orçamento.
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {!existingProposal
                          ? "Gere e personalize uma proposta comercial em PDF baseada no orçamento atual."
                          : isProposalOutdated
                            ? "Gere uma nova proposta com os dados do orçamento atual ou visualize a versão anterior."
                            : "Proposta pronta para envio. Você pode visualizar, baixar, gerar novamente ou excluir."}
                      </p>

                      <div className="flex gap-2 flex-wrap items-center">
                        {/* Botão de Geração / Regeneração */}
                        <PrimaryButton
                          className="h-10 text-[11px] font-bold flex-1"
                          onClick={handleGenerateProposal}
                          disabled={canvaGeneration.status === "loading" && canvaGeneration.open}
                        >
                          {canvaGeneration.status === "loading" && canvaGeneration.open ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileTextIcon className="h-4 w-4" />
                          )}
                          {!existingProposal
                            ? "GERAR PROPOSTA COMERCIAL"
                            : isProposalOutdated
                              ? "GERAR PROPOSTA ATUALIZADA"
                              : "GERAR NOVAMENTE"}
                        </PrimaryButton>

                        {/* Visualizar / Baixar PDF */}
                        {existingProposal?.final_pdf_url && (
                          <a
                            href={existingProposal.final_pdf_url}
                            download={buildProposalFilename(evento?.event_name)}
                            className="flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold transition-all text-foreground"
                          >
                            <Download className="h-4 w-4" />
                            {isProposalOutdated ? "Ver Anterior" : "Baixar PDF"}
                          </a>
                        )}

                        {/* Botão Excluir */}
                        {existingProposal && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteProposalDialog(true)}
                            className="flex items-center justify-center h-10 px-3 rounded-xl border border-destructive/30 hover:border-destructive hover:bg-destructive/10 text-destructive text-xs font-bold transition-all"
                            title="Excluir proposta comercial"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DA PROPOSTA */}
                <AlertDialog.Root
                  open={showDeleteProposalDialog}
                  onOpenChange={setShowDeleteProposalDialog}
                >
                  <AlertDialog.Portal>
                    <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                    <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95">
                      <AlertDialog.Title className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-destructive" />
                        Excluir Proposta Comercial
                      </AlertDialog.Title>
                      <AlertDialog.Description className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        Esta ação excluirá o PDF gerado desta proposta. O orçamento e o modelo não
                        serão alterados.
                      </AlertDialog.Description>
                      <div className="mt-6 flex justify-end gap-3">
                        <AlertDialog.Cancel asChild>
                          <button
                            type="button"
                            disabled={isDeletingProposal}
                            className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-muted text-muted-foreground transition-all"
                          >
                            Cancelar
                          </button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action asChild>
                          <button
                            type="button"
                            onClick={handleDeleteProposal}
                            disabled={isDeletingProposal}
                            className="px-4 py-2 rounded-xl text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all flex items-center gap-2"
                          >
                            {isDeletingProposal && <Loader2 className="h-4 w-4 animate-spin" />}
                            Excluir Proposta
                          </button>
                        </AlertDialog.Action>
                      </div>
                    </AlertDialog.Content>
                  </AlertDialog.Portal>
                </AlertDialog.Root>

                {/* VERSÕES RÁPIDAS */}
                <SectionCard title="Versões Recentes" className="bg-surface/50 border-dashed">
                  <div className="space-y-3">
                    {budgetVersions.slice(0, 3).map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-3 rounded-xl border ${v.is_current ? "bg-primary/5 border-primary/30" : "bg-background/50 border-border"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center ${v.is_current ? "bg-primary text-white" : "bg-surface text-muted-foreground"}`}
                          >
                            <Clock className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold">
                              V{v.version_number} - {fmtBRL(v.final_budget_value)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(v.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!v.is_current && (
                            <button
                              onClick={() => {
                                const selected = budgetVersions.find((x) => x.id === v.id);
                                if (selected) setDraft(mapBudgetToDraft(evento!, selected));
                              }}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              CARREGAR
                            </button>
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
                    <GhostButton
                      onClick={() => setActiveTab("Histórico & Versões")}
                      className="w-full text-[10px] font-bold mt-2"
                    >
                      VER TODAS AS VERSÕES
                    </GhostButton>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTRATO */}
        {activeTab === "Contrato" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Seletor de Modo de Contrato */}
            <div className="flex gap-2 p-1 bg-surface border border-border/40 rounded-xl max-w-md">
              <button
                type="button"
                onClick={() => setContractMode("system")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  contractMode === "system"
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                }`}
              >
                <FileSignature className="h-3.5 w-3.5" />
                GERAR PELO SISTEMA
              </button>
              <button
                type="button"
                onClick={() => setContractMode("upload")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  contractMode === "upload"
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                UPLOAD MANUAL
              </button>
            </div>

            {contractMode === "system" ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                <div className="lg:col-span-8 space-y-6">
                  {!realClientData ? (
                    <SectionCard
                      title="Coleta de Dados Jurídicos"
                      subtitle="Solicite as informações necessárias para emissão do contrato"
                    >
                      <div className="flex flex-col items-center justify-center p-12 bg-surface border-2 border-dashed border-border rounded-2xl text-center space-y-6">
                        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
                          <LinkIcon className="h-10 w-10" />
                        </div>
                        <div className="max-w-md">
                          <h3 className="font-display font-bold text-xl mb-2">
                            Link Seguro para o Cliente
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            O cliente receberá um formulário web premium para preencher CPF/CNPJ,
                            endereço e dados do representante legal. Isso evita erros de digitação e
                            agiliza o processo.
                          </p>
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
                    <SectionCard
                      title="Dados do Contratante"
                      subtitle={`Validado em ${realClientData.submitted_at || realClientData.created_at ? format(parseISO(realClientData.submitted_at || realClientData.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "---"}`}
                      action={
                        <GhostButton
                          onClick={handleRequestClientData}
                          className="h-8 text-[10px] font-bold"
                        >
                          <LinkIcon className="h-3 w-3" /> GERAR NOVO LINK
                        </GhostButton>
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <DataField label="Razão Social / Nome" value={realClientData.client_name} />
                        <DataField
                          label={getBrazilianDocumentType(realClientData.cpf_cnpj)}
                          value={formatBrazilianDocument(realClientData.cpf_cnpj)}
                        />
                        <DataField label="E-mail de Contato" value={realClientData.email} />
                        <DataField
                          label="Local / Endereço do Evento"
                          value={realClientData.address}
                        />

                        {realClientData.notes && (
                          <div className="md:col-span-2 mt-2 pt-4 border-t border-primary/10">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">
                              Detalhes e Pagamento Informados pelo Cliente
                            </div>
                            <div className="whitespace-pre-wrap text-sm text-foreground/80 font-medium leading-relaxed bg-background p-4 rounded-xl border border-primary/10">
                              {realClientData.notes.replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1")}
                            </div>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  )}

                  {realClientData && !realContract && (
                    <SectionCard
                      title="Configuração da Emissão"
                      className="animate-in slide-in-from-bottom-4 duration-500"
                    >
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              Modelo de Contrato
                            </label>
                            <select
                              value={selectedTemplate || ""}
                              onChange={(e) => setSelectedTemplate(e.target.value)}
                              className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                              <option value="">-- Selecione o template --</option>
                              {realTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              Sócio Assinante (Representante Goat)
                            </label>
                            <select
                              value={selectedSigner}
                              onChange={(e) => setSelectedSigner(e.target.value)}
                              className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                            >
                              <option value="">-- Selecione o responsável --</option>
                              {realSigners
                                .filter((s) => s.is_active)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.role})
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div className="bg-surface p-4 rounded-xl border border-border flex gap-4 items-center">
                          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-bold text-foreground font-display">
                              MODO ESTREITO DE EMISSÃO:
                            </span>{" "}
                            O contrato utilizará rigorosamente a estrutura do modelo selecionado,
                            substituindo apenas os placeholders mapeados com os dados atualizados do
                            evento, contratante e orçamento.
                          </div>
                        </div>

                        <PrimaryButton
                          onClick={handleGenerateContract}
                          className="w-full h-14 text-base font-bold shadow-xl shadow-primary/20"
                        >
                          <FileSignature className="h-5 w-5" /> GERAR DOCUMENTO E ENVIAR P/ REVISÃO
                        </PrimaryButton>
                      </div>
                    </SectionCard>
                  )}

                  {realContract && (
                    <SectionCard
                      title="Contrato Gerado"
                      subtitle={`Status: ${realContract.status.toUpperCase()}`}
                    >
                      <div className="p-6 rounded-2xl bg-surface border-2 border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5 min-w-0 w-full md:w-auto">
                          <div className="h-16 w-16 shrink-0 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30">
                            <FileSignature className="h-8 w-8" />
                          </div>
                          <div className="min-w-0 overflow-hidden">
                            <div
                              className="font-display font-bold text-lg truncate"
                              title={`Contrato Prestação de Serviços - v${realContract.version}`}
                            >
                              Contrato Prestação de Serviços - v{realContract.version}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1 truncate">
                              <Clock className="h-3 w-3 shrink-0" />{" "}
                              <span className="truncate">
                                Gerado em{" "}
                                {new Date(
                                  realContract.generated_at || realContract.created_at,
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 md:gap-3 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                          {realContract.signed_file_url ? (
                            <PrimaryButton
                              onClick={() => window.open(realContract.signed_file_url, "_blank")}
                              className="h-11 px-6 font-bold w-full sm:w-auto flex-1 sm:flex-none justify-center"
                            >
                              ABRIR CONTRATO ASSINADO
                            </PrimaryButton>
                          ) : (
                            <>
                              <GhostButton
                                onClick={handlePreviewGeneratedContract}
                                className="h-11 px-6 font-bold border-2 w-full sm:w-auto flex-1 sm:flex-none justify-center"
                              >
                                VISUALIZAR MINUTA
                              </GhostButton>
                              <PrimaryButton
                                onClick={handlePreviewGeneratedContract}
                                className="h-11 px-6 font-bold w-full sm:w-auto flex-1 sm:flex-none justify-center"
                              >
                                VER / IMPRIMIR PDF
                              </PrimaryButton>
                              {realContract.status === "draft" &&
                                canDeleteOrRegenerateContract(integrationState) && (
                                  <>
                                    <GhostButton
                                      onClick={() => setShowRegenerateContractDialog(true)}
                                      className="h-11 px-4 font-bold border-2 border-warning text-warning hover:bg-warning/10 w-full sm:w-auto flex-1 sm:flex-none justify-center"
                                      disabled={isProcessingContract}
                                      title="Reconstruir contrato com base nos dados atuais"
                                    >
                                      REGENERAR
                                    </GhostButton>
                                    <GhostButton
                                      onClick={() => setShowDeleteContractDialog(true)}
                                      className="h-11 px-4 font-bold border-2 border-destructive text-destructive hover:bg-destructive/10 w-full sm:w-auto flex-1 sm:flex-none justify-center"
                                      disabled={isProcessingContract}
                                      title="Excluir este contrato permanentemente"
                                    >
                                      EXCLUIR
                                    </GhostButton>
                                  </>
                                )}

                              {canCancelContract(integrationState) && (
                                <GhostButton
                                  onClick={() => setShowCancelDialog(true)}
                                  className="h-11 px-4 font-bold border-2 border-destructive text-destructive hover:bg-destructive/10 w-full sm:w-auto flex-1 sm:flex-none justify-center"
                                  title="Cancelar solicitação de assinatura"
                                >
                                  CANCELAR ENVIO
                                </GhostButton>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2 font-bold">
                              <FileSignature className="h-5 w-5 text-primary" />
                              Acompanhamento da assinatura
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Consulte aqui o envio, a entrega do convite e a conclusão do contrato.
                            </p>
                          </div>
                          <GhostButton
                            onClick={refreshSignatureStatus}
                            disabled={isRefreshingSignature}
                            className="h-9 px-4 text-xs font-bold"
                          >
                            <RefreshCw
                              className={`mr-2 h-4 w-4 ${isRefreshingSignature ? "animate-spin" : ""}`}
                            />
                            ATUALIZAR STATUS
                          </GhostButton>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                          {[
                            {
                              label: "Enviado à Assinafy",
                              done: ["active", "completed"].includes(integrationState),
                              detail: providerDetails?.sent_at
                                ? new Date(providerDetails.sent_at).toLocaleString("pt-BR")
                                : integrationState === "sending"
                                  ? "Envio em andamento"
                                  : "Ainda não enviado",
                            },
                            {
                              label: "Convite por e-mail",
                              done: providerDetails?.signers?.some(
                                (s: any) => s.notification_status === "sent",
                              ),
                              detail:
                                providerDetails?.signers?.[0]?.email ||
                                realClientData?.email ||
                                "E-mail não informado",
                            },
                            {
                              label: "Contrato assinado",
                              done: integrationState === "completed",
                              detail:
                                integrationState === "completed"
                                  ? "Assinatura concluída"
                                  : "Aguardando assinatura",
                            },
                          ].map((step) => (
                            <div
                              key={step.label}
                              className="rounded-xl border border-border/70 bg-background/40 p-4"
                            >
                              <div className="flex items-center gap-2 text-sm font-bold">
                                {step.done ? (
                                  <CheckCircle2 className="h-5 w-5 text-success" />
                                ) : (
                                  <Clock className="h-5 w-5 text-muted-foreground" />
                                )}
                                {step.label}
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">{step.detail}</p>
                            </div>
                          ))}
                        </div>

                        {providerDetails?.signature_url && integrationState === "active" && (
                          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs">
                              O link abaixo pode ser enviado manualmente ao contratante caso o
                              e-mail não chegue.
                            </p>
                            <GhostButton
                              onClick={() => window.open(providerDetails.signature_url, "_blank")}
                              className="h-9 shrink-0 px-4 text-xs font-bold"
                            >
                              <LinkIcon className="mr-2 h-4 w-4" /> ABRIR LINK DE ASSINATURA
                            </GhostButton>
                          </div>
                        )}
                      </div>

                      {integrationState === "send_failed" && (
                        <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <strong>O envio para assinatura falhou.</strong>
                            <p className="mt-1 opacity-90 text-xs">
                              Você pode tentar enviar novamente ou regenerar o contrato caso os
                              dados precisem ser corrigidos.
                              {providerDetails?.last_error && (
                                <span className="block mt-1 font-mono text-[10px]">
                                  {providerDetails.last_error}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {integrationState === "reconciliation_required" && (
                        <div className="mt-4 p-4 rounded-xl bg-warning/10 border border-warning/20 text-warning-foreground text-sm flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <strong>Verificação de estado necessária.</strong>
                            <p className="mt-1 opacity-90 text-xs">
                              O sistema está verificando o estado da assinatura no provedor, ou
                              ocorreu um timeout. Caso demore muito, contate o suporte.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Modal de Regeneração Nativo Radix */}
                      <AlertDialog.Root
                        open={showRegenerateContractDialog}
                        onOpenChange={setShowRegenerateContractDialog}
                      >
                        <AlertDialog.Portal>
                          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95">
                            <AlertDialog.Title className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                              <RefreshCw className="h-6 w-6 text-warning" />
                              Regenerar Contrato?
                            </AlertDialog.Title>
                            <AlertDialog.Description className="mt-3 text-sm text-muted-foreground">
                              A regeneração substituirá o contrato atual pelos dados e serviços
                              atualizados do evento. Você deseja prosseguir?
                            </AlertDialog.Description>
                            <div className="mt-6 flex justify-end gap-3">
                              <AlertDialog.Cancel asChild>
                                <GhostButton disabled={isProcessingContract} className="h-10">
                                  Voltar
                                </GhostButton>
                              </AlertDialog.Cancel>
                              <AlertDialog.Action asChild>
                                <PrimaryButton
                                  onClick={(e: any) => {
                                    e.preventDefault();
                                    setShowRegenerateContractDialog(false);
                                    handleRegenerateContract();
                                  }}
                                  disabled={isProcessingContract}
                                  className="h-10 bg-warning text-warning-foreground hover:bg-warning/90"
                                >
                                  {isProcessingContract ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aguarde...
                                    </>
                                  ) : (
                                    "Sim, Regenerar"
                                  )}
                                </PrimaryButton>
                              </AlertDialog.Action>
                            </div>
                          </AlertDialog.Content>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>

                      {/* Modal de Exclusão Nativo Radix */}
                      <AlertDialog.Root
                        open={showDeleteContractDialog}
                        onOpenChange={setShowDeleteContractDialog}
                      >
                        <AlertDialog.Portal>
                          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95">
                            <AlertDialog.Title className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                              <AlertCircle className="h-6 w-6 text-destructive" />
                              Excluir Contrato?
                            </AlertDialog.Title>
                            <AlertDialog.Description className="mt-3 text-sm text-muted-foreground">
                              Tem certeza que deseja excluir o contrato atual? Esta ação não pode
                              ser desfeita.
                            </AlertDialog.Description>
                            <div className="mt-6 flex justify-end gap-3">
                              <AlertDialog.Cancel asChild>
                                <GhostButton disabled={isProcessingContract} className="h-10">
                                  Voltar
                                </GhostButton>
                              </AlertDialog.Cancel>
                              <AlertDialog.Action asChild>
                                <PrimaryButton
                                  onClick={(e: any) => {
                                    e.preventDefault();
                                    setShowDeleteContractDialog(false);
                                    handleDeleteContract();
                                  }}
                                  disabled={isProcessingContract}
                                  className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isProcessingContract ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aguarde...
                                    </>
                                  ) : (
                                    "Sim, Excluir"
                                  )}
                                </PrimaryButton>
                              </AlertDialog.Action>
                            </div>
                          </AlertDialog.Content>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>

                      {/* Modal de Cancelamento Nativo Radix */}
                      <AlertDialog.Root open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                        <AlertDialog.Portal>
                          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border p-6 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95">
                            <AlertDialog.Title className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                              <AlertCircle className="h-6 w-6 text-destructive" />
                              Cancelar Assinatura?
                            </AlertDialog.Title>
                            <AlertDialog.Description className="mt-3 text-sm text-muted-foreground">
                              O envio para assinatura será <strong>cancelado e deletado</strong> no
                              provedor (Assinafy). Os links enviados anteriormente deixarão de ser
                              válidos. Depois disso, você poderá alterar o contrato e enviar
                              novamente.
                            </AlertDialog.Description>
                            <div className="mt-6 flex justify-end gap-3">
                              <AlertDialog.Cancel asChild>
                                <GhostButton disabled={isCanceling} className="h-10">
                                  Voltar
                                </GhostButton>
                              </AlertDialog.Cancel>
                              <AlertDialog.Action asChild>
                                <PrimaryButton
                                  onClick={(e: any) => {
                                    e.preventDefault();
                                    handleCancelSignature();
                                  }}
                                  disabled={isCanceling}
                                  className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {isCanceling ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                                      Cancelando...
                                    </>
                                  ) : (
                                    "Sim, Cancelar Envio"
                                  )}
                                </PrimaryButton>
                              </AlertDialog.Action>
                            </div>
                          </AlertDialog.Content>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                    </SectionCard>
                  )}
                </div>

                <div className="lg:col-span-4">
                  <SectionCard title="Workflow Jurídico" className="sticky top-6">
                    <div className="space-y-6 py-4">
                      <StatusStep done={!!realClientData} title="Coleta de dados concluída" />
                      <StatusStep done={!!realContract} title="Documento base gerado" />
                      <StatusStep
                        done={
                          realContract?.status === "sent" ||
                          realContract?.status === "partially_signed" ||
                          realContract?.status === "signed"
                        }
                        title="Disparo de e-mails realizado"
                      />
                      <StatusStep
                        done={realContract?.status === "signed"}
                        title="Assinatura das partes colhida"
                      />
                    </div>
                  </SectionCard>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                <div className="lg:col-span-8 space-y-6">
                  {realContract?.signed_file_url ? (
                    <SectionCard
                      title="Contrato Assinado (Upload Manual)"
                      subtitle="O arquivo do contrato assinado está anexado a este evento."
                    >
                      <div className="p-6 rounded-2xl bg-success/5 border-2 border-success/20 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="h-16 w-16 bg-success text-white rounded-2xl flex items-center justify-center shadow-xl shadow-success/20">
                            <CheckCircle2 className="h-8 w-8" />
                          </div>
                          <div>
                            <div className="font-display font-bold text-lg">Contrato Assinado</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3" /> Atualizado em{" "}
                              {new Date(
                                realContract.fully_signed_at ||
                                  realContract.updated_at ||
                                  realContract.created_at,
                              ).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-3 shrink-0">
                          <PrimaryButton
                            onClick={() => window.open(realContract.signed_file_url, "_blank")}
                            className="h-11 px-6 font-bold"
                          >
                            ABRIR CONTRATO ASSINADO
                          </PrimaryButton>
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-border/40">
                        <h4 className="text-sm font-bold mb-4">Substituir Contrato Assinado</h4>
                        <div className="flex items-center gap-4">
                          <label className="h-11 px-6 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl flex items-center justify-center gap-2 text-xs font-bold cursor-pointer transition-all">
                            <Upload className="h-4 w-4" />
                            {uploadingContract ? "ENVIANDO..." : "FAZER UPLOAD DE NOVO ARQUIVO"}
                            <input
                              type="file"
                              accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="hidden"
                              disabled={uploadingContract}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleManualContractUpload(file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </SectionCard>
                  ) : (
                    <SectionCard
                      title="Upload do Contrato Assinado"
                      subtitle="Faça o upload do contrato assinado pelo cliente (PDF ou Imagem) para formalizar o evento."
                    >
                      <div className="flex flex-col items-center justify-center p-12 bg-surface border-2 border-dashed border-border rounded-2xl text-center space-y-6">
                        <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-inner">
                          <Upload className="h-10 w-10 animate-bounce" />
                        </div>
                        <div className="max-w-md">
                          <h3 className="font-display font-bold text-xl mb-2">
                            Selecione o Contrato Assinado
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Formatos suportados: PDF, JPG, PNG, DOCX. O arquivo será armazenado com
                            segurança no storage do Supabase e o status do evento mudará para
                            "CONFIRMADO".
                          </p>
                        </div>

                        <label className="h-12 px-8 bg-primary text-white hover:bg-primary/90 rounded-xl flex items-center justify-center gap-2 text-sm font-bold cursor-pointer transition-all shadow-lg shadow-primary/20">
                          <Upload className="h-4 w-4" />
                          {uploadingContract ? "ENVIANDO..." : "SELECIONAR ARQUIVO"}
                          <input
                            type="file"
                            accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            className="hidden"
                            disabled={uploadingContract}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleManualContractUpload(file);
                            }}
                          />
                        </label>
                      </div>
                    </SectionCard>
                  )}
                </div>

                <div className="lg:col-span-4">
                  <SectionCard title="Workflow Jurídico (Manual)" className="sticky top-6">
                    <div className="space-y-6 py-4">
                      <StatusStep done={true} title="Upload de contrato assinado pendente" />
                      <StatusStep
                        done={!!realContract?.signed_file_url}
                        title="Contrato formalizado"
                      />
                      <div className="pt-4 border-t border-border/40 text-[10px] text-muted-foreground leading-relaxed">
                        Ao realizar o upload manual do contrato assinado, o status do evento é
                        automaticamente alterado para <b>Confirmado</b> e a proposta de orçamento é
                        travada para alterações futuras.
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTATOS & NEGOCIAÇÃO */}
        {activeTab === "Contatos & Negociação" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 animate-in fade-in duration-500">
            <div className="xl:col-span-5 space-y-6">
              <SectionCard
                title="Controle Financeiro"
                subtitle="As informações de pagamento em negociação e pagamento só serão realizadas após a confirmação do evento."
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Condição de Pagamento
                    </label>
                    <input
                      type="text"
                      value={draft.pagamento.formaPagamento}
                      onChange={(e) =>
                        setDraft((p) =>
                          p
                            ? {
                                ...p,
                                pagamento: { ...p.pagamento, formaPagamento: e.target.value },
                              }
                            : null,
                        )
                      }
                      className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium"
                      placeholder="Ex: 50% Sinal / 50% na semana do evento"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Sinal Recebido (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          max={100}
                          min={0}
                          value={draft.pagamento.percentualPago}
                          onChange={(e) =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    pagamento: {
                                      ...p.pagamento,
                                      percentualPago: Number(e.target.value),
                                    },
                                  }
                                : null,
                            )
                          }
                          className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-bold text-primary"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-primary opacity-50">
                          %
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Data Limite Quitação
                      </label>
                      <input
                        type="date"
                        value={draft.pagamento.dataPagamento || ""}
                        onChange={(e) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  pagamento: { ...p.pagamento, dataPagamento: e.target.value },
                                }
                              : null,
                          )
                        }
                        className="w-full h-12 px-4 rounded-xl bg-input border border-border text-sm font-medium"
                      />
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
                        <span className="text-muted-foreground uppercase tracking-widest">
                          Total do Contrato
                        </span>
                        <span>{fmtBRL(calc.valorTotalOrcamento)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-primary uppercase tracking-widest text-[10px]">
                          Já Recebido (Sinal)
                        </span>
                        <span className="text-primary">{fmtBRL(calc.valorPago)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-muted-foreground uppercase tracking-widest text-[10px]">
                          Saldo Pendente ({calc.percPendente}%)
                        </span>
                        <span className="text-destructive">{fmtBRL(calc.valorPendente)}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-primary/5 text-[10px] text-muted-foreground italic flex gap-2 items-center mt-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Status automático:{" "}
                      <span className="font-bold text-primary ml-1">
                        {calc.statusPagamento.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <PrimaryButton
                    onClick={() => handleSave(false)}
                    className="w-full h-12 font-bold"
                  >
                    ATUALIZAR DADOS FINANCEIROS
                  </PrimaryButton>
                </div>
              </SectionCard>
            </div>

            <div className="xl:col-span-7">
              <SectionCard
                title="Timeline de Negociação"
                subtitle="Anotações e histórico de contatos"
              >
                <div className="space-y-6">
                  <div className="flex gap-3 items-end">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Nova Nota / Registro de Contato
                      </label>
                      <textarea
                        id="noteInput"
                        className="w-full min-h-[80px] p-4 rounded-xl bg-input border border-border text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                        placeholder="Ex: Cliente solicitou desconto de 5% p/ pagamento à vista..."
                      />
                    </div>
                    <PrimaryButton
                      className="h-12 w-12 rounded-xl shrink-0"
                      onClick={() => {
                        const input = document.getElementById("noteInput") as HTMLTextAreaElement;
                        if (input.value) {
                          handleStatusChange(draft.status, input.value);
                          input.value = "";
                        }
                      }}
                    >
                      <Plus className="h-5 w-5" />
                    </PrimaryButton>
                  </div>

                  <div className="space-y-4 mt-6 max-h-[500px] overflow-y-auto pr-3 scrollbar-thin">
                    {negotiationHistory.length === 0 && (
                      <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
                        <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">
                          Nenhum registro de contato
                        </p>
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
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(n.created_at).toLocaleString("pt-BR")}
                              </span>
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
              <SectionCard
                title="Histórico de Versões do Orçamento"
                subtitle="Compare e recupere versões anteriores"
              >
                <div className="space-y-4">
                  {budgetVersions.map((v, i) => (
                    <div
                      key={v.id}
                      className={`p-5 rounded-2xl border-2 transition-all ${v.is_current ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-border bg-surface hover:border-primary/30"}`}
                    >
                      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-12 w-12 rounded-xl flex items-center justify-center font-display font-bold text-lg ${v.is_current ? "bg-primary text-white" : "bg-background text-muted-foreground border border-border"}`}
                          >
                            V{v.version_number}
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-2">
                              {fmtBRL(v.final_budget_value)}
                              {v.is_current && (
                                <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full uppercase">
                                  Atual
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Gerado em{" "}
                              {format(parseISO(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
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
                            <PrimaryButton
                              onClick={async () => {
                                await eventBudgetService.setCurrentVersion(eventoId, v.id);
                                loadAllData();
                              }}
                              className="flex-1 md:flex-none h-10 px-4 text-[10px] font-bold"
                            >
                              TORNAR ATUAL
                            </PrimaryButton>
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

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-border pt-4">
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                            Convidados
                          </div>
                          <div className="text-sm font-bold">
                            {v.average_value_per_person > 0
                              ? Math.round(v.final_budget_value / v.average_value_per_person)
                              : "--"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                            Subtotal (Base)
                          </div>
                          <div className="text-sm font-bold">
                            {fmtBRL(
                              v.drinks_final_value +
                                v.team_total_value +
                                v.ice_total_value +
                                v.fuel_value +
                                v.miscellaneous_total_value,
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                            Desconto
                          </div>
                          <div className="text-sm font-bold text-destructive">
                            {v.discount_value > 0
                              ? `- ${fmtBRL(v.discount_value)}`
                              : "Sem desconto"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                            Lucro
                          </div>
                          <div className="text-sm font-bold text-success">
                            {fmtBRL(v.profit_value - v.discount_value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="xl:col-span-5">
              <SectionCard
                title="Log de Auditoria de Valores"
                subtitle="Rastreabilidade de mudanças críticas"
                action={
                  budgetHistory.length > 0 ? (
                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            "Tem certeza que deseja apagar TODO o histórico de auditoria deste evento?",
                          )
                        )
                          return;
                        await supabase
                          .from("event_budget_history")
                          .delete()
                          .eq("event_id", eventoId);
                        loadAllData();
                      }}
                      className="text-[10px] font-bold text-destructive uppercase hover:underline"
                    >
                      Resetar Logs de Teste
                    </button>
                  ) : undefined
                }
              >
                <div className="space-y-4">
                  {budgetHistory.length === 0 && (
                    <div className="py-20 text-center bg-surface rounded-2xl border-2 border-dashed">
                      <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">
                        Nenhuma alteração registrada
                      </p>
                    </div>
                  )}
                  {budgetHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-4 rounded-xl border border-border bg-surface space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-bold text-primary uppercase tracking-widest">
                          {h.action}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-border/50">
                        <div className="flex-1 text-center">
                          <div className="text-[8px] text-muted-foreground uppercase">De</div>
                          <div className="text-xs font-bold line-through opacity-50">
                            {fmtBRL(h.previous_final_value || 0)}
                          </div>
                        </div>
                        <ArrowLeft className="h-3 w-3 text-muted-foreground rotate-180" />
                        <div className="flex-1 text-center">
                          <div className="text-[8px] text-muted-foreground uppercase">Para</div>
                          <div className="text-xs font-bold text-primary">
                            {fmtBRL(h.new_final_value || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === "Compras e Notinhas" && <ComprasNotinhasTab eventId={eventoId} />}
        {activeTab === "Insumos Levados" && <InsumosLevadosTab eventId={eventoId} />}
        {activeTab === "Fechamento do Evento" && <FechamentoTab eventId={eventoId} />}
      </div>

      {/* PROPOSAL MODAL */}
      {showProposalModal && evento && (
        <ProposalModal
          evento={evento}
          draft={draft}
          allDrinks={allDrinks}
          calc={calc}
          template={proposalTemplate}
          existingProposal={existingProposal}
          eventoId={eventoId}
          onClose={() => setShowProposalModal(false)}
          onSaved={(proposal) => {
            setExistingProposal(proposal);
            setShowProposalModal(false);
          }}
        />
      )}
      {canvaGeneration.open && (
        <CanvaProposalGenerationModal
          state={canvaGeneration}
          onClose={() => setCanvaGeneration((value) => ({ ...value, open: false }))}
        />
      )}

      {/* CONTRACT REVISION & VALIDATION MODAL */}
      <ContractReviewModal
        isOpen={showContractPreviewModal}
        onClose={() => setShowContractPreviewModal(false)}
        template={
          realTemplates.find((t) => t.id === selectedTemplate) ||
          realTemplates.find((t) => t.is_default) ||
          realTemplates[0] ||
          null
        }
        signer={
          realSigners.find((s) => s.id === selectedSigner) ||
          realSigners.find((s) => s.is_active) ||
          null
        }
        // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
        eventName={evento.event_name || evento.client_name || "Evento"}
        compiledHtml={compiledContractText}
        rawTemplateContent={getTemplateContent(
          realTemplates.find((t) => t.id === selectedTemplate) ||
            realTemplates.find((t) => t.is_default) ||
            realTemplates[0] ||
            null,
        )}
        compiledVariables={compiledVariables}
        onConfirmSend={async (finalCleanHtml) => {
          setShowContractPreviewModal(false);
          await handleDispatchSignature(finalCleanHtml);
        }}
      />
    </>
  );
}

// ------------------------------------------------------------
// PROPOSAL MODAL COMPONENT
// ------------------------------------------------------------
function CanvaProposalGenerationModal({
  state,
  onClose,
}: {
  state: {
    status: "loading" | "success" | "error";
    pdfUrl?: string;
    filename?: string;
    message?: string;
    code?: string;
    upsellUrl?: string | null;
    diagnostic?: CanvaGenerationDiagnostic;
  };
  onClose: () => void;
}) {
  const isQuotaExceeded =
    state.code === "canva_autofill_quota_exceeded" ||
    state.diagnostic?.code === "canva_autofill_quota_exceeded" ||
    Boolean(state.upsellUrl || state.diagnostic?.upsell_url) ||
    state.message?.toLowerCase().includes("cota");

  const effectiveUpsellUrl = state.upsellUrl || state.diagnostic?.upsell_url || null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {state.status === "success"
                ? "Proposta gerada com sucesso"
                : state.status === "error"
                  ? isQuotaExceeded
                    ? "Cota de geração automática do Canva atingida"
                    : "Não foi possível gerar a proposta"
                  : "Gerando proposta comercial..."}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Modelo Canva associado ao tipo deste evento
            </p>
          </div>
          {state.status !== "loading" && (
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
        {state.status === "loading" && (
          <div className="mt-6 space-y-3 text-sm">
            {[
              "Carregando dados do evento",
              "Preparando template Canva",
              "Preenchendo campos",
              "Exportando PDF",
            ].map((step, index) => (
              <div key={step} className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className={`h-4 w-4 ${index === 0 ? "animate-spin text-primary" : ""}`} />{" "}
                {step}
              </div>
            ))}
          </div>
        )}
        {state.status === "error" && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 space-y-2">
            <div>{state.message}</div>
            {isQuotaExceeded && (
              <p className="text-xs text-red-300/80">
                O Canva informou que o limite de Autofill disponível para esta integração foi
                atingido. Isso não significa necessariamente que sua conta seja gratuita.
              </p>
            )}
            {state.diagnostic?.canva_account && (
              <div className="text-xs text-muted-foreground pt-1 border-t border-red-500/20">
                <p>
                  Conta Canva conectada:{" "}
                  {state.diagnostic.canva_account.display_name || "Nome não informado"}
                </p>
                <p>
                  canva_user_id: {state.diagnostic.canva_account.canva_user_id || "Não informado"}
                </p>
              </div>
            )}
          </div>
        )}
        {state.status === "success" && state.pdfUrl && (
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-center text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
              href={state.pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Visualizar PDF
            </a>
            <a
              className="flex-1 rounded-xl border border-border px-4 py-3 text-center text-xs font-bold hover:bg-muted transition-all"
              href={state.pdfUrl}
              download={state.filename || "Proposta Comercial - Evento.pdf"}
            >
              Baixar PDF
            </a>
          </div>
        )}
        {state.status === "error" && (
          <div className="mt-4 flex flex-wrap gap-3">
            {effectiveUpsellUrl && (
              <a
                href={effectiveUpsellUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-center text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-indigo-500 transition-all"
              >
                Ver opções no Canva
              </a>
            )}
            <button
              className={`rounded-xl border border-border px-4 py-3 text-xs font-bold hover:bg-muted transition-all ${
                effectiveUpsellUrl ? "w-auto" : "w-full"
              }`}
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalModal({
  evento,
  draft,
  allDrinks,
  calc,
  template,
  existingProposal,
  eventoId,
  onClose,
  onSaved,
}: {
  evento: any;
  draft: any;
  allDrinks: any[];
  calc: any;
  template: import("@/services/proposal-service").ProposalTemplate | null;
  existingProposal: import("@/services/proposal-service").GeneratedProposal | null;
  eventoId: string;
  onClose: () => void;
  onSaved: (proposal: import("@/services/proposal-service").GeneratedProposal) => void;
}) {
  // Pre-fill with existing data or from current budget
  const evType = evento?.event_type?.toLowerCase() || "";
  const mappedEventType: "casamento" | "aniversario" | "comemoracao" = evType.includes("casamento")
    ? "casamento"
    : evType.includes("aniversario") || evType.includes("aniversário")
      ? "aniversario"
      : "comemoracao";

  const defaultData: import("@/services/proposal-service").ProposalData =
    existingProposal?.proposal_data
      ? (existingProposal.proposal_data as any)
      : {
          proposalDate: formatDateDot(new Date()),
          eventDate: formatDateDot(draft?.data),
          eventTime: draft?.horario || "",
          clientName:
            draft?.evento_nome || evento?.event_name || draft?.cliente || evento?.client_name || "",
          eventTypeLabel:
            mappedEventType === "casamento"
              ? "Casamento"
              : mappedEventType === "aniversario"
                ? "Aniversário"
                : "Comemoração",
          selectedDrinks: (draft?.drinks || [])
            .map((id: string) => allDrinks.find((d: any) => d.id === id)?.nome)
            .filter(Boolean),
          includedBeverages: draft?.descricaoBebidas
            ? draft.descricaoBebidas.split("\n").filter((l: string) => l.trim())
            : [],
          welcomeDrinks: draft?.hasWelcomeDrinks
            ? (calc?.welcomeDrinks.distribuicao || []).map(
                (item: import("@/lib/additional-budget-items").WelcomeDrinkDistribution) =>
                  `${item.nameSnapshot}: ${item.quantidade} unidades`,
              )
            : [],
          welcomeDrinksTotal: draft?.hasWelcomeDrinks ? calc?.welcomeDrinks.valorFinal || 0 : 0,
          shots: draft?.hasShots
            ? (draft.shotsItems || []).map(
                (item: import("@/lib/additional-budget-items").ShotBudgetItem) =>
                  `${item.nome}: ${item.quantidade} × ${fmtBRL(item.valorUnitario)}`,
              )
            : [],
          shotsTotal: draft?.hasShots ? calc?.shotsTotal || 0 : 0,
          guests: draft?.convidados || 0,
          bartenders: draft?.equipe?.bartender?.qtd || 0,
          keepers: draft?.equipe?.keeper?.qtd || 0,
          copeiras: draft?.equipe?.copeira?.qtd || 0,
          totalDrinkVarieties: (draft?.drinks || []).length,
          finalInvestment: calc?.valorTotalOrcamento || 0,
          paymentTerms: draft?.pagamento?.formaPagamento || "",
          includedServices: draft?.servicosInclusos || [],
          observations: draft?.observacoes || "",
        };

  const [formData, setFormData] =
    React.useState<import("@/services/proposal-service").ProposalData>(defaultData);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = React.useState(false);
  const [savingPdf, setSavingPdf] = React.useState(false);

  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateArrayField = (field: string, index: number, value: string) => {
    setFormData((prev) => {
      const arr = [...(prev as any)[field]];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev as any)[field], ""],
    }));
  };

  const removeArrayItem = (field: string, index: number) => {
    setFormData((prev) => {
      const arr = [...(prev as any)[field]];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
  };

  const validateProposalData = () => {
    const missing: string[] = [];
    if (!formData.proposalDate?.trim()) missing.push("Data do orçamento");
    if (!mappedEventType?.trim()) missing.push("Tipo de evento");
    if (!formData.clientName?.trim()) missing.push("Nome exibido na capa");
    if (!formData.eventDate?.trim()) missing.push("Data do evento");
    if (!formData.selectedDrinks?.filter((d) => d.trim()).length) missing.push("Lista de drinks");
    if (!formData.includedBeverages?.filter((b) => b.trim()).length)
      missing.push("Lista de bebidas");
    if (!formData.guests) missing.push("Número de convidados");
    if (!formData.bartenders && !formData.keepers && !formData.copeiras) missing.push("Equipe");
    if (!formData.finalInvestment) missing.push("Investimento");
    if (!formData.paymentTerms?.trim()) missing.push("Forma de pagamento");
    return missing;
  };

  const generatePreview = React.useCallback(async () => {
    const missing = validateProposalData();
    if (missing.length) {
      alert(`Preencha os campos obrigatórios antes de gerar a prévia:
- ${missing.join("\n- ")}`);
      return;
    }
    setGeneratingPreview(true);
    try {
      const pdfBytes = await pdfGenerationService.generateProposalPDF(
        template?.file_url || null,
        formData,
        mappedEventType,
      );
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (err) {
      console.error("Erro ao gerar prévia:", err);
      alert("Erro ao gerar prévia do PDF.");
    } finally {
      setGeneratingPreview(false);
    }
  }, [formData, template, mappedEventType]);

  // Auto-generate preview on open
  React.useEffect(() => {
    generatePreview();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const handleSaveAndDownload = async () => {
    const missing = validateProposalData();
    if (missing.length) {
      alert(`Preencha os campos obrigatórios antes de baixar o PDF:
- ${missing.join("\n- ")}`);
      return;
    }
    setSavingPdf(true);
    try {
      const pdfBytes = await pdfGenerationService.generateProposalPDF(
        template?.file_url || null,
        formData,
        mappedEventType,
      );
      const filename = buildProposalFilename(evento?.event_name);
      const pdfUrl = await generatedProposalsService.uploadGeneratedPDF(
        eventoId,
        evento?.event_name,
        pdfBytes,
      );
      const saved = await generatedProposalsService.saveProposal({
        id: existingProposal?.id,
        event_id: eventoId,
        budget_id: null,
        template_id: template?.id || null,
        proposal_data: formData as any,
        final_pdf_url: pdfUrl,
        status: "downloaded",
      });
      // Download
      // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      onSaved(saved);
    } catch (err: any) {
      console.error("Erro ao salvar proposta:", err);
      alert(`Erro ao salvar proposta: ${err?.message || "Tente novamente"}`);
    } finally {
      setSavingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-background/95 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Left Panel: Form */}
      <div className="w-full md:w-[420px] xl:w-[480px] shrink-0 flex flex-col border-r border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface">
          <div>
            <h2 className="font-display text-base font-semibold">Proposta Comercial</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template ? `Usando modelo: ${template.name}` : "Gerando PDF padrão Goat Bar"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* CAPA */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest">
              1. Capa da Proposta
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Nome do Cliente / Casal / Evento</label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => updateForm("clientName", e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-eyebrow block mb-1.5">Data do Evento</label>
                <input
                  type="text"
                  value={formData.eventDate}
                  onChange={(e) => updateForm("eventDate", e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1.5">Horário</label>
                <input
                  type="text"
                  value={formData.eventTime || ""}
                  onChange={(e) => updateForm("eventTime", e.target.value)}
                  placeholder="Ex: 20h"
                  className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Descrição do Evento (Capa)</label>
              <input
                type="text"
                value={formData.eventTypeLabel}
                onChange={(e) => updateForm("eventTypeLabel", e.target.value)}
                placeholder="Ex: Casamento de João e Maria"
                className="w-full h-10 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* DRINKS */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest">
              2. Drinks & Experiências
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Drinks no Cardápio</label>
              <div className="space-y-2">
                {formData.selectedDrinks.map((drink, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={drink}
                      onChange={(e) => updateArrayField("selectedDrinks", idx, e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => removeArrayItem("selectedDrinks", idx)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-border"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addArrayItem("selectedDrinks")}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  + Adicionar drink
                </button>
              </div>
            </div>

            <div>
              <label className="label-eyebrow block mb-1.5">Bebidas Negociadas / Incluídas</label>
              <div className="space-y-2">
                {formData.includedBeverages.map((bev, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={bev}
                      onChange={(e) => updateArrayField("includedBeverages", idx, e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                      placeholder="Ex: 2 caixas de vodka Absolut"
                    />
                    <button
                      onClick={() => removeArrayItem("includedBeverages", idx)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-border"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addArrayItem("includedBeverages")}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  + Adicionar bebida
                </button>
              </div>
            </div>
          </div>

          {/* EQUIPE & VALORES */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest">
              3. Equipe & Valores
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-eyebrow block mb-1.5">Convidados</label>
                <input
                  type="number"
                  value={formData.guests}
                  onChange={(e) => updateForm("guests", Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1.5">Tipos de Drinks</label>
                <input
                  type="number"
                  value={formData.totalDrinkVarieties}
                  onChange={(e) => updateForm("totalDrinkVarieties", Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1.5">Bartenders</label>
                <input
                  type="number"
                  value={formData.bartenders}
                  onChange={(e) => updateForm("bartenders", Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1.5">Bar Keepers</label>
                <input
                  type="number"
                  value={formData.keepers}
                  onChange={(e) => updateForm("keepers", Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1.5">Copeiras</label>
                <input
                  type="number"
                  value={formData.copeiras}
                  onChange={(e) => updateForm("copeiras", Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1.5">Investimento (R$)</label>
                <input
                  type="number"
                  value={formData.finalInvestment}
                  onChange={(e) => updateForm("finalInvestment", Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Condições de Pagamento</label>
              <textarea
                value={formData.paymentTerms}
                onChange={(e) => updateForm("paymentTerms", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Ex: 50% na assinatura + 50% até 7 dias antes do evento"
              />
            </div>
          </div>

          {/* SERVIÇOS & OBSERVAÇÕES */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-primary uppercase tracking-widest">
              4. Serviços & Observações
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Serviços Incluídos</label>
              <div className="space-y-2">
                {formData.includedServices.map((srv, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={srv}
                      onChange={(e) => updateArrayField("includedServices", idx, e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-xs focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={() => removeArrayItem("includedServices", idx)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-border"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addArrayItem("includedServices")}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  + Adicionar serviço
                </button>
              </div>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Observações Gerais</label>
              <textarea
                value={formData.observations || ""}
                onChange={(e) => updateForm("observations", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:border-primary focus:outline-none resize-none"
                placeholder="Observações adicionais, condições especiais, etc."
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 p-4 border-t border-border bg-surface/80 flex-wrap">
          <button
            onClick={generatePreview}
            disabled={generatingPreview}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground transition-all disabled:opacity-50"
          >
            {generatingPreview ? <span className="animate-spin">⟳</span> : "⟳"} Atualizar Prévia
          </button>
          <button
            onClick={handleSaveAndDownload}
            disabled={savingPdf}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {savingPdf ? "Salvando..." : "💾 Salvar & Baixar PDF"}
          </button>
        </div>
      </div>

      {/* Right Panel: PDF Preview */}
      <div className="flex-1 flex flex-col hidden md:flex">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface/80">
          <span className="text-sm font-semibold">Pré-visualização da Proposta</span>
          {generatingPreview && (
            <span className="text-xs text-muted-foreground animate-pulse">Gerando...</span>
          )}
        </div>
        <div className="flex-1 bg-muted/30 p-4 overflow-hidden">
          {previewUrl ? (
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="Prévia da Proposta Comercial"
              className="w-full h-full rounded-xl border border-border shadow-xl"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-3xl">
                📄
              </div>
              <span className="font-medium">
                {generatingPreview
                  ? "Gerando prévia do PDF..."
                  : "Clique em 'Atualizar Prévia' para ver"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div className="font-medium text-sm border-b border-border/50 pb-1">{value || "---"}</div>
    </div>
  );
}

function StatusStep({ done, title }: { done: boolean; title: string }) {
  return (
    <div className="flex items-center gap-4 group">
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${done ? "bg-success border-success text-white shadow-lg shadow-success/30" : "border-border text-muted-foreground group-hover:border-primary/50"}`}
      >
        {done ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <div className="h-1.5 w-1.5 rounded-full bg-border" />
        )}
      </div>
      <span
        className={`text-sm font-bold uppercase tracking-wider ${done ? "text-foreground" : "text-muted-foreground"}`}
      >
        {title}
      </span>
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
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
          {label}
        </div>
        <div className="font-display font-bold text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1 group">
      <span className="text-muted-foreground text-xs uppercase tracking-widest font-medium group-hover:text-foreground transition-colors">
        {k}
      </span>
      <span
        className={`font-bold tabular-nums ${highlight ? "text-success text-base" : "text-foreground"}`}
      >
        {v}
      </span>
    </div>
  );
}
