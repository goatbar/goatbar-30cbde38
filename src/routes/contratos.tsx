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
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  contractTemplatesService,
  contractSignersService,
  glasswareService,
  eventContractsService,
  renderContractTemplate,
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
  { id: "templates", label: "Templates & Variáveis", icon: Code },
  { id: "socios", label: "Sócios Assinantes", icon: Users },
  { id: "copos", label: "Copos / Utensílios", icon: Wine },
];

export const AVAILABLE_CONTRACT_VARIABLES = [
  { key: "cliente_nome", label: "Nome do Cliente", desc: "Nome completo do contratante" },
  { key: "cliente_documento", label: "CPF/CNPJ do Cliente", desc: "Documento de identificação" },
  { key: "cliente_endereco", label: "Endereço do Cliente", desc: "Endereço / Local de residência" },
  { key: "cliente_email", label: "E-mail do Cliente", desc: "Endereço eletrônico de contato" },
  { key: "cliente_telefone", label: "Telefone do Cliente", desc: "Telefone / WhatsApp" },
  { key: "evento_nome", label: "Nome do Evento", desc: "Ex: Casamento Ana & Pedro" },
  { key: "evento_tipo", label: "Tipo do Evento", desc: "Ex: Casamento, Aniversário, Corporativo" },
  { key: "evento_data", label: "Data do Evento", desc: "Data de realização formatada" },
  { key: "evento_horario", label: "Horário", desc: "Horário de início do evento" },
  { key: "evento_local", label: "Local do Evento", desc: "Nome do espaço / Salão de festas" },
  { key: "evento_cidade", label: "Cidade", desc: "Cidade do evento" },
  { key: "evento_convidados", label: "Convidados", desc: "Quantidade total de convidados" },
  { key: "evento_valor_total", label: "Valor Total", desc: "Valor total do contrato (R$)" },
  { key: "evento_forma_pagamento", label: "Forma de Pagamento", desc: "Condições e parcelamento" },
  { key: "drinks_lista", label: "Lista de Drinks", desc: "Coquetéis inclusos no menu" },
  { key: "bebidas_descricao", label: "Descrição de Bebidas", desc: "Detalhamento de marcas e insumos" },
  { key: "tabela_reposicao", label: "Tabela de Reposição", desc: "Valores por unidade em caso de quebra" },
  { key: "socio_nome", label: "Sócio Goat", desc: "Nome do sócio representante GOAT Bar" },
  { key: "socio_cpf", label: "CPF Sócio Goat", desc: "CPF do sócio assinante" },
  { key: "socio_cargo", label: "Cargo Sócio Goat", desc: "Cargo do representante legal" },
  { key: "data_emissao", label: "Data de Emissão", desc: "Data em que o contrato é gerado" },
];

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
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [showGlasswareModal, setShowGlasswareModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);

  // Estados de Formulário
  const [newTemplate, setNewTemplate] = useState({
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
          const { data: ev } = await supabase.from("events").select("event_name, client_name, date").eq("id", c.event_id).maybeSingle();
          const { data: clientData } = await supabase.from("event_contract_client_data").select("client_name").eq("event_id", c.event_id).maybeSingle();
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

  const copyVariableToClipboard = (varKey: string) => {
    const token = `{{${varKey}}}`;
    navigator.clipboard.writeText(token);
    setCopiedVar(varKey);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const insertVariableIntoTemplateContent = (varKey: string) => {
    const token = `{{${varKey}}}`;
    setNewTemplate((prev) => ({
      ...prev,
      content: prev.content + " " + token,
    }));
    copyVariableToClipboard(varKey);
  };

  const filteredContracts = contracts.filter((c) =>
    (c.client_name || "").toLowerCase().includes(busca.toLowerCase()) ||
    (c.event_name || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <>
      <PageHeader
        breadcrumb="Documentos"
        title="Contratos & Templates"
        subtitle="Geração automática de contratos com variáveis dinâmicas, modelos e sócios."
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

        {/* Conteúdo */}
        <div className="xl:col-span-9 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border rounded-2xl">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Carregando dados de contratos do sistema...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: CONTRATOS GERADOS */}
              {activeTab === "contratos" && (
                <SectionCard
                  title="Contratos Gerados"
                  subtitle="Histórico de documentos e minutas vinculadas aos eventos"
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
                      Nenhum contrato gerado ainda. Acesse a aba de um Evento para emitir um novo contrato automaticamente.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredContracts.map((ec) => {
                        const template = templates.find((t) => t.id === ec.template_id);
                        return (
                          <div
                            key={ec.id}
                            className="p-5 border border-border bg-surface rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 hover:border-primary/40 transition-colors"
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
                                Modelo: <b>{template?.name || "Template Padrão GOAT"}</b> (v{ec.version || 1})
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {ec.signed_file_url ? (
                                <PrimaryButton
                                  onClick={() => window.open(ec.signed_file_url, "_blank")}
                                  className="h-8 text-xs font-bold px-3"
                                >
                                  <Download className="h-3.5 w-3.5 mr-1" /> Download PDF Assinado
                                </PrimaryButton>
                              ) : (
                                <GhostButton
                                  onClick={() => alert("O contrato está salvo como minuta. Acesse o evento correspondente para imprimir ou disparar assinaturas.")}
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

              {/* TAB 2: TEMPLATES & VARIÁVEIS */}
              {activeTab === "templates" && (
                <div className="space-y-6">
                  {/* Banner Explicativo sobre Variáveis Dinâmicas */}
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-lg">Geração Automática com Variáveis Dinâmicas</h3>
                        <p className="text-xs text-muted-foreground">
                          Insira as tags abaixo nos modelos de contrato. Ao gerar um contrato para um evento, o sistema substituirá cada tag automaticamente pelos dados reais do cliente e orçamento!
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2">
                      {AVAILABLE_CONTRACT_VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => copyVariableToClipboard(v.key)}
                          className="p-2.5 rounded-xl border border-border bg-surface hover:border-primary/50 text-left transition-all group flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-[11px] font-bold text-primary group-hover:underline">
                              {`{{${v.key}}}`}
                            </span>
                            {copiedVar === v.key ? (
                              <Check className="h-3.5 w-3.5 text-success shrink-0" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-foreground">{v.label}</span>
                          <span className="text-[9px] text-muted-foreground truncate">{v.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <SectionCard
                    title="Modelos de Contrato Cadastrados"
                    subtitle="Templates base que serão preenchidos automaticamente com as informações do cliente"
                    action={
                      <PrimaryButton
                        onClick={() => setShowTemplateModal(true)}
                        className="h-9 px-4 text-sm font-bold shadow-md shadow-primary/20"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Novo Template
                      </PrimaryButton>
                    }
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          className="p-5 border border-border rounded-2xl bg-surface relative group space-y-3 hover:border-primary/40 transition-all shadow-sm"
                        >
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
                              {t.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {t.description}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-background border rounded-md text-muted-foreground">
                              {t.file_type || "TEXT"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-xs">
                            <GhostButton
                              onClick={() => setPreviewTemplate(t)}
                              className="h-8 text-xs font-semibold px-2.5"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar Modelo
                            </GhostButton>
                            {!t.is_default && (
                              <button
                                onClick={async () => {
                                  await contractTemplatesService.setDefaultTemplate(t.id);
                                  loadData();
                                }}
                                className="text-xs font-bold text-primary hover:underline ml-auto"
                              >
                                Definir como Padrão
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {templates.length === 0 && (
                        <div className="col-span-2 text-center py-12 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl space-y-3">
                          <p>Nenhum template personalizado cadastrado ainda.</p>
                          <p className="text-xs">O sistema utilizará o <b>Template Padrão GOAT Bar</b> para a geração automática dos contratos.</p>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* TAB 3: SÓCIOS ASSINANTES */}
              {activeTab === "socios" && (
                <SectionCard
                  title="Sócios Assinantes"
                  subtitle="Representantes autorizados a figurar e assinar contratos pela GOAT Bar"
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
                              ({s.role || "Sócio"})
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
                        Nenhum sócio cadastrado. Cadastre o representante legal para preencher as cláusulas da contratada.
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              {/* TAB 4: COPOS / UTENSÍLIOS */}
              {activeTab === "copos" && (
                <SectionCard
                  title="Copos e Utensílios"
                  subtitle="Tabela oficial de valores de reposição para avarias ou quebras nos eventos"
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

      {/* MODAL NOVO TEMPLATE */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Novo Modelo de Contrato</h2>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="label-eyebrow block mb-2">Nome do Modelo</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="Ex: Contrato Padrão de Casamentos"
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm font-medium focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="label-eyebrow block mb-2">Descrição Curta</label>
                <input
                  type="text"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Ex: Modelo com cláusulas para eventos corporativos e abertos"
                  className="w-full h-10 px-4 rounded-xl bg-input border border-border text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-eyebrow">Texto do Contrato com Variáveis Dinâmicas</label>
                  <span className="text-[10px] text-muted-foreground">Clique nas variáveis para inserir no texto:</span>
                </div>

                {/* Bar de Variáveis Clicáveis */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-background border border-border rounded-xl mb-3 max-h-28 overflow-y-auto">
                  {AVAILABLE_CONTRACT_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariableIntoTemplateContent(v.key)}
                      className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono font-bold hover:bg-primary/20 transition-colors"
                      title={v.desc}
                    >
                      +{`{{${v.key}}}`}
                    </button>
                  ))}
                </div>

                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  rows={10}
                  className="w-full p-4 rounded-xl bg-input border border-border text-xs font-mono focus:border-primary focus:outline-none resize-y"
                />
              </div>

              <div className="pt-2 border-t border-border">
                <label className="label-eyebrow block mb-2">Ou faça upload de arquivo Word/PDF (Opcional)</label>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newTemplate.is_default}
                  onChange={(e) => setNewTemplate({ ...newTemplate, is_default: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="is_default" className="text-xs text-muted-foreground cursor-pointer">
                  Definir este modelo como padrão principal para novos eventos
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-background/50 border-t border-border">
              <GhostButton onClick={() => setShowTemplateModal(false)}>Cancelar</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  if (!newTemplate.name) return alert("Preencha o nome do modelo de contrato.");
                  setUploading(true);
                  try {
                    let publicUrl = "";
                    let filePath = "";
                    let fileType = "TEXT";

                    if (selectedFile) {
                      const res = await contractTemplatesService.uploadTemplateFile(selectedFile);
                      publicUrl = res.publicUrl;
                      filePath = res.filePath;
                      fileType = selectedFile.name.split(".").pop() || "DOCX";
                    }

                    await contractTemplatesService.createTemplate({
                      name: newTemplate.name,
                      description: newTemplate.description || newTemplate.content.substring(0, 100),
                      file_url: publicUrl,
                      file_path: filePath,
                      file_type: fileType,
                      is_default: newTemplate.is_default,
                      status: "active",
                      variables_schema: AVAILABLE_CONTRACT_VARIABLES.map((v) => v.key),
                    });

                    setShowTemplateModal(false);
                    loadData();
                    alert("Template de contrato cadastrado com sucesso!");
                  } catch (e: any) {
                    console.error("Erro ao salvar template:", e);
                    alert(`Erro ao salvar template: ${e.message || "Erro desconhecido"}`);
                  } finally {
                    setUploading(false);
                  }
                }}
                disabled={uploading}
                className="font-bold shadow-md shadow-primary/20"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Salvar Modelo de Contrato
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAR TEMPLATE */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="font-display text-lg font-bold">{previewTemplate.name}</h2>
                <p className="text-xs text-muted-foreground">Pré-visualização do modelo de contrato e variáveis</p>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/40 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 bg-background border border-border rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed">
                {DEFAULT_CONTRACT_BODY}
              </div>
            </div>

            <div className="flex items-center justify-end px-6 py-4 bg-background/50 border-t border-border">
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
                <label className="label-eyebrow block mb-1">Nome Completo</label>
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
                <label className="label-eyebrow block mb-1">Nome do Item</label>
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
