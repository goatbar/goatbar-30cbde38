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
  Eye,
  Edit,
  Trash2,
  Code,
  FileSignature,
  Paperclip,
  Save,
  ArrowRightLeft,
  Upload,
} from "lucide-react";
import { useState, useEffect } from "react";
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
  { id: "templates", label: "Modelos Anexados & Match", icon: Upload },
  { id: "socios", label: "Sócios Assinantes", icon: Users },
  { id: "copos", label: "Copos / Utensílios", icon: Wine },
];

export interface SystemField {
  key: string;
  label: string;
  category: string;
  desc: string;
  defaultTag: string;
}

export const SystemFields: SystemField[] = [
  { key: "cliente_nome", label: "Nome / Razão Social do Cliente", category: "Cliente", desc: "Nome completo do contratante", defaultTag: "[NOME_CLIENTE]" },
  { key: "cliente_documento", label: "CPF / CNPJ do Cliente", category: "Cliente", desc: "Documento de identificação", defaultTag: "[CPF_CLIENTE]" },
  { key: "cliente_endereco", label: "Endereço do Cliente", category: "Cliente", desc: "Endereço residencial/comercial", defaultTag: "[ENDERECO_CLIENTE]" },
  { key: "cliente_email", label: "E-mail de Contato", category: "Cliente", desc: "E-mail para assinaturas e notificações", defaultTag: "[EMAIL_CLIENTE]" },
  { key: "cliente_telefone", label: "Telefone / WhatsApp", category: "Cliente", desc: "Número para contato", defaultTag: "[TELEFONE_CLIENTE]" },
  { key: "evento_nome", label: "Nome do Evento", category: "Evento", desc: "Nome da celebração (ex: Casamento Ana & Pedro)", defaultTag: "[NOME_EVENTO]" },
  { key: "evento_tipo", label: "Tipo do Evento", category: "Evento", desc: "Casamento, Aniversário, Corporativo", defaultTag: "[TIPO_EVENTO]" },
  { key: "evento_data", label: "Data do Evento", category: "Evento", desc: "Data de realização (DD/MM/AAAA)", defaultTag: "[DATA_EVENTO]" },
  { key: "evento_horario", label: "Horário de Início", category: "Evento", desc: "Horário programado para início", defaultTag: "[HORARIO_EVENTO]" },
  { key: "evento_local", label: "Local do Evento", category: "Evento", desc: "Nome do espaço / Salão", defaultTag: "[LOCAL_EVENTO]" },
  { key: "evento_cidade", label: "Cidade do Evento", category: "Evento", desc: "Cidade da realização", defaultTag: "[CIDADE_EVENTO]" },
  { key: "evento_convidados", label: "Qtd. de Convidados", category: "Evento", desc: "Número total de convidados", defaultTag: "[QTD_CONVIDADOS]" },
  { key: "drinks_lista", label: "Lista de Drinks / Coquetéis", category: "Cardápio", desc: "Nomes das bebidas inclusas", defaultTag: "[LISTA_DRINKS]" },
  { key: "bebidas_descricao", label: "Descrição do Cardápio", category: "Cardápio", desc: "Marcas, insumos e detalhes das bebidas", defaultTag: "[DESCRICAO_BEBIDAS]" },
  { key: "tabela_reposicao", label: "Tabela de Reposição de Copos", category: "Cardápio", desc: "Valores por unidade em caso de quebra", defaultTag: "[TABELA_REPOSICAO]" },
  { key: "evento_valor_total", label: "Valor Total do Orçamento", category: "Financeiro", desc: "Valor total do contrato (R$)", defaultTag: "[VALOR_TOTAL]" },
  { key: "evento_forma_pagamento", label: "Forma de Pagamento", category: "Financeiro", desc: "Condições e forma de pagamento acertadas", defaultTag: "[FORMA_PAGAMENTO]" },
  { key: "socio_nome", label: "Nome do Sócio GOAT Bar", category: "Representante", desc: "Sócio representante da contratada", defaultTag: "[SOCIO_GOAT]" },
  { key: "socio_cpf", label: "CPF do Sócio GOAT Bar", category: "Representante", desc: "Documento do sócio assinante", defaultTag: "[CPF_SOCIO_GOAT]" },
  { key: "socio_cargo", label: "Cargo do Sócio GOAT Bar", category: "Representante", desc: "Ex: Sócio Diretor", defaultTag: "[CARGO_SOCIO_GOAT]" },
  { key: "socio_endereco", label: "Endereço do Sócio GOAT Bar", category: "Representante", desc: "Endereço completo do sócio assinante", defaultTag: "[ENDERECO_SOCIO_GOAT]" },
  { key: "data_emissao", label: "Data de Emissão", category: "Geral", desc: "Data em que o contrato é gerado", defaultTag: "[DATA_EMISSAO]" },
];

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
  drinks_lista: "Gin Tônica Tradicional, Moscow Mule, Penicillin, Aperol Spritz, Caipirinha de Frutas Vermelhas",
  bebidas_descricao: "Bebidas premium, insumos frescos, xaropes artesanais e gelo translúcido fornecido pela GOAT Bar.",
  tabela_reposicao: "• Taça Gin Crystal 600ml: R$ 25,00 por unidade\n• Copo Baixo Old Fashioned: R$ 18,00 por unidade\n• Copo Long Drink: R$ 15,00 por unidade",
  socio_nome: "Gabriel Santos Silva",
  socio_cpf: "987.654.321-11",
  socio_cargo: "Sócio Diretor",
  socio_endereco: "Rua Haddock Lobo, 500, Jardins - São Paulo/SP",
  data_emissao: new Date().toLocaleDateString("pt-BR"),
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
  const [showUploadMatchModal, setShowUploadMatchModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [editingSigner, setEditingSigner] = useState<ContractSigner | null>(null);
  const [showGlasswareModal, setShowGlasswareModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);

  // Estados de Formulário do Template & Match
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const openUploadMatchModal = (tpl?: ContractTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setTemplateName(tpl.name);
      setTemplateContent(getTemplateContent(tpl));
      setIsDefault(!!tpl.is_default);
      
      const existingMapping = getTemplateMapping(tpl);
      // Preenche com o mapeamento existente ou valores padrão
      const initMap: Record<string, string> = {};
      SystemFields.forEach((f) => {
        initMap[f.key] = existingMapping[f.key] || f.defaultTag;
      });
      setFieldMapping(initMap);
    } else {
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateContent("");
      setIsDefault(templates.length === 0);
      
      const initMap: Record<string, string> = {};
      SystemFields.forEach((f) => {
        initMap[f.key] = f.defaultTag;
      });
      setFieldMapping(initMap);
    }
    setSelectedFile(null);
    setShowUploadMatchModal(true);
  };

  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    if (!file) return;

    if (!templateName) {
      setTemplateName(file.name.replace(/\.[^/.]+$/, ""));
    }

    // Se for arquivo de texto (.txt, .html, .md), lê o conteúdo
    if (file.name.endsWith(".txt") || file.name.endsWith(".html") || file.name.endsWith(".md") || file.type.startsWith("text/")) {
      try {
        const text = await file.text();
        if (text) setTemplateContent(text);
      } catch (err) {
        console.warn("Erro ao ler texto do arquivo:", err);
      }
    }
  };

  const autoMatchTagsInText = () => {
    if (!templateContent) return alert("Selecione um arquivo ou cole o texto do contrato primeiro.");

    const newMap = { ...fieldMapping };
    let matchesCount = 0;

    SystemFields.forEach((f) => {
      // Procura por variações no texto como [NOME_CLIENTE], {{cliente_nome}}, {CLIENTE_NOME}, etc.
      const patterns = [
        f.defaultTag,
        `{{${f.key}}}`,
        `{${f.key}}`,
        `[${f.key.toUpperCase()}]`,
        `[${f.label.toUpperCase()}]`,
      ];

      for (const p of patterns) {
        if (templateContent.toLowerCase().includes(p.toLowerCase())) {
          newMap[f.key] = p;
          matchesCount++;
          break;
        }
      }
    });

    setFieldMapping(newMap);
    alert(`${matchesCount} campo(s) foram auto-identificados no texto do seu contrato!`);
  };

  const handleDeleteTemplate = async (tplId: string) => {
    if (!confirm("Tem certeza de que deseja excluir este modelo anexado?")) return;
    try {
      await contractTemplatesService.deleteTemplate(tplId);
      loadData();
      alert("Modelo de contrato excluído com sucesso.");
    } catch (e: any) {
      alert(`Erro ao excluir template: ${e.message}`);
    }
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

  const filteredContracts = contracts.filter(
    (c) =>
      (c.client_name || "").toLowerCase().includes(busca.toLowerCase()) ||
      (c.event_name || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      <PageHeader
        breadcrumb="Documentos"
        title="Contratos & Upload de Modelos"
        subtitle="Anexe seu contrato original e faça o Match (De-Para) de campos para geração automática."
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

        {/* Conteúdo Principal */}
        <div className="xl:col-span-9 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-2xl">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando dados dos contratos...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: CONTRATOS GERADOS */}
              {activeTab === "contratos" && (
                <SectionCard
                  title="Contratos Emitidos"
                  subtitle="Histórico de contratos formalizados vinculados aos eventos da GOAT Bar"
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
                      Nenhum contrato gerado ainda. Acesse a aba <b>Contrato</b> de qualquer evento para emitir seu documento automaticamente.
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
                                Modelo Utilizado: <b>{template?.name || "Modelo Anexado"}</b> (v{ec.version || 1})
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

              {/* TAB 2: MODELOS ANEXADOS & MATCH (DE-PARA) */}
              {activeTab === "templates" && (
                <div className="space-y-6">
                  {/* Callout instrutivo */}
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0 shadow-inner">
                        <ArrowRightLeft className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg">Faça o Upload do Seu Modelo Original</h3>
                        <p className="text-xs text-muted-foreground max-w-xl">
                          Anexe o arquivo de contrato da GOAT Bar (Word, PDF ou Texto). Em seguida, faça o <b>Match de Campos</b> indicando quais tags do seu arquivo correspondem ao nome do cliente, valor do orçamento, lista de drinks, etc.
                        </p>
                      </div>
                    </div>
                    <PrimaryButton
                      onClick={() => openUploadMatchModal()}
                      className="h-11 px-6 font-bold shadow-lg shadow-primary/20 shrink-0"
                    >
                      <Upload className="h-4 w-4 mr-2" /> ANEXAR MEU CONTRATO
                    </PrimaryButton>
                  </div>

                  <SectionCard
                    title="Seus Contratos Anexados & Configurados"
                    subtitle="Modelos enviados por você com mapeamento de campos ativo"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((t) => {
                        const mapping = getTemplateMapping(t);
                        const mappedCount = Object.keys(mapping).filter((k) => mapping[k] && mapping[k].trim().length > 0).length;
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
                                        Padrão Oficial
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {mappedCount > 0 ? (
                                      <span className="text-success font-semibold">✓ {mappedCount} campos mapeados (Match OK)</span>
                                    ) : (
                                      <span className="text-warning font-semibold">⚠️ Mapeamento de campos pendente</span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-background border rounded-md text-muted-foreground shrink-0">
                                  {t.file_type || "ARQUIVO"}
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
                                    <Paperclip className="h-3.5 w-3.5" /> Baixar Arquivo Original Anexado
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs">
                              <div className="flex items-center gap-2">
                                <PrimaryButton
                                  onClick={() => openUploadMatchModal(t)}
                                  className="h-8 text-xs font-bold px-3"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Match de Campos
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
                            <h4 className="font-display font-bold text-base text-foreground mb-1">Nenhum contrato anexado ainda</h4>
                            <p className="text-xs max-w-md mx-auto">
                              Clique no botão <b>"ANEXAR MEU CONTRATO"</b> para subir seu arquivo (Word, PDF ou Texto) e fazer a correspondência dos campos.
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
                            {s.cpf && <span>CPF: <b>{s.cpf}</b></span>}
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

      {/* --- MODAL DE UPLOAD DE CONTRATO & MATCH DE CAMPOS (DE-PARA) --- */}
      {showUploadMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {editingTemplate ? `Match de Campos: ${editingTemplate.name}` : "Anexar Novo Contrato e Mapear Campos"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Faça a correspondência (De-Para) entre o seu contrato original e os dados do sistema GOAT Bar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadMatchModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Passo 1: Seleção de Arquivo e Nome */}
              <div className="p-5 rounded-2xl bg-background border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2">
                    <Upload className="h-4 w-4" /> 1. Arquivo de Contrato Original (Word / PDF / Texto)
                  </h3>
                  {selectedFile && (
                    <span className="text-xs text-success font-semibold">
                      ✓ Arquivo Carregado: <b>{selectedFile.name}</b>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-eyebrow block mb-1">Nome de Identificação do Modelo *</label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Ex: Contrato Padrão de Eventos GOAT Bar"
                      className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="label-eyebrow block mb-1">Selecione o Arquivo (.docx, .pdf, .txt) *</label>
                    <input
                      type="file"
                      accept=".docx,.pdf,.txt,.html"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-eyebrow">Texto / Cláusulas do Seu Contrato</label>
                    {templateContent && (
                      <button
                        type="button"
                        onClick={autoMatchTagsInText}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="h-3 w-3" /> Auto-Detectar Campos no Texto
                      </button>
                    )}
                  </div>
                  <textarea
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    placeholder="Cole ou edite o texto do seu contrato aqui, ou insira as tags que deseja que o sistema substitua..."
                    rows={8}
                    className="w-full p-4 rounded-xl bg-input border border-border text-xs font-mono focus:border-primary focus:outline-none resize-y leading-relaxed"
                  />
                </div>
              </div>

              {/* Passo 2: Tabela de Match (De-Para) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-sm text-primary flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" /> 2. Tabela de Correspondência de Campos (De-Para)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Indique qual palavra, tag ou marcadores do seu documento correspondem a cada dado do sistema
                    </p>
                  </div>
                </div>

                <div className="border border-border rounded-2xl overflow-hidden bg-background">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left bg-surface border-b border-border">
                        <th className="px-4 py-3 font-bold text-muted-foreground">Dado do Sistema GOAT Bar</th>
                        <th className="px-4 py-3 font-bold text-muted-foreground">Categoria</th>
                        <th className="px-4 py-3 font-bold text-primary">Tag / Texto a Substituir no Seu Contrato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {SystemFields.map((f) => (
                        <tr key={f.key} className="hover:bg-surface/50 transition-colors">
                          <td className="px-4 py-2.5 font-bold">
                            <div>{f.label}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">{f.desc}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded bg-surface border text-[10px] font-medium">
                              {f.category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={fieldMapping[f.key] || ""}
                              onChange={(e) =>
                                setFieldMapping({ ...fieldMapping, [f.key]: e.target.value })
                              }
                              placeholder={`Ex: ${f.defaultTag}`}
                              className="w-full h-8 px-3 rounded-lg bg-surface border border-border text-xs font-mono font-bold focus:border-primary focus:outline-none text-primary"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default_check"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="is_default_check" className="text-xs text-muted-foreground cursor-pointer font-medium">
                  Definir este contrato anexado como o modelo padrão para os próximos eventos
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowUploadMatchModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  if (!templateName) return alert("Preencha o nome de identificação do seu contrato.");
                  if (!templateContent && !selectedFile)
                    return alert("Envie o arquivo do contrato ou informe o texto das cláusulas.");

                  setUploading(true);
                  try {
                    let publicUrl = editingTemplate?.file_url || "";
                    let filePath = editingTemplate?.file_path || "";
                    let fileType = editingTemplate?.file_type || "ARQUIVO";

                    if (selectedFile) {
                      const res = await contractTemplatesService.uploadTemplateFile(selectedFile);
                      publicUrl = res.publicUrl;
                      filePath = res.filePath;
                      fileType = selectedFile.name.split(".").pop()?.toUpperCase() || "DOCX";
                    }

                    const payload = {
                      name: templateName,
                      description: templateContent,
                      file_url: publicUrl,
                      file_path: filePath,
                      file_type: fileType,
                      is_default: isDefault,
                      status: "active",
                      variables_schema: {
                        content: templateContent,
                        mapping: fieldMapping,
                      },
                    };

                    if (editingTemplate) {
                      await contractTemplatesService.updateTemplate(editingTemplate.id, payload);
                      if (isDefault) {
                        await contractTemplatesService.setDefaultTemplate(editingTemplate.id);
                      }
                      alert("Modelo de contrato e Match de campos atualizados com sucesso!");
                    } else {
                      const created = await contractTemplatesService.createTemplate(payload);
                      if (isDefault && created?.id) {
                        await contractTemplatesService.setDefaultTemplate(created.id);
                      }
                      alert("Contrato anexado e Match de campos configurado com sucesso!");
                    }

                    setShowUploadMatchModal(false);
                    loadData();
                  } catch (e: any) {
                    console.error("Erro ao salvar contrato e match:", e);
                    alert(`Erro ao salvar: ${e.message || "Erro desconhecido"}`);
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
                Salvar Contrato e Match
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAR PRÉVIA DO CONTRATO COM MATCH */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> {previewTemplate.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Simulação de preenchimento do seu contrato com os dados de teste do sistema
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
                <span className="font-bold text-primary">Prévia do Contrato com Substituição do Match:</span>
                <span className="text-muted-foreground">As marcas e tags mapeadas foram substituídas</span>
              </div>

              <div className="p-6 bg-background border border-border rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner">
                {renderContractTemplate(
                  getTemplateContent(previewTemplate),
                  SAMPLE_VARIABLES,
                  getTemplateMapping(previewTemplate)
                ) || (
                  <div className="text-muted-foreground text-center py-8">
                    Este arquivo de contrato não possui texto pré-visualizável diretamente. O arquivo anexado original será utilizado.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton
                onClick={() => {
                  setPreviewTemplate(null);
                  openUploadMatchModal(previewTemplate);
                }}
                className="text-xs font-bold text-primary"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Alterar Match de Campos
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
                  if (editingSigner) {
                    await contractSignersService.updateSigner(editingSigner.id, newSigner);
                    alert("Dados do sócio atualizados com sucesso!");
                  } else {
                    await contractSignersService.createSigner(newSigner);
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
