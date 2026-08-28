import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
import {
  formatBrazilianDocument,
  maskBrazilianDocumentInput,
  onlyDigits,
  validateBrazilianDocument,
} from "@/lib/format-document";
import {
  Plus,
  Download,
  FileText,
  Wine,
  Users,
  CheckCircle2,
  Loader2,
  Search,
  X,
  Copy,
  Sparkles,
  Check,
  Eye,
  Edit,
  Trash2,
  Code,
  FileSignature,
  Paperclip,
  Save,
  ArrowRightLeft,
  Upload,
  Layers,
  Building2,
  Calendar,
  UserCheck,
  DollarSign,
  GlassWater,
  FileCode,
  Zap,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import mammoth from "mammoth";
import {
  contractTemplatesService,
  contractSignersService,
  glasswareService,
  eventContractsService,
  renderContractTemplate,
  getTemplateContent,
  getTemplateMapping,
  type ContractTemplate,
  type ContractSigner,
  type Glassware,
} from "@/services/contract-service";
import { ContractEditorModal } from "@/components/contract-editor/ContractEditorModal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contratos")({
  component: () => (
    <AppShell>
      <ContratosPage />
    </AppShell>
  ),
});

const tabs = [
  { id: "contratos", label: "Contratos Emitidos", icon: FileText },
  { id: "templates", label: "Editor Visual de DOCX", icon: Upload },
  { id: "socios", label: "Sócios Assinantes", icon: Users },
  { id: "copos", label: "Copos / Utensílios", icon: Wine },
];

export interface FieldCategory {
  category: string;
  icon: any;
  fields: {
    key: string; // e.g. "cliente.nome"
    label: string;
    desc: string;
    sampleValue: string;
  }[];
}

export const EDITOR_CATEGORIES: FieldCategory[] = [
  {
    category: "🥂 Evento",
    icon: Calendar,
    fields: [
      { key: "evento.nome", label: "Nome do Evento", desc: "Ex: Casamento Maria & Lucas", sampleValue: "Casamento Maria & Lucas" },
      { key: "evento.tipo", label: "Tipo do Evento", desc: "Casamento, Aniversário, Corporativo", sampleValue: "Casamento" },
      { key: "evento.data", label: "Data do Evento", desc: "Data de realização (DD/MM/AAAA)", sampleValue: "15/11/2026" },
      { key: "evento.horario", label: "Horário de Início", desc: "Horário programado", sampleValue: "19:00" },
      { key: "evento.local", label: "Local do Evento", desc: "Espaço ou salão de festas", sampleValue: "Espaço Villa Bisutti" },
      { key: "evento.cidade", label: "Cidade", desc: "Cidade da realização", sampleValue: "São Paulo" },
      { key: "evento.convidados", label: "Número de Convidados", desc: "Total de convidados", sampleValue: "150" },
    ],
  },
  {
    category: "👤 Cliente",
    icon: UserCheck,
    fields: [
      { key: "cliente.nome", label: "Nome do Cliente", desc: "Nome completo ou Razão Social", sampleValue: "Maria Fernanda Oliveira" },
      { key: "cliente.documento", label: "CPF / CNPJ", desc: "Documento do contratante", sampleValue: "123.456.789-00" },
      { key: "cliente.telefone", label: "Telefone / WhatsApp", desc: "Número para contato", sampleValue: "(11) 98765-4321" },
      { key: "cliente.email", label: "E-mail de Contato", desc: "Endereço de e-mail", sampleValue: "maria.fernanda@email.com" },
      { key: "cliente.endereco", label: "Endereço do Cliente", desc: "Logradouro, número e bairro", sampleValue: "Av. Paulista, 1000, Apto 42 - São Paulo/SP" },
    ],
  },
  {
    category: "💰 Financeiro",
    icon: DollarSign,
    fields: [
      { key: "financeiro.valor_total", label: "Valor do Contrato", desc: "Valor total do orçamento", sampleValue: "R$ 6.800,00" },
      { key: "financeiro.valor_entrada", label: "Valor da Entrada", desc: "Valor do sinal/sinalizador", sampleValue: "R$ 3.400,00" },
      { key: "financeiro.saldo_restante", label: "Saldo Restante", desc: "Valor a quitar", sampleValue: "R$ 3.400,00" },
      { key: "financeiro.forma_pagamento", label: "Forma de Pagamento", desc: "Condições de parcelamento", sampleValue: "50% no ato + 50% até 5 dias antes" },
      { key: "financeiro.data_vencimento", label: "Data de Vencimento", desc: "Data limite para quitação", sampleValue: "10/11/2026" },
    ],
  },
  {
    category: "🏢 Empresa (GOAT Bar)",
    icon: Building2,
    fields: [
      { key: "empresa.nome", label: "Nome da Empresa", desc: "Razão social da contratada", sampleValue: "GOAT BAR EVENTOS LTDA" },
      { key: "empresa.cnpj", label: "CNPJ da Empresa", desc: "Documento da GOAT Bar", sampleValue: "42.123.456/0001-99" },
      { key: "empresa.endereco", label: "Endereço da Empresa", desc: "Sede comercial", sampleValue: "Av. Faria Lima, 2000 - SP" },
      { key: "empresa.responsavel", label: "Nome do Responsável / Sócio", desc: "Sócio representante", sampleValue: "Gabriel Santos Silva" },
      { key: "empresa.cpf_responsavel", label: "CPF do Responsável", desc: "Documento do sócio", sampleValue: "987.654.321-11" },
      { key: "empresa.cargo_responsavel", label: "Cargo do Responsável", desc: "Ex: Sócio Diretor", sampleValue: "Sócio Diretor" },
      { key: "empresa.endereco_responsavel", label: "Endereço do Responsável", desc: "Endereço do sócio", sampleValue: "Rua Haddock Lobo, 500 - SP" },
    ],
  },
  {
    category: "🍹 Cardápio & Utensílios",
    icon: GlassWater,
    fields: [
      { key: "cardapio.drinks", label: "Lista dos Drinks", desc: "Coquetéis inclusos", sampleValue: "Gin Tônica, Moscow Mule, Penicillin, Aperol Spritz" },
      { key: "cardapio.descricao", label: "Descrição do Cardápio", desc: "Detalhamento de insumos e marcas", sampleValue: "Insumos premium artesanais e gelo translúcido fornecido pela GOAT Bar." },
      { key: "cardapio.tabela_reposicao", label: "Tabela de Reposição de Copos", desc: "Valores por unidade em caso de quebra", sampleValue: "• Taça Gin: R$ 25,00\n• Copo Baixo: R$ 18,00" },
    ],
  },
  {
    category: "🗓️ Geral",
    icon: Calendar,
    fields: [
      { key: "geral.data_emissao", label: "Data de Emissão", desc: "Data de emissão do contrato", sampleValue: new Date().toLocaleDateString("pt-BR") },
    ],
  },
];

const SAMPLE_VARIABLES: Record<string, string> = {
  "evento.nome": "Casamento Maria & Lucas",
  "evento.tipo": "Casamento",
  "evento.data": "15/11/2026",
  "evento.horario": "19:00",
  "evento.local": "Espaço Villa Bisutti",
  "evento.cidade": "São Paulo",
  "evento.convidados": "150",
  "evento.valor_por_pessoa": "R$ 45,33",
  "cliente.nome": "Maria Fernanda Oliveira",
  "cliente.documento": "123.456.789-00",
  "cliente.telefone": "(11) 98765-4321",
  "cliente.email": "maria.fernanda@email.com",
  "cliente.endereco": "Av. Paulista, 1000, Apto 42 - São Paulo/SP",
  "financeiro.valor_total": "R$ 6.800,00",
  "financeiro.valor_entrada": "R$ 3.400,00",
  "financeiro.saldo_restante": "R$ 3.400,00",
  "financeiro.forma_pagamento": "50% no ato + 50% até 5 dias antes",
  "financeiro.data_vencimento": "10/11/2026",
  "empresa.nome": "GOAT BAR EVENTOS LTDA",
  "empresa.cnpj": "42.123.456/0001-99",
  "empresa.endereco": "Av. Faria Lima, 2000 - São Paulo/SP",
  "empresa.responsavel": "Gabriel Santos Silva",
  "empresa.cpf_responsavel": "987.654.321-11",
  "empresa.cargo_responsavel": "Sócio Diretor",
  "empresa.endereco_responsavel": "Rua Haddock Lobo, 500 - SP",
  "cardapio.drinks": "Gin Tônica, Moscow Mule, Penicillin, Aperol Spritz",
  "cardapio.descricao": "Insumos premium artesanais e gelo translúcido fornecido pela GOAT Bar.",
  "cardapio.tabela_reposicao": "• Taça Gin: R$ 25,00\n• Copo Baixo: R$ 18,00",
  "geral.data_emissao": new Date().toLocaleDateString("pt-BR"),
};

function ContratosPage() {
  const [activeTab, setActiveTab] = useState("contratos");
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  // Estados Reais
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [signers, setSigners] = useState<ContractSigner[]>([]);
  const [glasswareList, setGlasswareList] = useState<Glassware[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Estados dos Modais
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [editingSigner, setEditingSigner] = useState<ContractSigner | null>(null);
  const [showGlasswareModal, setShowGlasswareModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);

  // Estados do Editor Visual
  const [templateName, setTemplateName] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("🥂 Evento");
  const [selectedText, setSelectedText] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tps, sigs, glasses, rawContracts] = await Promise.all([
        contractTemplatesService.listTemplates(),
        contractSignersService.listSigners(),
        glasswareService.listGlassware(),
        eventContractsService.listAllContracts(),
      ]);

      const enrichedContracts = await Promise.all(
        (rawContracts || []).map(async (c: any) => {
          if (!c.event_id) return c;
          const { data: ev } = await supabase
            .from("events")
            .select("event_name, client_name, date")
            .eq("id", c.event_id)
            .maybeSingle();
          const { data: clientData } = await supabase
            .from("event_contract_client_data")
            .select("client_name")
            .eq("event_id", c.event_id)
            .maybeSingle();
          return {
            ...c,
            client_name: clientData?.client_name || ev?.client_name || "Cliente Desconhecido",
            event_name: ev?.event_name || ev?.client_name || "Evento",
            event_date: ev?.date,
          };
        })
      );

      setTemplates(tps || []);
      setSigners(sigs || []);
      setGlasswareList(glasses || []);
      setContracts(enrichedContracts || []);
    } catch (error) {
      console.error("Erro ao carregar dados de contratos:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditorModal = (tpl?: ContractTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setTemplateName(tpl.name);
      const content = getTemplateContent(tpl);
      setTemplateHtml(content);
      setIsDefault(!!tpl.is_default);
    } else {
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateHtml("");
      setIsDefault(templates.length === 0);
    }
    setSelectedFile(null);
    setSelectedText("");
    setShowEditorModal(true);
  };

  const handleDocxUpload = async (file: File | null) => {
    setSelectedFile(file);
    if (!file) return;

    if (!templateName) {
      setTemplateName(file.name.replace(/\.[^/.]+$/, ""));
    }

    try {
      if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (result.value) {
          setTemplateHtml(result.value);
        }
      } else {
        const text = await file.text();
        setTemplateHtml(text);
      }
    } catch (err) {
      console.error("Erro ao importar arquivo DOCX:", err);
      alert("Não foi possível ler o arquivo enviado. Certifique-se de que é um arquivo .docx válido.");
    }
  };

  const handleTextSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      setSelectedText(sel.toString().trim());
    }
  };

  const insertFieldIntoDocument = (fieldKey: string, fieldLabel: string) => {
    const placeholderToken = `{{${fieldKey}}}`;
    
    // Se houver seleção de texto no navegador
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      
      // Cria a tag visual estilizada (Chip)
      const chip = document.createElement("span");
      chip.className = "docx-field-chip";
      chip.contentEditable = "false";
      chip.innerText = placeholderToken;
      
      range.insertNode(chip);
      sel.removeAllRanges();
      
      if (editorRef.current) {
        setTemplateHtml(editorRef.current.innerHTML);
      }
      setSelectedText("");
      return;
    }

    // Se o usuário clicou no editor sem seleção
    if (editorRef.current) {
      const chipHtml = `<span class="docx-field-chip" contenteditable="false">${placeholderToken}</span>&nbsp;`;
      document.execCommand("insertHTML", false, chipHtml);
      setTemplateHtml(editorRef.current.innerHTML);
    } else {
      setTemplateHtml((prev) => prev + ` ${placeholderToken} `);
    }
  };

  const handleDeleteTemplate = async (tplId: string) => {
    if (!confirm("Tem certeza de que deseja excluir este modelo de contrato?")) return;
    try {
      await contractTemplatesService.deleteTemplate(tplId);
      loadData();
      alert("Modelo de contrato excluído com sucesso.");
    } catch (e: any) {
      alert(`Erro ao excluir template: ${e.message}`);
    }
  };

  const [newSigner, setNewSigner] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Sócio Diretor",
    cpf: "",
    address: "",
  });

  const openCreateSignerModal = () => {
    setEditingSigner(null);
    setNewSigner({
      name: "",
      email: "",
      phone: "",
      role: "Sócio Diretor",
      cpf: "",
      address: "",
    });
    setShowSignerModal(true);
  };
  const openEditSignerModal = (s: ContractSigner) => {
    setEditingSigner(s);
    setNewSigner({
      name: s.name || "",
      email: s.email || "",
      phone: s.phone || "",
      role: s.role || "Sócio Diretor",
      cpf: s.cpf || "",
      address: s.address || "",
    });
    setShowSignerModal(true);
  };

  const handleDeleteSigner = async (signerId: string) => {
    if (!confirm("Tem certeza de que deseja excluir este sócio assinante?")) return;
    try {
      await contractSignersService.deleteSigner(signerId);
      loadData();
      alert("Sócio assinante excluído com sucesso.");
    } catch (e: any) {
      alert(`Erro ao excluir sócio: ${e.message}`);
    }
  };
  const handleToggleSignerActive = async (signer: ContractSigner) => {
    try {
      await contractSignersService.updateSigner(signer.id, { is_active: !signer.is_active });
      loadData();
    } catch (e: any) {
      alert(`Erro ao atualizar status do sócio: ${e.message}`);
    }
  };

  const [newGlassware, setNewGlassware] = useState({
    name: "",
    type: "Copo",
    replacement_value: 15,
  });

  const filteredContracts = contracts.filter(
    (c) =>
      (c.client_name || "").toLowerCase().includes(busca.toLowerCase()) ||
      (c.event_name || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      {/* Estilos Globais para Badges e Estrutura DOCX do Editor */}
      <style>{`
        .docx-field-chip {
          background-color: rgba(99, 102, 241, 0.15) !important;
          color: #4f46e5 !important;
          border: 1px solid rgba(99, 102, 241, 0.35) !important;
          border-radius: 6px !important;
          padding: 2px 8px !important;
          font-family: monospace !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          display: inline-flex !important;
          align-items: center !important;
          margin: 0 2px !important;
          user-select: all !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
        }
        .docx-canvas-paper p {
          margin-bottom: 0.75rem;
          line-height: 1.6;
        }
        .docx-canvas-paper table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .docx-canvas-paper th, .docx-canvas-paper td {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
        }
        .docx-canvas-paper h1, .docx-canvas-paper h2, .docx-canvas-paper h3 {
          font-weight: 700;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
      `}</style>

      <PageHeader
        breadcrumb="Documentos"
        title="Contratos & Editor Visual DOCX"
        subtitle="Importe seus arquivos .DOCX e vincule os campos dinâmicos preservando a formatação original."
      />

      <div className="page-container grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Sidebar Tabs */}
        <aside className="xl:col-span-3 space-y-2">
          {tabs.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  activeTab === s.id
                    ? "bg-primary/10 border-primary text-foreground shadow-sm"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 text-primary" />
                {s.label}
              </button>
            );
          })}
        </aside>

        {/* Conteúdo Principal */}
        <div className="xl:col-span-9 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-2xl">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando módulo de contratos...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: CONTRATOS GERADOS */}
              {activeTab === "contratos" && (
                <SectionCard
                  title="Contratos Emitidos"
                  subtitle="Histórico de documentos gerados para os eventos da GOAT Bar"
                  action={
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar por cliente ou evento..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-9 pr-4 py-1.5 rounded-lg border border-border bg-background text-xs focus:border-primary focus:outline-none w-60"
                      />
                    </div>
                  }
                >
                  {filteredContracts.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl">
                      Nenhum contrato gerado ainda. Acesse a aba <b>Contrato</b> de qualquer evento para emitir documentos com preenchimento automático.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredContracts.map((ec) => {
                        const template = templates.find((t) => t.id === ec.template_id);
                        return (
                          <div
                            key={ec.id}
                            className="p-5 border border-border bg-surface rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:border-primary/40 transition-colors shadow-sm"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <span className="font-display font-bold text-base">
                                  {ec.client_name}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    ec.status === "signed" || ec.status === "assinado"
                                      ? "bg-success/15 text-success border border-success/20"
                                      : "bg-warning/15 text-warning border border-warning/20"
                                  }`}
                                >
                                  {ec.status === "signed" ? "Assinado" : ec.status || "Minuta"}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{ec.event_name}</span>
                                {ec.event_date && (
                                  <>
                                    <span>•</span>
                                    <span>{new Date(ec.event_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                                  </>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground/80 mt-1">
                                Modelo: <b>{template?.name || "Modelo DOCX Customizado"}</b> (v{ec.version || 1})
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {ec.signed_file_url ? (
                                <PrimaryButton
                                  onClick={() => window.open(ec.signed_file_url, "_blank")}
                                  className="h-8 text-xs font-bold px-3"
                                >
                                  <Download className="h-3.5 w-3.5 mr-1" /> PDF Assinado
                                </PrimaryButton>
                              ) : (
                                <GhostButton
                                  onClick={() =>
                                    alert("Para visualizar ou reimprimir a minuta preenchida, acesse o evento correspondente na aba 'Contrato'.")
                                  }
                                  className="h-8 text-xs font-bold border"
                                >
                                  <FileSignature className="h-3.5 w-3.5 mr-1" /> Ver Minuta
                                </GhostButton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* TAB 2: EDITOR VISUAL DE DOCX */}
              {activeTab === "templates" && (
                <div className="space-y-6">
                  {/* Callout de Abertura do Editor */}
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0 shadow-inner">
                        <FileCode className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg">Editor Visual de Contratos (.DOCX)</h3>
                        <p className="text-xs text-muted-foreground max-w-xl">
                          Importe seu arquivo Word (.docx). O documento é aberto preservando 100% das tabelas, cabeçalhos e formatação original. Você pode selecionar o texto desejado e vinculá-lo a qualquer campo do sistema!
                        </p>
                      </div>
                    </div>
                    <PrimaryButton
                      onClick={() => openEditorModal()}
                      className="h-11 px-6 font-bold shadow-lg shadow-primary/20 shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-2" /> IMPORTAR MODELO (.DOCX)
                    </PrimaryButton>
                  </div>

                  <SectionCard
                    title="Seus Modelos de Contrato Cadastrados"
                    subtitle="Modelos de contrato editados e salvos no sistema"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((t) => {
                        const content = getTemplateContent(t);
                        return (
                          <div
                            key={t.id}
                            className="p-5 border border-border rounded-2xl bg-surface space-y-4 hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-display font-bold text-base flex items-center gap-2">
                                    {t.name}
                                    {t.is_default && (
                                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                                        Modelo Padrão
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {t.description || "Modelo de contrato com formatação preservada e campos dinâmicos."}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-background border rounded-md text-muted-foreground shrink-0">
                                  {t.file_type || "DOCX"}
                                </span>
                              </div>

                              {t.file_url && (
                                <div className="mt-3">
                                  <a
                                    href={t.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/10"
                                  >
                                    <Paperclip className="h-3.5 w-3.5" /> Arquivo Original .DOCX
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs">
                              <div className="flex items-center gap-2">
                                <PrimaryButton
                                  onClick={() => openEditorModal(t)}
                                  className="h-8 text-xs font-bold px-3"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" /> Abrir no Editor
                                </PrimaryButton>
                                <GhostButton
                                  onClick={() => setPreviewTemplate(t)}
                                  className="h-8 text-xs font-semibold px-2.5"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> Prévia
                                </GhostButton>
                              </div>

                              <div className="flex items-center gap-3">
                                {!t.is_default && (
                                  <button
                                    onClick={async () => {
                                      await contractTemplatesService.setDefaultTemplate(t.id);
                                      loadData();
                                    }}
                                    className="text-xs font-bold text-primary hover:underline"
                                  >
                                    Tornar Padrão
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTemplate(t.id)}
                                  className="text-xs text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors"
                                  title="Excluir Modelo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {templates.length === 0 && (
                        <div className="col-span-2 text-center py-16 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl space-y-4 bg-background/30">
                          <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                            <Upload className="h-8 w-8" />
                          </div>
                          <div>
                            <h4 className="font-display font-bold text-base text-foreground mb-1">Nenhum contrato importado ainda</h4>
                            <p className="text-xs max-w-md mx-auto">
                              Clique em <b>"IMPORTAR MODELO (.DOCX)"</b> para subir seu contrato Word, abrir a folha visual e vincular os campos dinâmicos.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* TAB 3: SÓCIOS ASSINANTES */}
              {activeTab === "socios" && (
                <SectionCard
                  title="Sócios Assinantes da GOAT Bar"
                  subtitle="Representantes legais cadastrados para constar como contratada nos contratos anexados"
                  action={
                    <PrimaryButton
                      onClick={openCreateSignerModal}
                      className="h-9 px-4 text-sm font-bold"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Novo Sócio
                    </PrimaryButton>
                  }
                >
                  <div className="space-y-3">
                    {signers.map((s) => (
                      <div
                        key={s.id}
                        className={`p-5 border rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                          s.is_active ? "border-border bg-surface shadow-sm" : "border-border/50 bg-background opacity-60"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-display font-bold text-base flex items-center gap-2">
                            {s.name}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({s.role || "Sócio Diretor"})
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                            {s.cpf && <span>CPF: <b>{formatBrazilianDocument(s.cpf)}</b></span>}
                            {s.email && <span>E-mail: <b>{s.email}</b></span>}
                            {s.phone && <span>Tel: <b>{s.phone}</b></span>}
                          </div>
                          {s.address && (
                            <div className="text-xs text-primary font-medium mt-1">
                              📍 Endereço: {s.address}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <GhostButton
                            onClick={() => openEditSignerModal(s)}
                            className="h-8 text-xs font-bold px-3 border text-primary hover:bg-primary/10"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                          </GhostButton>
                          <button
                            onClick={() => handleToggleSignerActive(s)}
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full cursor-pointer transition-opacity hover:opacity-80 ${
                              s.is_active ? "bg-success/15 text-success border border-success/20" : "bg-muted text-muted-foreground border"
                            }`}
                            title="Clique para alternar o status do sócio"
                          >
                            {s.is_active ? "Ativo" : "Inativo"}
                          </button>
                          <button
                            onClick={() => handleDeleteSigner(s.id)}
                            className="text-xs text-destructive hover:bg-destructive/10 p-2 rounded-xl transition-colors"
                            title="Excluir Sócio Assinante"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {signers.length === 0 && (
                      <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl">
                        Nenhum sócio cadastrado. Cadastre o representante legal para substituição do sócio assinante e seu endereço.
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* TAB 4: COPOS / UTENSÍLIOS */}
              {activeTab === "copos" && (
                <SectionCard
                  title="Copos e Utensílios"
                  subtitle="Tabela oficial de valores de reposição para quebras nos eventos"
                  action={
                    <PrimaryButton
                      onClick={() => setShowGlasswareModal(true)}
                      className="h-9 px-4 text-sm font-bold"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Novo Copo
                    </PrimaryButton>
                  }
                >
                  <div className="overflow-x-auto -mx-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left bg-background/50">
                          <th className="label-eyebrow px-6 py-3 border-y border-border">Nome do Utensílio</th>
                          <th className="label-eyebrow px-6 py-3 border-y border-border">Tipo</th>
                          <th className="label-eyebrow px-6 py-3 border-y border-border">Valor de Reposição</th>
                          <th className="label-eyebrow px-6 py-3 border-y border-border">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {glasswareList.map((g) => (
                          <tr key={g.id} className="border-b border-border/60 hover:bg-background/40 transition-colors">
                            <td className="px-6 py-3.5 font-bold">{g.name}</td>
                            <td className="px-6 py-3.5">{g.type || "Copo"}</td>
                            <td className="px-6 py-3.5 font-semibold text-primary">{fmtBRL(g.replacement_value)}</td>
                            <td className="px-6 py-3.5">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  g.is_active ? "bg-success/15 text-success border border-success/20" : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {g.is_active ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {glasswareList.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                              Nenhum item cadastrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- MODAL DO EDITOR VISUAL DE CONTRATOS (.DOCX) --- */}
      <ContractEditorModal
        template={editingTemplate}
        isOpen={showEditorModal}
        onClose={() => setShowEditorModal(false)}
        onSaved={loadData}
      />

      {/* MODAL VISUALIZAR PRÉVIA DO CONTRATO EDITADO */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> {previewTemplate.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Simulação do contrato preenchido com dados de demonstração da GOAT Bar
                </p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs flex justify-between items-center">
                <span className="font-bold text-primary">Prévia com Substituição Automática dos Campos:</span>
                <span className="text-muted-foreground">Formatação e tabelas preservadas</span>
              </div>

              <div
                className="p-8 bg-white text-slate-900 border border-border rounded-xl text-xs leading-relaxed shadow-inner docx-canvas-paper"
                dangerouslySetInnerHTML={{
                  __html: renderContractTemplate(
                    getTemplateContent(previewTemplate),
                    SAMPLE_VARIABLES,
                    getTemplateMapping(previewTemplate)
                  ),
                }}
              />
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton
                onClick={() => {
                  setPreviewTemplate(null);
                  openEditorModal(previewTemplate);
                }}
                className="text-xs font-bold text-primary"
              >
                <Edit className="h-3.5 w-3.5 mr-1" /> Abrir no Editor Visual
              </GhostButton>
              <GhostButton onClick={() => setPreviewTemplate(null)}>Fechar</GhostButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SÓCIO ASSINANTE */}
      {showSignerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">
                {editingSigner ? `Editar Sócio: ${editingSigner.name}` : "Novo Sócio Assinante"}
              </h2>
              <button
                onClick={() => setShowSignerModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-eyebrow block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={newSigner.name}
                  onChange={(e) => setNewSigner({ ...newSigner, name: e.target.value })}
                  placeholder="Ex: Gabriel Santos Silva"
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1">CPF</label>
                  <input
                    type="text"
                    value={newSigner.cpf}
                    onChange={(e) => setNewSigner({ ...newSigner, cpf: maskBrazilianDocumentInput(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm"
                  />
                </div>
                <div>
                  <label className="label-eyebrow block mb-1">Cargo</label>
                  <input
                    type="text"
                    value={newSigner.role}
                    onChange={(e) => setNewSigner({ ...newSigner, role: e.target.value })}
                    placeholder="Ex: Sócio Diretor"
                    className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1">E-mail</label>
                  <input
                    type="email"
                    value={newSigner.email}
                    onChange={(e) => setNewSigner({ ...newSigner, email: e.target.value })}
                    placeholder="socio@goatbar.com.br"
                    className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm"
                  />
                </div>
                <div>
                  <label className="label-eyebrow block mb-1">Telefone / Celular</label>
                  <input
                    type="text"
                    value={newSigner.phone}
                    onChange={(e) => setNewSigner({ ...newSigner, phone: e.target.value })}
                    placeholder="(11) 99999-8888"
                    className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="label-eyebrow block mb-1">Endereço Completo do Sócio</label>
                <input
                  type="text"
                  value={newSigner.address}
                  onChange={(e) => setNewSigner({ ...newSigner, address: e.target.value })}
                  placeholder="Ex: Rua Haddock Lobo, 500, Apto 12, Jardins - São Paulo/SP"
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowSignerModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  if (!newSigner.name) return alert("Preencha o nome do sócio.");
                  const payload = {
                    ...newSigner,
                    cpf: onlyDigits(newSigner.cpf),
                  };
                  if (payload.cpf) {
                    const val = validateBrazilianDocument(payload.cpf);
                    if (!val.valid) {
                      alert(`Documento do Sócio Inválido:\n${val.error || "O CPF informado é inválido."}`);
                      return;
                    }
                  }
                  if (editingSigner) {
                    await contractSignersService.updateSigner(editingSigner.id, payload);
                    alert("Dados do sócio atualizados com sucesso!");
                  } else {
                    await contractSignersService.createSigner(payload);
                    alert("Sócio cadastrado com sucesso!");
                  }
                  setShowSignerModal(false);
                  loadData();
                }}
                className="font-bold"
              >
                {editingSigner ? "Atualizar Sócio" : "Salvar Sócio"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COPO */}
      {showGlasswareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">Novo Copo / Utensílio</h2>
              <button
                onClick={() => setShowGlasswareModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-eyebrow block mb-1">Nome do Item *</label>
                <input
                  type="text"
                  value={newGlassware.name}
                  onChange={(e) => setNewGlassware({ ...newGlassware, name: e.target.value })}
                  placeholder="Ex: Taça Gin Crystal 600ml"
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-medium"
                />
              </div>
              <div>
                <label className="label-eyebrow block mb-1">Tipo</label>
                <select
                  value={newGlassware.type}
                  onChange={(e) => setNewGlassware({ ...newGlassware, type: e.target.value })}
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm"
                >
                  <option value="Taça">Taça</option>
                  <option value="Copo">Copo</option>
                  <option value="Caneca">Caneca</option>
                  <option value="Utensílio">Utensílio</option>
                </select>
              </div>
              <div>
                <label className="label-eyebrow block mb-1">Valor de Reposição (R$)</label>
                <input
                  type="number"
                  value={newGlassware.replacement_value}
                  onChange={(e) =>
                    setNewGlassware({ ...newGlassware, replacement_value: Number(e.target.value) })
                  }
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-bold"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowGlasswareModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  if (!newGlassware.name) return alert("Preencha o nome do item.");
                  await glasswareService.createGlassware(newGlassware);
                  setShowGlasswareModal(false);
                  loadData();
                  alert("Item cadastrado com sucesso!");
                }}
                className="font-bold"
              >
                Salvar Item
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


