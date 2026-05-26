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
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [filters, setFilters] = useState({
    start_date: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end_date: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    modality: "",
    status: "",
    category: "",
  });

  const [form, setForm] = useState<Partial<FinancialExpense>>({
    date: format(new Date(), "yyyy-MM-dd"),
    modality: "Geral",
    category: "Operacional",
    description: "",
    amount: 0,
    responsible: "",
    payment_method: "PIX",
    status: "Pendente",
    classification: "Direto",
  });

  const [uploading, setUploading] = useState<{ invoice?: boolean; receipt?: boolean; note?: boolean }>({});

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await financialService.listExpenses(filters);
      setExpenses(data);
    } catch (e) {
      console.error("Erro ao carregar gastos:", e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const total = expenses.reduce((a, b) => a + Number(b.amount), 0);
    const pago = expenses
      .filter((e) => e.status === "Pago")
      .reduce((a, b) => a + Number(b.amount), 0);
    const pendente = total - pago;
    const direto = expenses
      .filter((e) => e.classification === "Direto")
      .reduce((a, b) => a + Number(b.amount), 0);
    const percDireto = total > 0 ? (direto / total) * 100 : 0;

    return { total, pago, pendente, percDireto };
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
        payment_method: extracted.payment_method || prev.payment_method || "Outros",
        review_status: extracted.review_status,
        ocr_raw_text: extracted.raw_text,
        ocr_metadata: { confidence: extracted.confidence || 0, source: "ocr-receipt" },
        auto_filled_fields: extracted.auto_filled_fields,
        invoice_url: uploadedUrl,
      }));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount || !form.responsible) {
      alert("Preencha os campos obrigatórios.");
      return;
    }

    try {
      const manuallyEdited = ((form as any).auto_filled_fields || []).filter((field: string) => {
        const value = (form as any)[field];
        return value !== undefined && value !== null && String(value).trim() !== "";
      });
      const saved = await financialService.createExpense({ ...form, manually_edited_fields: manuallyEdited });
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
      fetchExpenses();
      setForm({
        date: format(new Date(), "yyyy-MM-dd"),
        modality: "Geral",
        category: "Operacional",
        description: "",
        amount: 0,
        responsible: "",
        payment_method: "PIX",
        status: "Pendente",
        classification: "Direto",
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

  const toggleStatus = async (expense: FinancialExpense) => {
    try {
      await financialService.updateExpense(expense.id, {
        status: expense.status === "Pago" ? "Pendente" : "Pago",
      });
      fetchExpenses();
    } catch (e) {
      alert("Erro ao atualizar status.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Controladoria"
        subtitle="Gestão financeira completa e fluxo de custos."
        action={
          <div className="flex gap-2">
            <GhostButton onClick={() => setShowReceiptModal(true)}>
              <Camera className="h-4 w-4" /> Lançar por foto da notinha
            </GhostButton>
            <PrimaryButton onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" /> Novo Gasto
            </PrimaryButton>
          </div>
        }
      />

      <div className="page-container space-y-7 max-w-[1600px] mx-auto w-full">
        {/* RESUMO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Total de Gastos"
            value={fmtBRL(totals.total)}
            trend="+12% vs mês anterior"
          />
          <StatCard
            label="Realizado (Pago)"
            value={fmtBRL(totals.pago)}
            icon={<CheckCircle2 className="text-emerald-500" />}
          />
          <StatCard
            label="Em Aberto (Pendente)"
            value={fmtBRL(totals.pendente)}
            icon={<AlertCircle className="text-amber-500" />}
          />
          <StatCard
            label="Custo Direto"
            value={`${totals.percDireto.toFixed(1)}%`}
            subtitle="Do volume total de gastos"
          />
        </div>

        {/* DASHBOARD CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
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
          <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl bg-surface border border-border">
            <div className="flex-1 min-w-[200px]">
              <label className="label-eyebrow block mb-1.5">Período</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-xs w-full"
                />
                <span className="text-muted-foreground">-</span>
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
                className="bg-background border border-border rounded-lg px-3 py-2 text-xs min-w-[140px]"
              >
                <option value="">Todas</option>
                <option value="Evento">Evento</option>
                <option value="Steakhouse">Steakhouse</option>
                <option value="Goatbotequim">Goatbotequim</option>
                <option value="Geral">Geral</option>
              </select>
            </div>
            <div>
              <label className="label-eyebrow block mb-1.5">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                className="bg-background border border-border rounded-lg px-3 py-2 text-xs min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="Pago">Pago</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
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
                        <StatusBadge variant={exp.status === "Pago" ? "success" : "warning"}>
                          {exp.status}
                        </StatusBadge>
                      </button>
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
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* MODAL NOVO GASTO */}

      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80" onClick={() => setShowReceiptModal(false)} />
          <div className="relative w-full max-w-xl bg-surface border border-border rounded-2xl p-6 space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-primary/5">
              <h2 className="font-display text-lg font-bold">Novo Lançamento Financeiro</h2>
              <button
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full hover:bg-border flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
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
                <div className="space-y-4 md:col-span-2">
                  <label className="label-eyebrow">Descrição do Gasto</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl bg-input border border-border focus:border-primary outline-none font-medium"
                    placeholder="Ex: Compra de Limão Cravo (Mercado Municipal)"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Data do Gasto</label>
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

                <div>
                  <label className="label-eyebrow">Modalidade</label>
                  <select
                    value={form.modality}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, modality: e.target.value as FinancialModality }))
                    }
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Evento">Evento</option>
                    <option value="Steakhouse">Steakhouse</option>
                    <option value="Goatbotequim">Goatbotequim</option>
                    <option value="Geral">Geral</option>
                  </select>
                </div>

                <div>
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

                <div>
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

                <div>
                  <label className="label-eyebrow">Data Prevista Pagto (Vencimento)</label>
                  <input
                    type="date"
                    value={form.due_date || ""}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Responsável pela Compra</label>
                  <input
                    type="text"
                    value={form.responsible}
                    onChange={(e) => setForm((p) => ({ ...p, responsible: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                    placeholder="Quem comprou?"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Método Pagto</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, payment_method: e.target.value as PaymentMethod }))
                    }
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, status: e.target.value as FinancialStatus }))
                    }
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border outline-none"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                  </select>
                </div>

                <div>
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
                  <div className="space-y-2">
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
                      <Receipt className="h-3 w-3" /> Comprovante Pagto
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
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3 bg-primary/5">
              <GhostButton onClick={() => setShowModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={handleSubmit}
                disabled={uploading.invoice || uploading.receipt}
              >
                Confirmar Lançamento
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
