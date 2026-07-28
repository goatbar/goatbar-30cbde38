import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { SectionCard, PrimaryButton, GhostButton } from "@/components/ui-bits";
import { fmtBRL } from "@/lib/format";
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
  FileCheck,
  Eye,
  Edit,
  Trash2,
  Code,
  FileSignature,
  Paperclip,
  Save,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  contractTemplatesService,
  contractSignersService,
  glasswareService,
  eventContractsService,
  renderContractTemplate,
  getTemplateContent,
  DEFAULT_CONTRACT_BODY,
  type ContractTemplate,
  type ContractSigner,
  type Glassware,
} from "@/services/contract-service";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contratos")({
  component: () => (
    <AppShell>
      <ContratosPage />
    </AppShell>
  ),
});

const tabs = [
  { id: "contratos", label: "Contratos Gerados", icon: FileText },
  { id: "templates", label: "Templates & Mapeamento", icon: Code },
  { id: "socios", label: "Sócios Assinantes", icon: Users },
  { id: "copos", label: "Copos / Utensílios", icon: Wine },
];

export const VARIABLE_CATEGORIES = [
  {
    category: "👤 Dados do Contratante (Cliente)",
    variables: [
      { key: "cliente_nome", label: "Nome do Cliente", desc: "Nome completo ou Razão Social" },
      { key: "cliente_documento", label: "CPF / CNPJ", desc: "Documento de identificação" },
      { key: "cliente_endereco", label: "Endereço do Cliente", desc: "Logradouro, número e bairro" },
      { key: "cliente_email", label: "E-mail de Contato", desc: "Endereço de e-mail" },
      { key: "cliente_telefone", label: "Telefone / WhatsApp", desc: "Número de telefone" },
    ],
  },
  {
    category: "🥂 Dados do Evento",
    variables: [
      { key: "evento_nome", label: "Nome do Evento", desc: "Ex: Casamento Ana & Pedro" },
      { key: "evento_tipo", label: "Tipo de Evento", desc: "Casamento, Aniversário, Corporativo" },
      { key: "evento_data", label: "Data do Evento", desc: "Data formatada (DD/MM/AAAA)" },
      { key: "evento_horario", label: "Horário de Início", desc: "Horário programado" },
      { key: "evento_local", label: "Local do Evento", desc: "Espaço ou salão de festas" },
      { key: "evento_cidade", label: "Cidade", desc: "Cidade da realização" },
      { key: "evento_convidados", label: "Qtd. Convidados", desc: "Número total de pessoas" },
    ],
  },
  {
    category: "🍹 Cardápio de Bebidas & Utensílios",
    variables: [
      { key: "drinks_lista", label: "Lista dos Drinks", desc: "Nomes dos coquetéis inclusos" },
      { key: "bebidas_descricao", label: "Descrição do Cardápio", desc: "Detalhamento de insumos e marcas" },
      { key: "tabela_reposicao", label: "Tabela de Reposição de Copos", desc: "Valores por unidade em caso de quebra" },
    ],
  },
  {
    category: "💰 Valores & Condições Financeiras",
    variables: [
      { key: "evento_valor_total", label: "Valor Total (R$)", desc: "Valor final do orçamento" },
      { key: "evento_forma_pagamento", label: "Forma de Pagamento", desc: "Parcelas e condições" },
    ],
  },
  {
    category: "✒️ Representante GOAT Bar & Emissão",
    variables: [
      { key: "socio_nome", label: "Nome Sócio Goat", desc: "Representante legal da contratada" },
      { key: "socio_cpf", label: "CPF Sócio Goat", desc: "Documento do sócio assinante" },
      { key: "socio_cargo", label: "Cargo Sócio Goat", desc: "Ex: Sócio Diretor" },
      { key: "data_emissao", label: "Data de Emissão", desc: "Data de assinatura/geração" },
    ],
  },
];

export const ALL_VARIABLES = VARIABLE_CATEGORIES.flatMap((c) => c.variables);

const SAMPLE_VARIABLES: Record<string, string> = {
  cliente_nome: "Maria Fernanda Oliveira",
  cliente_documento: "123.456.789-00",
  cliente_endereco: "Av. Paulista, 1000, Apto 42 - São Paulo/SP",
  cliente_email: "maria.fernanda@email.com",
  cliente_telefone: "(11) 98765-4321",
  evento_nome: "Casamento Maria & Lucas",
  evento_tipo: "Casamento",
  evento_data: "15/11/2026",
  evento_horario: "19:00",
  evento_local: "Espaço Villa Bisutti",
  evento_cidade: "São Paulo",
  evento_convidados: "150",
  evento_valor_total: "R$ 6.800,00",
  evento_forma_pagamento: "50% no ato + 50% até 5 dias antes do evento",
  drinks_lista: "Gin Tônica Tradicional, Mosco Mule, Penicillin, Aperol Spritz, Caipirinha de Frutas Vermelhas",
  bebidas_descricao: "Bebidas premium, insumos frescos, xaropes artesanais e gelo translúcido fornecido pela GOAT Bar.",
  tabela_reposicao: "• Taça Gin Crystal 600ml: R$ 25,00 por unidade\n• Copo Baixo Old Fashioned: R$ 18,00 por unidade\n• Copo Long Drink: R$ 15,00 por unidade",
  socio_nome: "Gabriel Santos Silva",
  socio_cpf: "987.654.321-11",
  socio_cargo: "Sócio Diretor",
  data_emissao: new Date().toLocaleDateString("pt-BR"),
};

function ContratosPage() {
  const [activeTab, setActiveTab] = useState("contratos");
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Estados Reais
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [signers, setSigners] = useState<ContractSigner[]>([]);
  const [glasswareList, setGlasswareList] = useState<Glassware[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Estados dos Modais
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [showGlasswareModal, setShowGlasswareModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);

  // Estados do Formulário de Template
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    is_default: false,
    content: DEFAULT_CONTRACT_BODY,
  });

  const [newSigner, setNewSigner] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Sócio Diretor",
    cpf: "",
    address: "",
  });

  const [newGlassware, setNewGlassware] = useState({
    name: "",
    type: "Copo",
    replacement_value: 15,
  });

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

      // Enriquecer lista de contratos com informações do evento
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

  const openCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      description: "",
      is_default: templates.length === 0,
      content: DEFAULT_CONTRACT_BODY,
    });
    setSelectedFile(null);
    setShowTemplateModal(true);
  };

  const openEditTemplateModal = (tpl: ContractTemplate) => {
    setEditingTemplate(tpl);
    const content = getTemplateContent(tpl);
    setTemplateForm({
      name: tpl.name,
      description: tpl.description || "",
      is_default: !!tpl.is_default,
      content: content,
    });
    setSelectedFile(null);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (tplId: string) => {
    if (!confirm("Tem certeza de que deseja excluir este modelo de contrato?")) return;
    try {
      await contractTemplatesService.deleteTemplate(tplId);
      loadData();
      alert("Modelo de contrato excluído.");
    } catch (e: any) {
      alert(`Erro ao excluir template: ${e.message}`);
    }
  };

  const copyVariableToClipboard = (varKey: string) => {
    const token = `{{${varKey}}}`;
    navigator.clipboard.writeText(token);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const insertVariableIntoTemplateContent = (varKey: string) => {
    const token = `{{${varKey}}}`;
    setTemplateForm((prev) => ({
      ...prev,
      content: prev.content + " " + token,
    }));
    copyVariableToClipboard(varKey);
  };

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    if (!file) return;

    // Se for arquivo de texto (.txt, .html, .md), lê o conteúdo diretamente
    if (file.name.endsWith(".txt") || file.name.endsWith(".html") || file.name.endsWith(".md") || file.type.startsWith("text/")) {
      try {
        const text = await file.text();
        if (text && text.trim().length > 10) {
          setTemplateForm((prev) => ({
            ...prev,
            content: text,
          }));
        }
      } catch (err) {
        console.warn("Não foi possível ler texto bruto do arquivo:", err);
      }
    }
  };

  const filteredContracts = contracts.filter(
    (c) =>
      (c.client_name || "").toLowerCase().includes(busca.toLowerCase()) ||
      (c.event_name || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      <PageHeader
        breadcrumb="Documentos"
        title="Contratos & Templates"
        subtitle="Gestão de modelos customizados, mapeamento de variáveis dinâmicas e sócios assinantes."
      />

      <div className="page-container grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Sidebar */}
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

        {/* Conteúdo Principais */}
        <div className="xl:col-span-9 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-2xl">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando dados do módulo de contratos...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: CONTRATOS GERADOS */}
              {activeTab === "contratos" && (
                <SectionCard
                  title="Contratos Gerados nos Eventos"
                  subtitle="Histórico de minutas e documentos formalizados vinculados aos eventos"
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
                      Nenhum contrato gerado ainda. Acesse a aba <b>Contrato</b> de qualquer evento para gerar documentos com preenchimento automático.
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
                                Modelo Utilizado: <b>{template?.name || "Template Personalizado"}</b> (v{ec.version || 1})
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

              {/* TAB 2: TEMPLATES & MAPEAMENTO */}
              {activeTab === "templates" && (
                <div className="space-y-6">
                  {/* Banner Guia de Variáveis Dinâmicas */}
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg">Mapeador de Campos Automáticos</h3>
                        <p className="text-xs text-muted-foreground">
                          Escreva ou edite a estrutura do seu contrato usando as tags abaixo. Ao emitir o contrato no evento, o sistema substituirá cada tag exatamente pelos dados informados pelo cliente e pelo orçamento!
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {VARIABLE_CATEGORIES.map((cat) => (
                        <div key={cat.category} className="space-y-1.5">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            {cat.category}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                            {cat.variables.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                onClick={() => copyVariableToClipboard(v.key)}
                                className="p-2 rounded-xl border border-border bg-surface hover:border-primary/50 text-left transition-all group flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="font-mono text-[10px] font-bold text-primary group-hover:underline">
                                    {`{{${v.key}}}`}
                                  </span>
                                  {copiedVar === v.key ? (
                                    <Check className="h-3 w-3 text-success shrink-0" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                                <span className="text-[10px] font-medium text-foreground truncate">{v.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <SectionCard
                    title="Seus Modelos de Contrato"
                    subtitle="Todos os modelos cadastrados no sistema. Você pode personalizar as cláusulas e quais campos deseja preencher."
                    action={
                      <PrimaryButton
                        onClick={openCreateTemplateModal}
                        className="h-9 px-4 text-sm font-bold shadow-md shadow-primary/20"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Novo Modelo de Contrato
                      </PrimaryButton>
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((t) => {
                        const content = getTemplateContent(t);
                        return (
                          <div
                            key={t.id}
                            className="p-5 border border-border rounded-2xl bg-surface relative group space-y-4 hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-display font-bold text-base flex items-center gap-2">
                                    {t.name}
                                    {t.is_default && (
                                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                                        Padrão
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {t.description || content.substring(0, 120) + "..."}
                                  </p>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-background border rounded-md text-muted-foreground shrink-0">
                                  {t.file_type || "TXT"}
                                </span>
                              </div>

                              {t.file_url && (
                                <div className="mt-3">
                                  <a
                                    href={t.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10"
                                  >
                                    <Paperclip className="h-3 w-3" /> Arquivo Original Anexado
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs">
                              <div className="flex items-center gap-1">
                                <GhostButton
                                  onClick={() => setPreviewTemplate(t)}
                                  className="h-8 text-xs font-semibold px-2.5"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> Prévia
                                </GhostButton>
                                <GhostButton
                                  onClick={() => openEditTemplateModal(t)}
                                  className="h-8 text-xs font-semibold px-2.5 text-primary hover:bg-primary/10"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" /> Editar
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
                        <div className="col-span-2 text-center py-12 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl space-y-3">
                          <p>Nenhum template personalizado cadastrado ainda.</p>
                          <p className="text-xs">
                            Clique em <b>"Novo Modelo de Contrato"</b> acima para criar seu modelo com as suas cláusulas e variáveis personalizadas!
                          </p>
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
                  subtitle="Representantes legais cadastrados para constar como contratada nos documentos"
                  action={
                    <PrimaryButton
                      onClick={() => setShowSignerModal(true)}
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
                        className={`p-4 border rounded-2xl flex justify-between items-center ${
                          s.is_active ? "border-border bg-surface shadow-sm" : "border-border/50 bg-background opacity-60"
                        }`}
                      >
                        <div>
                          <div className="font-display font-bold text-base flex items-center gap-2">
                            {s.name}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({s.role || "Sócio Diretor"})
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                            {s.cpf && <span>CPF: {s.cpf}</span>}
                            {s.email && <span>E-mail: {s.email}</span>}
                            {s.phone && <span>Tel: {s.phone}</span>}
                          </div>
                        </div>
                        <div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                              s.is_active ? "bg-success/15 text-success border border-success/20" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {s.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </div>
                    ))}

                    {signers.length === 0 && (
                      <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl">
                        Nenhum sócio cadastrado. Cadastre o sócio para preencher automaticamente as tags <code className="text-primary font-bold">{"{{socio_nome}}"}</code> e <code className="text-primary font-bold">{"{{socio_cpf}}"}</code>.
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* TAB 4: COPOS / UTENSÍLIOS */}
              {activeTab === "copos" && (
                <SectionCard
                  title="Copos e Utensílios"
                  subtitle="Tabela oficial de valores de reposição para inclusão automática na tag {{tabela_reposicao}}"
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

      {/* --- MODAIS --- */}

      {/* MODAL CRIAR / EDITAR TEMPLATE */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">
                  {editingTemplate ? `Editar Modelo: ${editingTemplate.name}` : "Novo Modelo de Contrato"}
                </h2>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1">Nome do Modelo *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="Ex: Contrato de Casamento GOAT 2026"
                    className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="label-eyebrow block mb-1">Descrição Breve</label>
                  <input
                    type="text"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="Ex: Modelo oficial para eventos sociais com bar completo"
                    className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-eyebrow">
                    Texto do Contrato com Mapeamento de Campos
                  </label>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Clique nas tags abaixo para inserir onde a informação deve ser gerada:
                  </span>
                </div>

                {/* Bar de Tags Inseríveis Organizadadas */}
                <div className="p-3 bg-background border border-border rounded-xl mb-3 space-y-2 max-h-48 overflow-y-auto">
                  {VARIABLE_CATEGORIES.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        {cat.category}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.variables.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            onClick={() => insertVariableIntoTemplateContent(v.key)}
                            className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
                            title={`Inserir {{${v.key}}} no texto do contrato`}
                          >
                            <span>+{`{{${v.key}}}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <textarea
                  value={templateForm.content}
                  onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                  rows={14}
                  className="w-full p-4 rounded-xl bg-input border border-border text-xs font-mono focus:border-primary focus:outline-none resize-y leading-relaxed shadow-inner"
                />
              </div>

              <div className="p-4 rounded-xl bg-background border border-border space-y-2">
                <label className="label-eyebrow block">Anexar ou Enviar Arquivo Original (Word, PDF ou Texto)</label>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt,.html"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-[11px] text-success font-medium">
                    ✓ Arquivo selecionado: <b>{selectedFile.name}</b>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={templateForm.is_default}
                  onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="is_default" className="text-xs text-muted-foreground cursor-pointer font-medium">
                  Definir este modelo como padrão principal para todos os novos eventos
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowTemplateModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  if (!templateForm.name) return alert("Preencha o nome do modelo de contrato.");
                  if (!templateForm.content || templateForm.content.trim().length < 10)
                    return alert("O texto do contrato não pode estar vazio.");

                  setUploading(true);
                  try {
                    let publicUrl = editingTemplate?.file_url || "";
                    let filePath = editingTemplate?.file_path || "";
                    let fileType = editingTemplate?.file_type || "TEXT";

                    if (selectedFile) {
                      const res = await contractTemplatesService.uploadTemplateFile(selectedFile);
                      publicUrl = res.publicUrl;
                      filePath = res.filePath;
                      fileType = selectedFile.name.split(".").pop() || "DOCX";
                    }

                    const payload = {
                      name: templateForm.name,
                      description: templateForm.content, // armazena o texto do contrato com as tags
                      file_url: publicUrl,
                      file_path: filePath,
                      file_type: fileType,
                      is_default: templateForm.is_default,
                      status: "active",
                      variables_schema: {
                        content: templateForm.content,
                        fields: ALL_VARIABLES.map((v) => v.key),
                      },
                    };

                    if (editingTemplate) {
                      await contractTemplatesService.updateTemplate(editingTemplate.id, payload);
                      if (templateForm.is_default) {
                        await contractTemplatesService.setDefaultTemplate(editingTemplate.id);
                      }
                      alert("Modelo de contrato atualizado com sucesso!");
                    } else {
                      const created = await contractTemplatesService.createTemplate(payload);
                      if (templateForm.is_default && created?.id) {
                        await contractTemplatesService.setDefaultTemplate(created.id);
                      }
                      alert("Modelo de contrato cadastrado com sucesso!");
                    }

                    setShowTemplateModal(false);
                    loadData();
                  } catch (e: any) {
                    console.error("Erro ao salvar template:", e);
                    alert(`Erro ao salvar modelo de contrato: ${e.message || "Erro desconhecido"}`);
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
                className="font-bold shadow-md shadow-primary/20"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingTemplate ? "Atualizar Modelo" : "Salvar Modelo de Contrato"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAR / TESTAR TEMPLATE */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> {previewTemplate.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Simulação de preenchimento automático com dados de demonstração
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
                <span className="font-bold text-primary">Simulação de Contrato Gerado:</span>
                <span className="text-muted-foreground">Substituição automática das tags em tempo real</span>
              </div>

              <div className="p-6 bg-background border border-border rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner">
                {renderContractTemplate(getTemplateContent(previewTemplate), SAMPLE_VARIABLES)}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton
                onClick={() => {
                  setPreviewTemplate(null);
                  openEditTemplateModal(previewTemplate);
                }}
                className="text-xs font-bold text-primary"
              >
                <Edit className="h-3.5 w-3.5 mr-1" /> Editar Este Modelo
              </GhostButton>
              <GhostButton onClick={() => setPreviewTemplate(null)}>Fechar</GhostButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SÓCIO */}
      {showSignerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">Novo Sócio Assinante</h2>
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
                    onChange={(e) => setNewSigner({ ...newSigner, cpf: e.target.value })}
                    placeholder="000.000.000-00"
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
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowSignerModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  if (!newSigner.name) return alert("Preencha o nome do sócio.");
                  await contractSignersService.createSigner(newSigner);
                  setShowSignerModal(false);
                  loadData();
                  alert("Sócio cadastrado com sucesso!");
                }}
                className="font-bold"
              >
                Salvar Sócio
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
