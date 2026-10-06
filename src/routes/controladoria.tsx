import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  StatCard,
  SectionCard,
  PrimaryButton,
  GhostButton,
  StatusBadge,
} from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Receipt,
  Calendar,
  User,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Upload,
  ExternalLink,
  Trash2,
  X,
  Eye,
  Pencil,
  Camera,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  financialService,
  type FinancialExpense,
  type FinancialModality,
  type FinancialCategory,
  type FinancialStatus,
  type FinancialClassification,
  type FinancialEntryType,
  type PaymentMethod,
} from "@/services/financial-service";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/controladoria")({
  component: () => (
    <AppShell>
      <ControladoriaPage />
    </AppShell>
  ),
});

function ControladoriaPage() {
  const [expenses, setExpenses] = useState<FinancialExpense[]>([]);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [showTextImportModal, setShowTextImportModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FinancialExpense | null>(null);
  const [selectedExpenseItems, setSelectedExpenseItems] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [textImportValue, setTextImportValue] = useState("");
  const [textImportEventId, setTextImportEventId] = useState("");
  const [filters, setFilters] = useState({
    start_date: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end_date: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    modality: "",
    status: "",
    category: "",
    entry_type: "",
  });

  const [form, setForm] = useState<Partial<FinancialExpense> & { items?: any[] }>({
    date: format(new Date(), "yyyy-MM-dd"),
    modality: "Ativo",
    event_id: "",
    entry_type: "Despesa",
    category: "Operacional",
    description: "",
    amount: 0,
    responsible: "",
    payment_method: "PIX Goat",
    status: "Pago",
    classification: "Direto",
    items: [{ product_name: "", quantity: 1, unit: "un", unit_price: 0, total_price: 0 }],
  });

  const [uploading, setUploading] = useState<{ invoice?: boolean; receipt?: boolean; note?: boolean }>({});

  const applyPeriodPreset = (preset: "today" | "week" | "month" | "year" | "all") => {
    const now = new Date();
    if (preset === "all") {
      setFilters((p) => ({ ...p, start_date: "", end_date: "" }));
      return;
    }
    const ranges = {
      today: [now, now],
      week: [startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })],
      month: [startOfMonth(now), endOfMonth(now)],
      year: [startOfYear(now), endOfYear(now)],
    } as const;
    const [start, end] = ranges[preset];
    setFilters((p) => ({
      ...p,
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
    }));
  };

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await financialService.listExpenses(filters);
      setExpenses(data);
      
      const { data: eventsData } = await (window as any).supabase
        .from("events")
        .select("id, client_name, event_name, date, status")
        .order("date", { ascending: false });
      if (eventsData) {
        setEventsList(eventsData.filter((ev: any) =>
          ["CONFIRMADO", "FINALIZADO", "REALIZADO", "PROPOSTA_ACEITA"].includes(String(ev.status || "").toUpperCase())
        ));
      }
    } catch (e) {
      console.error("Erro ao carregar gastos:", e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const receitas = expenses
      .filter((e) => e.entry_type === "Receita")
      .reduce((a, b) => a + Number(b.amount), 0);
    const custos = expenses
      .filter((e) => e.entry_type !== "Receita")
      .reduce((a, b) => a + Number(b.amount), 0);
    const pendente = expenses
      .filter((e) => e.entry_type === "Despesa" && e.status === "Pendente")
      .reduce((a, b) => a + Number(b.amount), 0);
    const caixaSaida = expenses
      .filter((e) => e.entry_type === "Despesa" && e.cash_effect !== false)
      .reduce((a, b) => a + Number(b.amount), 0);
    const reembolsosPendentes = expenses
      .filter(
        (e) =>
          e.entry_type === "Despesa" &&
          e.status === "Pago" &&
          e.payment_method === "Pessoal" &&
          !e.personal_reimbursed,
      )
      .reduce((a, b) => a + Number(b.amount), 0);

    return {
      receitas,
      custos,
      pendente,
      caixaSaida,
      reembolsosPendentes,
      resultado: receitas - custos,
    };
  }, [expenses]);

  const chartDataByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const chartDataByModality = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.modality] = (map[e.modality] || 0) + Number(e.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const COLORS = ["#D4AF37", "#1A1A1A", "#4A4A4A", "#8B7355", "#C0C0C0"];

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "invoice" | "receipt",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading((p) => ({ ...p, [type]: true }));
    try {
      const url = await financialService.uploadAttachment(file, type);
      setForm((p) => ({ ...p, [type === "invoice" ? "invoice_url" : "receipt_url"]: url }));
    } catch (err) {
      alert("Erro no upload do arquivo.");
    } finally {
      setUploading((p) => ({ ...p, [type]: false }));
    }
  };


  const handleReceiptExtraction = async (file: File) => {
    setOcrLoading(true);
    try {
      const uploadedUrl = await financialService.uploadAttachment(file, "invoice");
      const extracted = await financialService.extractExpenseFromReceipt(file);
      const parsedDate = extracted.date?.includes("/")
        ? extracted.date.split("/").reverse().join("-")
        : extracted.date || format(new Date(), "yyyy-MM-dd");

      setForm((prev) => ({
        ...prev,
        date: parsedDate,
        description: `Despesa via notinha - ${extracted.supplier_name || "revisar dados"} - ${parsedDate.split("-").reverse().join("/")}`,
        amount: extracted.amount ?? prev.amount ?? 0,
        supplier_name: extracted.supplier_name || prev.supplier_name || "",
        supplier_cnpj: extracted.supplier_cnpj || "",
        category: extracted.category || prev.category || "Outros",
        payment_method: prev.payment_method || "PIX Goat",
        review_status: extracted.review_status,
        ocr_raw_text: extracted.raw_text,
        ocr_metadata: { confidence: extracted.confidence || 0, source: "ocr-receipt" },
        auto_filled_fields: extracted.auto_filled_fields,
        invoice_url: uploadedUrl,
        items: extracted.items || [],
      }));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleTextExtraction = async () => {
    if (!textImportValue.trim()) return;
    setOcrLoading(true);
    try {
      const extracted = await financialService.extractExpenseFromText(textImportValue);
      const parsedDate = extracted.date?.includes("/")
        ? extracted.date.split("/").reverse().join("-")
        : extracted.date || format(new Date(), "yyyy-MM-dd");

      setForm((prev) => ({
        ...prev,
        modality: textImportEventId ? "Evento" : "Ativo",
        event_id: textImportEventId || "",
        date: parsedDate,
        description: `Despesa via Importação - ${extracted.supplier_name || "revisar dados"} - ${parsedDate.split("-").reverse().join("/")}`,
        amount: extracted.amount ?? prev.amount ?? 0,
        supplier_name: extracted.supplier_name || prev.supplier_name || "",
        supplier_cnpj: extracted.supplier_cnpj || "",
        category: extracted.category || prev.category || "Outros",
        payment_method: prev.payment_method || "PIX Goat",
        review_status: extracted.review_status,
        ocr_raw_text: extracted.raw_text,
        ocr_metadata: { confidence: extracted.confidence || 0, source: "text-import" },
        auto_filled_fields: extracted.auto_filled_fields,
        items: extracted.items || [],
      }));
      setShowTextImportModal(false);
      setShowModal(true);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount) {
      alert("Preencha descrição e valor.");
      return;
    }
    if ((form.modality === "Evento" || form.modality === "Degustação") && !form.event_id) {
      alert("Selecione o evento relacionado.");
      return;
    }
    if (
      form.entry_type === "Despesa" &&
      form.status === "Pago" &&
      (!form.payment_method || form.payment_method === "Não informado")
    ) {
      alert("Informe como este lançamento foi pago.");
      return;
    }
    if (
      form.entry_type === "Despesa" &&
      form.status === "Pago" &&
      form.payment_method === "Pessoal" &&
      !form.payment_payer_name?.trim()
    ) {
      alert("Informe quem realizou o pagamento pessoal.");
      return;
    }
    if (form.entry_type === "Despesa") {
      const firstItem = (form.items || [])[0];
      if (!firstItem?.product_name?.trim() || Number(firstItem?.quantity || 0) <= 0) {
        alert("Informe o que foi comprado e a quantidade.");
        return;
      }
    }

    try {
      const manuallyEdited = ((form as any).auto_filled_fields || []).filter((field: string) => {
        const value = (form as any)[field];
        return value !== undefined && value !== null && String(value).trim() !== "";
      });
      const sourceItems = form.items || [];
      const normalizedItems = sourceItems.map((item: any) => {
        const quantity = Number(item.quantity || 0);
        const currentTotal = Number(item.total_price || 0);
        const currentUnit = Number(item.unit_price || 0);
        const singleItemFallback = sourceItems.length === 1 ? Number(form.amount || 0) : 0;
        const totalPrice = currentTotal > 0
          ? currentTotal
          : currentUnit > 0 && quantity > 0
            ? currentUnit * quantity
            : singleItemFallback;
        const unitPrice = currentUnit > 0
          ? currentUnit
          : quantity > 0
            ? totalPrice / quantity
            : totalPrice;
        return {
          ...item,
          product_name: item.product_name?.trim() || form.description || "Item",
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
        };
      });
      const payload =
        form.entry_type === "Receita"
          ? {
              ...form,
              category: "Outros" as FinancialCategory,
              payment_method: "Não informado" as PaymentMethod,
              payment_payer_name: "",
              personal_reimbursed: false,
              personal_reimbursed_at: null,
              due_date: undefined,
              supplier_name: undefined,
              supplier_cnpj: undefined,
              staff_name: undefined,
              staff_role: undefined,
              classification: "Direto" as FinancialClassification,
              items: [],
            }
          : {
              ...form,
              items: normalizedItems,
            };

      const saved = editingExpenseId
        ? await financialService.updateExpenseWithItems(editingExpenseId, {
            ...payload,
            items: form.entry_type === "Receita" ? [] : normalizedItems,
            manually_edited_fields: manuallyEdited,
            personal_reimbursed:
              form.payment_method === "Pessoal" ? Boolean(form.personal_reimbursed) : false,
            personal_reimbursed_at:
              form.payment_method === "Pessoal" && form.personal_reimbursed
                ? form.personal_reimbursed_at || new Date().toISOString()
                : null,
          })
        : await financialService.createExpense({
            ...payload,
            items: form.entry_type === "Receita" ? [] : normalizedItems,
            manually_edited_fields: manuallyEdited,
          });
      if ((form as any).invoice_url) {
        await financialService.createReceiptLog({
          expense_id: saved.id,
          is_ocr_generated: true,
          auto_filled_fields: (form as any).auto_filled_fields || [],
          manually_edited_fields: manuallyEdited,
          reading_error: (form as any).review_status === "Erro na leitura" ? "OCR não retornou texto válido" : null,
          metadata: (form as any).ocr_metadata || {},
        });
      }
      setShowModal(false);
      setEditingExpenseId(null);
      fetchExpenses();
      setForm({
        date: format(new Date(), "yyyy-MM-dd"),
        modality: "Ativo",
        entry_type: "Despesa",
        category: "Operacional",
        description: "",
        amount: 0,
        responsible: "",
        payment_method: "PIX Goat",
        status: "Pago",
        classification: "Direto",
        items: [{ product_name: "", quantity: 1, unit: "un", unit_price: 0, total_price: 0 }],
      });
    } catch (e) {
      alert("Erro ao salvar lançamento.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    try {
      await financialService.deleteExpense(id);
      fetchExpenses();
    } catch (e) {
      alert("Erro ao excluir.");
    }
  };

  const openEditExpense = async (
    expense: FinancialExpense,
    options?: { markAsPaid?: boolean },
  ) => {
    try {
      const detail = await financialService.getExpenseDetails(expense.id);
      const expenseData = detail.expense;
      setEditingExpenseId(expense.id);
      setSelectedExpense(null);
      setForm({
        ...expenseData,
        status: options?.markAsPaid ? "Pago" : expenseData.status,
        payment_method: expenseData.payment_method,
        items:
          detail.items.length > 0
            ? detail.items
            : [{
                product_name: expenseData.description || "",
                quantity: 1,
                unit: "un",
                unit_price: Number(expenseData.amount || 0),
                total_price: Number(expenseData.amount || 0),
              }],
      });
      setShowModal(true);
    } catch (e) {
      console.error("Erro ao abrir edição do lançamento:", e);
      alert("Erro ao carregar o lançamento para edição.");
    }
  };

  const toggleStatus = async (expense: FinancialExpense) => {
    if (expense.status === "Pendente") {
      await openEditExpense(expense, { markAsPaid: true });
      return;
    }
    try {
      await financialService.updateExpense(expense.id, {
        status: "Pendente",
        payment_method: "Não informado",
        payment_payer_name: undefined,
        personal_reimbursed: false,
        personal_reimbursed_at: null,
      });
      fetchExpenses();
    } catch (e) {
      alert("Erro ao atualizar status.");
    }
  };

  const openExpenseDetails = async (expense: FinancialExpense) => {
    setSelectedExpense(expense);
    setSelectedExpenseItems([]);
    setDetailLoading(true);
    try {
      const detail = await financialService.getExpenseDetails(expense.id);
      setSelectedExpense(detail.expense);
      setSelectedExpenseItems(detail.items);
    } catch (e) {
      console.error("Erro ao carregar detalhes do lançamento:", e);
    } finally {
      setDetailLoading(false);
    }
  };

  const paymentLabel = (expense: FinancialExpense) => {
    if (expense.entry_type === "Receita") return expense.status === "Pendente" ? "A receber" : "Recebido";
    if (expense.status === "Pendente") return "Em aberto";
    if (expense.payment_method === "Pessoal" && expense.payment_payer_name) {
      return `Pessoal · ${expense.payment_payer_name}`;
    }
    return expense.payment_method || "Não informado";
  };

  const togglePersonalReimbursement = async (expense: FinancialExpense) => {
    if (expense.payment_method !== "Pessoal") return;
    const nextReimbursed = !expense.personal_reimbursed;
    try {
      const updated = await financialService.updateExpense(expense.id, {
        personal_reimbursed: nextReimbursed,
        personal_reimbursed_at: nextReimbursed ? new Date().toISOString() : null,
      });
      setExpenses((prev) => prev.map((item) => item.id === expense.id ? { ...item, ...updated } : item));
      if (selectedExpense?.id === expense.id) {
        setSelectedExpense((prev) => prev ? { ...prev, ...updated } : prev);
      }
    } catch (e) {
      console.error("Erro ao atualizar reembolso:", e);
      alert("Erro ao atualizar o status do reembolso.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Controladoria"
        action={
          <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto">
            <GhostButton
              onClick={() => setShowTextImportModal(true)}
              className="w-full min-w-0 justify-center px-3 text-xs lg:w-auto lg:text-sm"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">Importar texto</span>
            </GhostButton>
            <GhostButton
              onClick={() => setShowReceiptModal(true)}
              className="w-full min-w-0 justify-center px-3 text-xs lg:w-auto lg:text-sm"
            >
              <Camera className="h-4 w-4 shrink-0" />
              <span className="truncate">Foto da notinha</span>
            </GhostButton>
            <PrimaryButton
              onClick={() => { setEditingExpenseId(null); setShowModal(true); }}
              className="col-span-2 w-full justify-center lg:col-span-1 lg:w-auto"
            >
              <Plus className="h-4 w-4 shrink-0" /> Novo Lançamento
            </PrimaryButton>
          </div>
        }
      />

      <div className="page-container mx-auto w-full max-w-[1600px] space-y-5 lg:space-y-7">
        {/* RESUMO */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-5">
          <StatCard label="Receitas" value={fmtBRL(totals.receitas)} icon={<CheckCircle2 className="text-emerald-500" />} />
          <StatCard label="Custos Alocados" value={fmtBRL(totals.custos)} />
          <StatCard label="Resultado" value={fmtBRL(totals.resultado)} />
          <StatCard label="Em aberto" value={fmtBRL(totals.pendente)} icon={<AlertCircle className="text-amber-500" />} />
          <StatCard label="Reembolsos pendentes" value={fmtBRL(totals.reembolsosPendentes)} icon={<User className="text-amber-500" />} />
        </div>

        {/* DASHBOARD CHARTS */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-7">
          <SectionCard title="Gastos por Modalidade" className="lg:col-span-1">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataByModality}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartDataByModality.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => fmtBRL(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2 text-[10px] font-bold uppercase">
                {chartDataByModality.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Distribuição por Categoria" className="lg:col-span-2">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataByCategory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(212, 175, 55, 0.05)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: any) => fmtBRL(value)}
                  />
                  <Bar dataKey="value" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* FILTROS E LISTA */}
        <SectionCard title="Fluxo de Custos">
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => applyPeriodPreset("today")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary">Hoje</button>
            <button onClick={() => applyPeriodPreset("week")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary">Semana</button>
            <button onClick={() => applyPeriodPreset("month")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary">Mês</button>
            <button onClick={() => applyPeriodPreset("year")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary">Ano</button>
            <button onClick={() => applyPeriodPreset("all")} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary">Todo período</button>
          </div>
          <div className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2 sm:p-4 xl:flex xl:flex-wrap xl:gap-4">
            <div className="min-w-0 sm:col-span-2 xl:flex-1 xl:min-w-[260px]">
              <label className="label-eyebrow block mb-1.5">Período</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-xs w-full"
                />
                <span className="hidden text-muted-foreground sm:inline">-</span>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-xs w-full"
                />
              </div>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Modalidade</label>
              <select
                value={filters.modality}
                onChange={(e) => setFilters((p) => ({ ...p, modality: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs xl:min-w-[140px]"
              >
                <option value="">Todas</option>
                <option value="Evento">Evento</option>
                <option value="Goat Botequim">Goat Botequim</option>
                <option value="7 Steak House">7 Steak House</option>
                <option value="Degustação">Degustação</option>
                <option value="Ativo">Ativo</option>
              </select>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Tipo</label>
              <select
                value={filters.entry_type}
                onChange={(e) => setFilters((p) => ({ ...p, entry_type: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs xl:min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="Despesa">Despesa</option>
                <option value="Receita">Receita</option>
                <option value="Alocação Interna">Alocação Interna</option>
              </select>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs xl:min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="Pago">Pago</option>
                <option value="Pendente">Em aberto</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {expenses.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum lançamento encontrado no período.
              </div>
            )}
            {expenses.map((exp) => (
              <article key={`mobile-${exp.id}`} className="rounded-xl border border-border bg-background/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {format(parseISO(exp.date), "dd/MM/yy")} · {exp.modality}
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                      {exp.description}
                    </h3>
                  </div>
                  <button onClick={() => toggleStatus(exp)} className="shrink-0">
                    <StatusBadge
                          status={
                            exp.status === "Pendente"
                              ? "financeiro_em_aberto"
                              : exp.status === "Pago"
                                ? "financeiro_pago"
                                : exp.status
                          }
                        />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-tight">
                    {exp.category}
                  </span>
                  {exp.entry_type && (
                    <span className="rounded-full border border-border px-2 py-1 text-[9px] font-semibold uppercase tracking-tight text-muted-foreground">
                      {exp.entry_type}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-xl font-bold">{fmtBRL(exp.amount)}</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CreditCard className="h-3 w-3 shrink-0" />
                      <span className="truncate">{paymentLabel(exp)}</span>
                    </div>
                    {exp.payment_method === "Pessoal" && (
                      <button
                        type="button"
                        onClick={() => togglePersonalReimbursement(exp)}
                        className={`mt-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight ${
                          exp.personal_reimbursed
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                        }`}
                      >
                        {exp.personal_reimbursed ? "Reembolsado" : "Reembolso pendente"}
                      </button>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{exp.responsible || "Sem responsável"} · {exp.classification}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => openEditExpense(exp)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
                      title="Editar lançamento"
                      aria-label={`Editar ${exp.description}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openExpenseDetails(exp)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
                      title="Ver detalhes"
                      aria-label={`Ver detalhes de ${exp.description}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {exp.invoice_url && (
                      <a
                        href={exp.invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        title="Nota Fiscal"
                      >
                        <FileText className="h-4 w-4" />
                      </a>
                    )}
                    {exp.receipt_url && (
                      <a
                        href={exp.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"
                        title="Comprovante"
                      >
                        <Receipt className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                      aria-label={`Excluir ${exp.description}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Data
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Descrição
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Modalidade
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Valor
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Pagamento
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Anexos
                  </th>
                  <th className="pb-4 font-display text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {expenses.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      Nenhum gasto encontrado no período.
                    </td>
                  </tr>
                )}
                {expenses.map((exp) => (
                  <tr key={exp.id} className="group hover:bg-surface/50 transition-colors">
                    <td className="py-4 text-xs font-medium">
                      {format(parseISO(exp.date), "dd/MM/yy")}
                    </td>
                    <td className="py-4">
                      <div className="text-sm font-semibold">{exp.description}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" /> {exp.responsible} · {exp.classification}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-4 text-xs">{exp.modality}</td>
                    <td className="py-4 font-display font-bold text-sm">{fmtBRL(exp.amount)}</td>
                    <td className="py-4">
                      <button onClick={() => toggleStatus(exp)} className="cursor-pointer">
                        <StatusBadge
                          status={
                            exp.status === "Pendente"
                              ? "financeiro_em_aberto"
                              : exp.status === "Pago"
                                ? "financeiro_pago"
                                : exp.status
                          }
                        />
                      </button>
                    </td>
                    <td className="py-4 text-xs">
                      <div className="flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{paymentLabel(exp)}</span>
                        </div>
                        {exp.payment_method === "Pessoal" && (
                          <button
                            type="button"
                            onClick={() => togglePersonalReimbursement(exp)}
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight transition-colors ${
                              exp.personal_reimbursed
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                            }`}
                            title={exp.personal_reimbursed ? "Clique para marcar como não reembolsado" : "Clique para marcar como reembolsado"}
                          >
                            {exp.personal_reimbursed ? "Reembolsado" : "Reembolso pendente"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-1.5">
                        {exp.invoice_url && (
                          <a
                            href={exp.invoice_url}
                            target="_blank"
                            className="h-7 w-7 rounded bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                            title="Nota Fiscal"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {exp.receipt_url && (
                          <a
                            href={exp.receipt_url}
                            target="_blank"
                            className="h-7 w-7 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-colors"
                            title="Comprovante"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditExpense(exp)}
                          className="h-8 w-8 rounded hover:bg-muted text-foreground flex items-center justify-center"
                          title="Editar lançamento"
                          aria-label={`Editar ${exp.description}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openExpenseDetails(exp)}
                          className="h-8 w-8 rounded hover:bg-muted text-foreground flex items-center justify-center"
                          title="Ver detalhes"
                          aria-label={`Ver detalhes de ${exp.description}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="h-8 w-8 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedExpense(null)}
          />
          <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Detalhes do lançamento</div>
                <h2 className="font-display text-lg font-bold">{selectedExpense.description}</h2>
              </div>
              <button
                onClick={() => setSelectedExpense(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Fechar detalhes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {detailLoading && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Carregando detalhes...
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-border p-3">
                  <div className="label-eyebrow">Data</div>
                  <div className="mt-1 text-sm font-semibold">{format(parseISO(selectedExpense.date), "dd/MM/yyyy")}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="label-eyebrow">Valor</div>
                  <div className="mt-1 text-sm font-semibold">{fmtBRL(selectedExpense.amount)}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="label-eyebrow">Status</div>
                  <div className="mt-1 text-sm font-semibold">{selectedExpense.status === "Pendente" ? "Em aberto" : "Pago"}</div>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <div className="label-eyebrow">Pagamento</div>
                  <div className="mt-1 text-sm font-semibold">{paymentLabel(selectedExpense)}</div>
                </div>
              </div>

              {selectedExpense.payment_method === "Pessoal" && (
                <div className="rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="label-eyebrow">Reembolso pessoal</div>
                      <div className="mt-1 text-sm font-semibold">
                        {selectedExpense.personal_reimbursed ? "Reembolsado" : "Reembolso pendente"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {selectedExpense.personal_reimbursed
                          ? selectedExpense.personal_reimbursed_at
                            ? `Marcado como reembolsado em ${format(new Date(selectedExpense.personal_reimbursed_at), "dd/MM/yyyy 'às' HH:mm")}`
                            : "Reembolso marcado como realizado."
                          : `A Goat Bar ainda deve reembolsar ${selectedExpense.payment_payer_name || "a pessoa que realizou o pagamento"}.`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePersonalReimbursement(selectedExpense)}
                      className={`rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${
                        selectedExpense.personal_reimbursed
                          ? "border-border hover:bg-muted"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                      }`}
                    >
                      {selectedExpense.personal_reimbursed
                        ? "Marcar como não reembolsado"
                        : "Marcar como reembolsado"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <div className="label-eyebrow mb-3">Classificação</div>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Modalidade:</span> {selectedExpense.modality}</div>
                    <div><span className="text-muted-foreground">Categoria:</span> {selectedExpense.category}</div>
                    <div><span className="text-muted-foreground">Tipo:</span> {selectedExpense.entry_type || "Despesa"}</div>
                    <div><span className="text-muted-foreground">Classificação:</span> {selectedExpense.classification}</div>
                    <div><span className="text-muted-foreground">Responsável:</span> {selectedExpense.responsible || "Não informado"}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="label-eyebrow mb-3">Origem e fornecedor</div>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Fornecedor:</span> {selectedExpense.supplier_name || "Não informado"}</div>
                    <div><span className="text-muted-foreground">CNPJ:</span> {selectedExpense.supplier_cnpj || "Não informado"}</div>
                    <div><span className="text-muted-foreground">Origem:</span> {selectedExpense.source_channel === "gia" ? "GIA" : selectedExpense.source_channel || "Sistema"}</div>
                    <div><span className="text-muted-foreground">Revisão:</span> {selectedExpense.review_status || "Não informado"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="label-eyebrow mb-3">Itens</div>
                {selectedExpenseItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum item detalhado vinculado a este lançamento.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {selectedExpenseItems.map((item, index) => (
                      <div key={item.id || index} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                        <div>
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.quantity} {item.unit || "un"}
                            {Number(item.unit_price) > 0 ? ` × ${fmtBRL(Number(item.unit_price))}` : ""}
                          </div>
                        </div>
                        <div className="font-semibold">{fmtBRL(Number(item.total_price || 0))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditExpense(selectedExpense)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" /> Editar lançamento
                </button>
                {selectedExpense.status === "Pendente" && (
                  <button
                    type="button"
                    onClick={() => openEditExpense(selectedExpense, { markAsPaid: true })}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-500 hover:bg-emerald-500/20"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Marcar como pago
                  </button>
                )}
              </div>

              {(selectedExpense.invoice_url || selectedExpense.receipt_url) && (
                <div className="flex flex-wrap gap-2">
                  {selectedExpense.invoice_url && (
                    <a href={selectedExpense.invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                      <FileText className="h-4 w-4" /> Abrir nota fiscal
                    </a>
                  )}
                  {selectedExpense.receipt_url && (
                    <a href={selectedExpense.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                      <Receipt className="h-4 w-4" /> Abrir comprovante
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

            {/* MODAL NOVO GASTO */}

      {showTextImportModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowTextImportModal(false)} />
          <div className="relative max-h-[92dvh] w-full max-w-xl overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl animate-in zoom-in-95 duration-200 sm:rounded-2xl">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-primary/5">
              <h2 className="font-display text-lg font-bold">Importar Pedido / Nota Fiscal</h2>
              <button
                onClick={() => setShowTextImportModal(false)}
                className="h-8 w-8 rounded-full hover:bg-border flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-eyebrow mb-1.5 block">Evento Relacionado (Opcional)</label>
                <select
                  value={textImportEventId}
                  onChange={(e) => setTextImportEventId(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none focus:border-primary"
                >
                  <option value="">Nenhum (Lançamento Geral)</option>
                  {eventsList.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.event_name || ev.client_name} - {format(parseISO(ev.date), "dd/MM")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-eyebrow mb-1.5 block">Cole o texto aqui (WhatsApp, Excel, NFe, PDF)</label>
                <textarea
                  value={textImportValue}
                  onChange={(e) => setTextImportValue(e.target.value)}
                  className="w-full h-40 p-4 rounded-xl bg-input border border-border outline-none focus:border-primary resize-none font-mono text-xs"
                  placeholder={`Exemplo:\n10 Refrigerante Coca Cola 2L R$14,90\n5 Gelo 5kg R$12,00`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <GhostButton onClick={() => setShowTextImportModal(false)}>Cancelar</GhostButton>
                <PrimaryButton disabled={ocrLoading || !textImportValue.trim()} onClick={handleTextExtraction}>
                  <Sparkles className="h-4 w-4" /> {ocrLoading ? "Analisando..." : "Analisar"}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-background/80" onClick={() => setShowReceiptModal(false)} />
          <div className="relative max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 sm:rounded-2xl sm:p-6">
            <h3 className="font-display text-lg font-bold">Lançar por foto da notinha</h3>
            <p className="text-sm text-muted-foreground">Envie imagem ou PDF. Vamos pré-preencher e você revisa antes de salvar.</p>
            <input type="file" accept="image/*,.pdf" capture="environment" onChange={(e)=>{const f=e.target.files?.[0]; if(!f)return; setReceiptFile(f); setReceiptPreview(URL.createObjectURL(f));}} />
            <div className="flex gap-2">
              <PrimaryButton disabled={!receiptFile||ocrLoading} onClick={async ()=>{ if(!receiptFile) return; await handleReceiptExtraction(receiptFile); setShowReceiptModal(false); setShowModal(true);}}>
                <Sparkles className="h-4 w-4" /> {ocrLoading ? "Lendo..." : "Ler automaticamente"}
              </PrimaryButton>
              <GhostButton onClick={()=>{setShowReceiptModal(false); setShowModal(true);}}>Preencher manualmente</GhostButton>
            </div>
            {receiptPreview && <a className="text-xs text-primary underline" href={receiptPreview} target="_blank">Visualizar anexo selecionado</a>}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => { setShowModal(false); setEditingExpenseId(null); }}
          />
          <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl animate-in zoom-in-95 duration-200 sm:rounded-2xl">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-primary/5">
              <h2 className="font-display text-lg font-bold">{editingExpenseId ? "Editar Lançamento Financeiro" : "Novo Lançamento Financeiro"}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full hover:bg-border flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(92dvh-8.5rem)] overflow-y-auto p-4 scrollbar-thin sm:p-6">
              {form.ocr_raw_text && (
                <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm">Dados extraídos da notinha</h3>
                    {(form as any).ocr_metadata?.confidence > 0 && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Confiança: {Math.round((form as any).ocr_metadata.confidence)}%
                      </span>
                    )}
                  </div>
                  
                  {(form as any).review_status === "Erro na leitura" ? (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                      Não conseguimos ler todos os dados da notinha. Preencha ou revise manualmente.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                        <strong>Campos identificados:</strong>
                        {((form as any).auto_filled_fields || []).map((f: string) => (
                          <span key={f} className="px-1.5 py-0.5 bg-background rounded border border-border text-[10px] uppercase font-bold">
                            {f.replace("supplier_", "").replace("_", " ")}
                          </span>
                        ))}
                        {((form as any).auto_filled_fields || []).length === 0 && "Nenhum campo estruturado encontrado"}
                      </div>
                      
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary font-medium hover:underline">Ver texto bruto extraído</summary>
                        <div className="mt-2 p-3 bg-background border border-border rounded-lg max-h-32 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                          {form.ocr_raw_text}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow">Tipo de Lançamento</label>
                  <select
                    value={form.entry_type || "Despesa"}
                    onChange={(e) => {
                      const entryType = e.target.value as FinancialEntryType;
                      setForm((p) => ({
                        ...p,
                        entry_type: entryType,
                        category: entryType === "Receita" ? "Outros" : p.category,
                        payment_method:
                          entryType === "Receita"
                            ? "Não informado"
                            : entryType === "Alocação Interna"
                              ? "Interno/Estoque"
                              : (p.payment_method === "Interno/Estoque" ? "PIX Goat" : p.payment_method),
                        payment_payer_name: entryType === "Receita" ? "" : p.payment_payer_name,
                        personal_reimbursed: entryType === "Receita" ? false : p.personal_reimbursed,
                        personal_reimbursed_at: entryType === "Receita" ? null : p.personal_reimbursed_at,
                        status: entryType === "Receita" || entryType === "Alocação Interna" ? "Pago" : p.status,
                      }));
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Despesa">Despesa / Compra</option>
                    <option value="Receita">Receita / Entrada</option>
                    <option value="Alocação Interna">Alocação Interna de Estoque</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="label-eyebrow">{form.entry_type === "Receita" ? "Descrição da Receita" : "O que foi comprado / lançado"}</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl bg-input border border-border focus:border-primary outline-none font-medium"
                    placeholder="Ex: Compra de Limão Cravo (Mercado Municipal)"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">{form.entry_type === "Receita" ? "Data da Receita" : "Data do Gasto"}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Valor (R$)</label>
                  <input
                    type="number"
                    value={form.amount || ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        amount: e.target.value === "" ? 0 : Number(e.target.value),
                      }))
                    }
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none font-bold text-primary"
                    placeholder="0,00"
                  />
                </div>

                {form.entry_type === "Despesa" && (
                  <>
                    <div>
                      <label className="label-eyebrow">Quantidade</label>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={(form.items || [])[0]?.quantity || 1}
                        onChange={(e) => setForm((p) => {
                          const current = (p.items || [{ product_name: p.description || "", quantity: 1, unit: "un", unit_price: 0, total_price: 0 }]).slice();
                          current[0] = { ...current[0], quantity: Number(e.target.value || 0), product_name: current[0].product_name || p.description || "" };
                          return { ...p, items: current };
                        })}
                        className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                      />
                    </div>
                    <div>
                      <label className="label-eyebrow">Unidade</label>
                      <input
                        value={(form.items || [])[0]?.unit || "un"}
                        onChange={(e) => setForm((p) => {
                          const current = (p.items || [{ product_name: p.description || "", quantity: 1, unit: "un", unit_price: 0, total_price: 0 }]).slice();
                          current[0] = { ...current[0], unit: e.target.value, product_name: current[0].product_name || p.description || "" };
                          return { ...p, items: current };
                        })}
                        className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                        placeholder="un, garrafa, caixa, kg..."
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="label-eyebrow">Modalidade</label>
                  <select
                    value={form.modality}
                    onChange={(e) => {
                      const next = e.target.value as FinancialModality;
                      setForm((p) => ({ ...p, modality: next, event_id: (next === "Evento" || next === "Degustação") ? p.event_id : "" }));
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Evento">Evento</option>
                    <option value="Goat Botequim">Goat Botequim</option>
                    <option value="7 Steak House">7 Steak House</option>
                    <option value="Degustação">Degustação</option>
                    <option value="Ativo">Ativo</option>
                  </select>
                </div>
                
                {(form.modality === "Evento" || form.modality === "Degustação") && (
                  <div>
                    <label className="label-eyebrow">{form.modality === "Degustação" ? "Evento da Degustação" : "Evento Relacionado"}</label>
                    <select
                      value={form.event_id || ""}
                      onChange={(e) => setForm((p) => ({ ...p, event_id: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none border-primary/50"
                    >
                      <option value="">Selecione um evento...</option>
                      {eventsList.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.event_name || ev.client_name} - {ev.date}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={form.entry_type === "Receita" ? "hidden" : ""}>
                  <label className="label-eyebrow">Tipo de Gasto</label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value as FinancialCategory }))
                    }
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Fornecedor">Fornecedor</option>
                    <option value="Equipe">Equipe / Freelancer</option>
                    <option value="Insumos">Insumos (Bebidas/Frutas)</option>
                    <option value="Operacional">Operacional (Gelo/Transporte)</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {form.category === "Fornecedor" && (
                  <div className="space-y-4 md:col-span-2 animate-in slide-in-from-left-2">
                    <label className="label-eyebrow">Nome do Fornecedor / Empresa</label>
                    <input
                      type="text"
                      value={form.supplier_name || ""}
                      onChange={(e) => setForm((p) => ({ ...p, supplier_name: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                      placeholder="Ex: Atacadão S/A"
                    />
                  </div>
                )}

                <div className={form.entry_type === "Receita" ? "hidden" : ""}>
                  <label className="label-eyebrow">CNPJ</label>
                  <input
                    type="text"
                    value={(form as any).supplier_cnpj || ""}
                    onChange={(e) => setForm((p) => ({ ...p, supplier_cnpj: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                    placeholder="00.000.000/0000-00"
                    />
                  </div>

                {form.category === "Equipe" && (
                  <>
                    <div className="space-y-4 animate-in slide-in-from-left-2">
                      <label className="label-eyebrow">Nome do Profissional</label>
                      <input
                        type="text"
                        value={form.staff_name || ""}
                        onChange={(e) => setForm((p) => ({ ...p, staff_name: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                        placeholder="Nome Completo"
                      />
                    </div>
                    <div className="space-y-4 animate-in slide-in-from-left-2">
                      <label className="label-eyebrow">Função / Cargo</label>
                      <input
                        type="text"
                        value={form.staff_role || ""}
                        onChange={(e) => setForm((p) => ({ ...p, staff_role: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                        placeholder="Ex: Bartender / Keeper"
                      />
                    </div>
                  </>
                )}

                <div className={form.entry_type === "Receita" ? "hidden" : ""}>
                  <label className="label-eyebrow">Data Prevista Pagto (Vencimento)</label>
                  <input
                    type="date"
                    value={form.due_date || ""}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  />
                </div>

                <div className={form.entry_type === "Receita" ? "hidden" : ""}>
                  <label className="label-eyebrow">Responsável pela Compra</label>
                  <input
                    type="text"
                    value={form.responsible}
                    onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                    placeholder="Quem comprou?"
                  />
                </div>

                <div className={form.entry_type === "Receita" ? "hidden" : ""}>
                  <label className="label-eyebrow">Método Pagto</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => {
                      const method = e.target.value as PaymentMethod;
                      setForm((p) => ({
                        ...p,
                        payment_method: method,
                        payment_payer_name: method === "Pessoal" ? p.payment_payer_name : "",
                        personal_reimbursed: method === "Pessoal" ? p.personal_reimbursed : false,
                        personal_reimbursed_at: method === "Pessoal" ? p.personal_reimbursed_at : null,
                      }));
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Cartão de crédito Goat">Cartão de crédito Goat</option>
                    <option value="PIX Goat">PIX Goat</option>
                    <option value="Pessoal">Pessoal</option>
                    <option value="Interno/Estoque">Interno/Estoque</option>
                    <option value="Não informado">Não informado</option>
                  </select>
                </div>

                {form.payment_method === "Pessoal" && form.entry_type === "Despesa" && (
                  <>
                    <div>
                      <label className="label-eyebrow">Quem fez o pagamento pessoal?</label>
                      <input
                        value={form.payment_payer_name || ""}
                        onChange={(e) => setForm((p) => ({ ...p, payment_payer_name: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                        placeholder="Nome da pessoa"
                      />
                    </div>
                    {form.status === "Pago" && (
                      <div>
                        <label className="label-eyebrow">Reembolso</label>
                        <select
                          value={form.personal_reimbursed ? "reimbursed" : "pending"}
                          onChange={(e) => {
                            const reimbursed = e.target.value === "reimbursed";
                            setForm((p) => ({
                              ...p,
                              personal_reimbursed: reimbursed,
                              personal_reimbursed_at: reimbursed
                                ? p.personal_reimbursed_at || new Date().toISOString()
                                : null,
                            }));
                          }}
                          className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                        >
                          <option value="pending">Reembolso pendente</option>
                          <option value="reimbursed">Reembolsado</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="label-eyebrow">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => {
                      const status = e.target.value as FinancialStatus;
                      setForm((p) => ({
                        ...p,
                        status,
                        payment_method:
                          status === "Pendente" ? "Não informado" : p.payment_method,
                        payment_payer_name: status === "Pendente" ? "" : p.payment_payer_name,
                        personal_reimbursed: status === "Pendente" ? false : p.personal_reimbursed,
                        personal_reimbursed_at: status === "Pendente" ? null : p.personal_reimbursed_at,
                      }));
                    }}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Pendente">Em aberto</option>
                    <option value="Pago">Pago</option>
                  </select>
                </div>

                <div className={form.entry_type === "Receita" ? "hidden" : ""}>
                  <label className="label-eyebrow">Classificação</label>
                  <select
                    value={form.classification}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        classification: e.target.value as FinancialClassification,
                      }))
                    }
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Direto">Custo Direto</option>
                    <option value="Indireto">Custo Indireto</option>
                  </select>
                </div>

                {/* FILE UPLOADS */}
                <div className="md:col-span-2 pt-4 border-t border-border grid grid-cols-2 gap-4">
                  <div className={`space-y-2 ${form.entry_type === "Receita" ? "hidden" : ""}`}>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3 w-3" /> Nota Fiscal (Print)
                    </label>
                    <div className="relative group">
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(e, "invoice")}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        accept="image/*"
                      />
                      <div
                        className={`h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors ${form.invoice_url ? "bg-primary/5 border-primary/40" : "bg-background border-border group-hover:border-primary/40"}`}
                      >
                        {uploading.invoice ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : form.invoice_url ? (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        ) : (
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-[9px] font-bold mt-1 text-muted-foreground">
                          {form.invoice_url ? "ALTERAR" : "UPLOAD"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Receipt className="h-3 w-3" /> {form.entry_type === "Receita" ? "Comprovante da Receita" : "Comprovante Pagto"}
                    </label>
                    <div className="relative group">
                      <input
                        type="file"
                        onChange={(e) => handleFileUpload(e, "receipt")}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        accept="image/*"
                      />
                      <div
                        className={`h-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-colors ${form.receipt_url ? "bg-emerald-50 border-emerald-500/30" : "bg-background border-border group-hover:border-primary/40"}`}
                      >
                        {uploading.receipt ? (
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        ) : form.receipt_url ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-[9px] font-bold mt-1 text-muted-foreground">
                          {form.receipt_url ? "ALTERAR" : "UPLOAD"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              {form.entry_type !== "Receita" && (
              <div className="mt-6 border-t border-border pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">Itens da Compra</h3>
                  <button 
                    onClick={() => {
                      const newItems = [...(form.items || [])];
                      newItems.push({ product_name: "", quantity: 1, unit: "un", unit_price: 0, total_price: 0 });
                      setForm(p => ({ ...p, items: newItems }));
                    }}
                    className="text-xs font-bold px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition"
                  >
                    + Adicionar Item
                  </button>
                </div>
                
                {form.items && form.items.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-primary/5 text-left border-b border-border">
                        <tr>
                          <th className="p-2 font-bold min-w-[150px]">Produto</th>
                          <th className="p-2 font-bold w-[70px]">Qtd</th>
                          <th className="p-2 font-bold w-[60px]">Unid.</th>
                          <th className="p-2 font-bold w-[90px]">Vlr Unit.</th>
                          <th className="p-2 font-bold w-[90px]">Vlr Total</th>
                          <th className="p-2 font-bold w-[40px]"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.items.map((it, idx) => (
                          <tr key={idx} className="border-b border-border/50">
                            <td className="p-1">
                              <div className="flex flex-col gap-1 py-1">
                                <input type="text" className="w-full h-8 px-2 bg-transparent outline-none border border-transparent focus:border-primary/30 rounded font-medium" value={it.product_name} onChange={e => {
                                  const newItems = [...form.items!];
                                  newItems[idx].product_name = e.target.value;
                                  setForm(p => ({ ...p, items: newItems }));
                                }} />
                                {it.raw_product_name && (
                                  <div className="px-2">
                                    {it.matched_product_id ? (
                                      <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center w-fit gap-1 border border-emerald-200" title={`Lido como: ${it.raw_product_name}`}><CheckCircle2 className="w-3 h-3"/> Vinculado ({Math.round((it.matched_confidence || 1)*100)}%)</span>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded flex items-center w-fit gap-1 border border-destructive/20" title={`Lido como: ${it.raw_product_name}`}><AlertCircle className="w-3 h-3"/> Não encontrado</span>
                                        <a href="/inventario" target="_blank" className="text-[9px] text-primary hover:underline font-bold bg-primary/10 px-1.5 py-0.5 rounded">Cadastrar novo</a>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-1">
                              <input type="number" className="w-full h-8 px-2 bg-transparent outline-none border border-transparent focus:border-primary/30 rounded" value={it.quantity} onChange={e => {
                                const newItems = [...form.items!];
                                newItems[idx].quantity = Number(e.target.value);
                                newItems[idx].total_price = newItems[idx].quantity * newItems[idx].unit_price;
                                setForm(p => ({ ...p, items: newItems }));
                              }} />
                            </td>
                            <td className="p-1">
                              <input type="text" className="w-full h-8 px-2 bg-transparent outline-none border border-transparent focus:border-primary/30 rounded" value={it.unit} onChange={e => {
                                const newItems = [...form.items!];
                                newItems[idx].unit = e.target.value;
                                setForm(p => ({ ...p, items: newItems }));
                              }} />
                            </td>
                            <td className="p-1">
                              <input type="number" className="w-full h-8 px-2 bg-transparent outline-none border border-transparent focus:border-primary/30 rounded" value={it.unit_price} onChange={e => {
                                const newItems = [...form.items!];
                                newItems[idx].unit_price = Number(e.target.value);
                                newItems[idx].total_price = newItems[idx].quantity * newItems[idx].unit_price;
                                setForm(p => ({ ...p, items: newItems }));
                              }} />
                            </td>
                            <td className="p-1">
                              <input type="number" className="w-full h-8 px-2 bg-transparent outline-none border border-transparent focus:border-primary/30 rounded font-medium text-primary" value={it.total_price} onChange={e => {
                                const newItems = [...form.items!];
                                newItems[idx].total_price = Number(e.target.value);
                                setForm(p => ({ ...p, items: newItems }));
                              }} />
                            </td>
                            <td className="p-1 text-center">
                              <button onClick={() => {
                                const newItems = form.items!.filter((_, i) => i !== idx);
                                setForm(p => ({ ...p, items: newItems }));
                              }} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                    Nenhum item extraído ou adicionado.
                  </div>
                )}
                
                {form.items && form.items.length > 0 && form.amount !== undefined && (
                  (() => {
                    const sum = form.items.reduce((acc, it) => acc + (Number(it.total_price) || 0), 0);
                    if (Math.abs(sum - Number(form.amount)) > 0.5) {
                      return (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>Atenção:</strong> A soma dos itens (R$ {sum.toFixed(2)}) não bate com o valor total da nota (R$ {Number(form.amount).toFixed(2)}). Revise os valores antes de confirmar.
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}
              </div>
              )}

            </div>
            
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-primary/5 p-4 sm:flex-row sm:justify-end sm:gap-3 sm:p-6">
              <GhostButton onClick={() => { setShowModal(false); setEditingExpenseId(null); }}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={handleSubmit}
                disabled={uploading.invoice || uploading.receipt}
              >
                {editingExpenseId ? "Salvar Alterações" : "Confirmar Lançamento"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <div
      className={`h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
    />
  );
}





