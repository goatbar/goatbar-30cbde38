// Mock data store — realistic fictional data for the Goat Bar Management System.
// Designed to be replaced by Lovable Cloud queries in the future.

export type Unidade = "Eventos" | "7Steakhouse" | "Goat Botequim";

export interface ModalityConfig {
  active: boolean;
  cost: number;
  price?: number;
}

export interface Drink {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  custoUnitario: number; // Exclusivo para Eventos
  modalityConfig: {
    evento: ModalityConfig;
    steakhouse: ModalityConfig;
    goatbotequim: ModalityConfig;
  };
  imagem?: string;
}

export interface Venda {
  id: string;
  data: string; // ISO
  unidade: Unidade;
  drinkId: string;
  drinkNome: string;
  quantidade: number;
  precoUnitario: number;
  custoUnitario: number;
  observacoes?: string;
}

export interface SalesSessionItem {
  drinkId: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  custoUnitario: number;
}

export interface FinancialSession {
  id: string;
  data: string; // ISO
  modalidade: "Goat Botequim" | "7Steakhouse";
  items: SalesSessionItem[];
  maoDeObraValor: number;
  maoDeObraQtd: number;
  reposicaoRestaurante?: number; // Steakhouse only
  observacoes?: string;
}

export interface GastoDiverso {
  id: string;
  descricao: string;
  valor: number;
}

export interface EventoHistoricoAlteracao {
  data: string; // ISO
  usuario?: string;
  camposAlterados: string[];
  valorAntigo: string;
  valorNovo: string;
}

export interface EventoHistoricoNegociacao {
  data: string;
  status: string;
  observacao: string;
}

export type EventoStatus = "novo_orcamento" | "esperando_envio" | "orcamento_enviado" | "aguardando_retorno" | "fazer_contato" | "dados_solicitados" | "em_assinatura" | "proposta_aceita" | "proposta_recusada" | "confirmado" | "realizado" | "cancelado" | "rascunho" | "em_andamento" | "concluido";

export interface Evento {
  id: string;
  nome: string;
  cliente: string;
  telefone: string;
  email: string;
  data: string;
  horario: string;
  local: string;
  cidade: string;
  tipo: string;
  convidados: number;
  drinks: string[]; // drink ids
  observacoes: string;
  status: EventoStatus;
  contratoId?: string;

  // Novos campos de orçamento
  drinksPorPessoa: number;
  markupAdicionalDrinks: number;
  equipe: {
    bartender: { qtd: number; valorUnitario: number };
    keeper: { qtd: number; valorUnitario: number };
    copeira: { qtd: number; valorUnitario: number };
  };
  gelo: { pacotesEstimados?: number; pacotesOverride?: number; valorUnitario: number };
  viagem: { incluir: boolean; valor: number };
  gastosDiversos: GastoDiverso[];
  lucroDesejado: number;
  pagamento: {
    formaPagamento: string;
    percentualPago: number;
    dataPagamento?: string;
  };
  coposVinculados: Record<string, string>; // drinkId -> glasswareId
  historicoAlteracoes: EventoHistoricoAlteracao[];
  historicoNegociacao: EventoHistoricoNegociacao[];
  
  // Legacy (can be synced with calculation)
  valorNegociado: number;
  custoPrevisto: number;
}

export interface Contrato {
  id: string;
  eventoId: string;
  cliente: string;
  status: "rascunho" | "enviado" | "assinado";
  criadoEm: string;
  template: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  fileUrl: string;
  fileType: "pdf" | "docx";
  isDefault: boolean;
  variablesSchema: string[];
  createdAt: string;
}

export interface ContractSigner {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  role: string;
  address: string;
  isActive: boolean;
}

export interface Glassware {
  id: string;
  name: string;
  type: string;
  replacementValue: number;
  isActive: boolean;
}

export interface EventContractClientData {
  id: string;
  eventId: string;
  clientName: string;
  cpfCnpj: string;
  phone: string;
  email: string;
  address: string;
  legalRepresentativeName: string;
  legalRepresentativeCpf: string;
  notes: string;
  submittedAt: string;
}

export type EventContractStatus = 
  | "aguardando_dados" 
  | "dados_recebidos" 
  | "gerado" 
  | "enviado_assinatura" 
  | "assinado_parcialmente" 
  | "assinado" 
  | "arquivado" 
  | "cancelado";

export interface EventContract {
  id: string;
  eventId: string;
  templateId: string;
  signerId: string;
  status: EventContractStatus;
  generatedFileUrl?: string;
  signedFileUrl?: string;
  signatureCertificateUrl?: string;
  version: number;
  generatedAt?: string;
  sentForSignatureAt?: string;
  fullySignedAt?: string;
}

export interface ContractSignatureHistory {
  id: string;
  eventContractId: string;
  signerName: string;
  signerEmail: string;
  signerRole: string; // 'contratante' ou 'contratada'
  status: "pending" | "signed" | "error";
  signedAt?: string;
  ipAddress?: string;
}

export interface ContractHistory {
  id: string;
  eventContractId: string;
  action: string;
  notes?: string;
  createdAt: string;
}

export interface ParametroCalculo {
  id: string;
  chave: string;
  label: string;
  valor: number;
  unidade: string;
  grupo: "Repasse" | "Custos" | "Consumo" | "Operacional";
  descricao?: string;
}

export interface TipoEvento {
  id: string;
  nome: string;
  consumoBebidaPessoa: number; // doses por convidado
  geloKgPessoa: number;
  insumosPessoa: number; // R$
  equipePor50: number; // pessoas de equipe a cada 50 convidados
}

// ─── Drinks ───────────────────────────────────────────────────────────────

export const drinks: Drink[] = [
  // --- STEAKHOUSE & EVENTOS & BOTEQUIM ---
  {
    id: "caipirinha",
    nome: "Caipirinha",
    categoria: "Cachaça",
    descricao: "Cachaça, limão e açúcar.",
    custoUnitario: 6.00,
    modalityConfig: {
      evento: { active: true, cost: 6.00 },
      steakhouse: { active: true, cost: 13.25, price: 25 },
      goatbotequim: { active: true, cost: 2.37 }
    }
  },
  {
    id: "caipirinha-limao-cravo",
    nome: "Caipirinha Limão Cravo e Mel",
    categoria: "Cachaça",
    descricao: "Limão cravo e mel.",
    custoUnitario: 7.50,
    modalityConfig: {
      evento: { active: true, cost: 7.50 },
      steakhouse: { active: true, cost: 15.00, price: 30 },
      goatbotequim: { active: true, cost: 4.37 }
    }
  },
  {
    id: "caipivodka-morango",
    nome: "Caipivodka Morango",
    categoria: "Vodka",
    descricao: "Vodka e morango.",
    custoUnitario: 7.50,
    modalityConfig: {
      evento: { active: true, cost: 7.50 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "caipivodka-abacaxi",
    nome: "Caipivodka Abacaxi",
    categoria: "Vodka",
    descricao: "Vodka e abacaxi.",
    custoUnitario: 7.00,
    modalityConfig: {
      evento: { active: true, cost: 7.00 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "caipivodka-maracuja",
    nome: "Caipivodka Maracujá",
    categoria: "Vodka",
    descricao: "Vodka e maracujá.",
    custoUnitario: 7.20,
    modalityConfig: {
      evento: { active: true, cost: 7.20 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: false, cost: 4.47 }
    }
  },
  {
    id: "mojito",
    nome: "Mojito",
    categoria: "Rum",
    descricao: "Rum, limão e hortelã.",
    custoUnitario: 7.80,
    modalityConfig: {
      evento: { active: true, cost: 7.80 },
      steakhouse: { active: true, cost: 16.76, price: 32 },
      goatbotequim: { active: true, cost: 4.67 }
    }
  },
  {
    id: "sex-on-the-beach",
    nome: "Sex on the Beach",
    categoria: "Vodka",
    descricao: "Vodka, pêssego e laranja.",
    custoUnitario: 8.20,
    modalityConfig: {
      evento: { active: true, cost: 8.20 },
      steakhouse: { active: true, cost: 17.76, price: 32 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "aquario",
    nome: "Aquário",
    categoria: "Vodka",
    descricao: "Drink azul refrescante.",
    custoUnitario: 8.00,
    modalityConfig: {
      evento: { active: true, cost: 8.00 },
      steakhouse: { active: true, cost: 17.26, price: 32 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "moscow-mule",
    nome: "Moscow Mule",
    categoria: "Vodka",
    descricao: "Vodka, limão e espuma de gengibre.",
    custoUnitario: 8.80,
    modalityConfig: {
      evento: { active: true, cost: 8.80 },
      steakhouse: { active: true, cost: 17.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "london-mule",
    nome: "London Mule",
    categoria: "Gin",
    descricao: "Gin, limão e espuma de gengibre.",
    custoUnitario: 9.00,
    modalityConfig: {
      evento: { active: true, cost: 9.00 },
      steakhouse: { active: true, cost: 18.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "gin-tonica",
    nome: "Gin Tônica",
    categoria: "Gin",
    descricao: "Gin, tônica e limão.",
    custoUnitario: 8.50,
    modalityConfig: {
      evento: { active: true, cost: 8.50 },
      steakhouse: { active: true, cost: 18.55, price: 35 },
      goatbotequim: { active: true, cost: 8.17 }
    }
  },
  {
    id: "fitz-gerald",
    nome: "Fitz Gerald",
    categoria: "Gin",
    descricao: "Gin, limão e angostura.",
    custoUnitario: 9.50,
    modalityConfig: {
      evento: { active: true, cost: 9.50 },
      steakhouse: { active: true, cost: 19.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "tom-collins",
    nome: "Tom Collins",
    categoria: "Gin",
    descricao: "Gin, limão e soda.",
    custoUnitario: 9.20,
    modalityConfig: {
      evento: { active: true, cost: 9.20 },
      steakhouse: { active: true, cost: 19.05, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "aperol-spritz",
    nome: "Aperol Spritz",
    categoria: "Aperitivos",
    descricao: "Aperol, espumante e soda.",
    custoUnitario: 11.50,
    modalityConfig: {
      evento: { active: true, cost: 11.50 },
      steakhouse: { active: true, cost: 20.50, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "cest-la-vie",
    nome: "C’est lá vie",
    categoria: "Gin",
    descricao: "Gin e frutas.",
    custoUnitario: 12.50,
    modalityConfig: {
      evento: { active: true, cost: 12.50 },
      steakhouse: { active: true, cost: 22.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "expresso-martini",
    nome: "Expresso Martini",
    categoria: "Vodka",
    descricao: "Vodka e café.",
    custoUnitario: 10.50,
    modalityConfig: {
      evento: { active: true, cost: 10.50 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "apple-martini",
    nome: "Apple Martini",
    categoria: "Vodka",
    descricao: "Vodka e maçã verde.",
    custoUnitario: 10.00,
    modalityConfig: {
      evento: { active: true, cost: 10.00 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "stamping",
    nome: "Stamping",
    categoria: "Vodka",
    descricao: "Vodka e especiarias.",
    custoUnitario: 10.80,
    modalityConfig: {
      evento: { active: true, cost: 10.80 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "mint-jullep",
    nome: "Mint Jullep",
    categoria: "Whisky",
    descricao: "Whisky, hortelã e açúcar.",
    custoUnitario: 10.20,
    modalityConfig: {
      evento: { active: true, cost: 10.20 },
      steakhouse: { active: true, cost: 21.20, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "whisky-sour",
    nome: "Whisky Sour",
    categoria: "Whisky",
    descricao: "Whisky e limão.",
    custoUnitario: 11.00,
    modalityConfig: {
      evento: { active: true, cost: 11.00 },
      steakhouse: { active: true, cost: 21.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "old-fashioned",
    nome: "Old Fashioned",
    categoria: "Whisky",
    descricao: "Whisky, angostura e açúcar.",
    custoUnitario: 13.00,
    modalityConfig: {
      evento: { active: true, cost: 13.00 },
      steakhouse: { active: true, cost: 24.35, price: 45 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "negroni",
    nome: "Negroni",
    categoria: "Gin",
    descricao: "Gin, vermute e campari.",
    custoUnitario: 12.00,
    modalityConfig: {
      evento: { active: true, cost: 12.00 },
      steakhouse: { active: true, cost: 25.35, price: 45 },
      goatbotequim: { active: false, cost: 0 }
    }
  },
  {
    id: "soda-italiana",
    nome: "Soda Italiana",
    categoria: "Sem Álcool",
    descricao: "Soda e xarope de frutas.",
    custoUnitario: 5.00,
    modalityConfig: {
      evento: { active: true, cost: 5.00 },
      steakhouse: { active: true, cost: 10.00, price: 25 },
      goatbotequim: { active: false, cost: 0 }
    }
  },

  // --- EXCLUSIVOS BOTEQUIM ---
  {
    id: "caipi-limao",
    nome: "Caipi Limão",
    categoria: "Cachaça",
    descricao: "Tradicional de limão.",
    custoUnitario: 4.50,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 3.87 }
    }
  },
  {
    id: "caipi-morango",
    nome: "Caipi Morango",
    categoria: "Cachaça",
    descricao: "Tradicional de morango.",
    custoUnitario: 6.00,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 5.37 }
    }
  },

  // --- DOSES ---
  {
    id: "dose-cachaca",
    nome: "Cachaça (Dose)",
    categoria: "Doses",
    descricao: "Dose de cachaça premium.",
    custoUnitario: 1.50,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 1.50, price: 7.00 }
    }
  },
  {
    id: "dose-vodka",
    nome: "Vodka (Dose)",
    categoria: "Doses",
    descricao: "Dose de vodka.",
    custoUnitario: 3.00,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 3.00, price: 14.00 }
    }
  },
  {
    id: "dose-gin",
    nome: "Gin (Dose)",
    categoria: "Doses",
    descricao: "Dose de gin.",
    custoUnitario: 6.00,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 6.00, price: 17.00 }
    }
  },
  {
    id: "dose-whisky",
    nome: "Whisky (Dose)",
    categoria: "Doses",
    descricao: "Dose de whisky.",
    custoUnitario: 10.00,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 10.00, price: 25.00 }
    }
  },
  {
    id: "dose-campari",
    nome: "Campari (Dose)",
    categoria: "Doses",
    descricao: "Dose de campari.",
    custoUnitario: 7.00,
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 7.00, price: 25.00 }
    }
  }
];

export const fichaTecnica = {}; 


export const margem = (precoVenda: number, custo: number) => ((precoVenda - custo) / precoVenda) * 100;

// ─── Vendas (90 dias) ─────────────────────────────────────────────────────
export const vendas: Venda[] = [];

// ─── Sessões Financeiras (Botequim/Steakhouse) ─────────────────────────────
export const financialSessions: FinancialSession[] = [];

// ─── Eventos ──────────────────────────────────────────────────────────────
export const eventos: Evento[] = [];

// ─── Contratos Legado (to be deprecated) ────────────────────────────────────────────────────────────
export const contratos: Contrato[] = [];

// ─── Novos Módulos de Contrato ────────────────────────────────────────────────
export const contractTemplates: ContractTemplate[] = [
  { id: "tpl1", name: "Contrato Padrão Eventos", fileUrl: "", fileType: "docx", isDefault: true, variablesSchema: ["nome_cliente", "valor_total_evento"], createdAt: new Date().toISOString() }
];

export const contractSigners: ContractSigner[] = [
  { id: "sig1", name: "Sócio Administrador", cpf: "000.000.000-00", email: "admin@goatbar.com.br", phone: "11999999999", role: "Sócio Diretor", address: "Rua Exemplo, 123", isActive: true }
];

export const glasswares: Glassware[] = [
  { id: "g1", name: "Taça Gin", type: "Taça", replacementValue: 45, isActive: true },
  { id: "g2", name: "Copo Long Drink", type: "Copo", replacementValue: 25, isActive: true },
  { id: "g3", name: "Copo Baixo", type: "Copo", replacementValue: 30, isActive: true },
  { id: "g4", name: "Taça Coupe", type: "Taça", replacementValue: 40, isActive: true },
  { id: "g5", name: "Copo Shot", type: "Copo", replacementValue: 15, isActive: true },
];

export const eventContracts: EventContract[] = [];
export const eventContractClientDatas: EventContractClientData[] = [];
export const contractHistories: ContractHistory[] = [];
export const contractSignatureHistories: ContractSignatureHistory[] = [];

// ─── Parâmetros de cálculo ────────────────────────────────────────────────
export const parametros: ParametroCalculo[] = [
  { id: "p1", chave: "repasse_percentual", label: "Percentual de repasse", valor: 15, unidade: "%", grupo: "Repasse", descricao: "Aplicado sobre receita líquida" },
  { id: "p2", chave: "custo_equipe_hora", label: "Custo de equipe por hora", valor: 65, unidade: "R$", grupo: "Custos" },
  { id: "p3", chave: "custo_operacional_evento", label: "Custo operacional fixo por evento", valor: 850, unidade: "R$", grupo: "Custos" },
  { id: "p4", chave: "margem_minima", label: "Margem mínima aceitável", valor: 35, unidade: "%", grupo: "Operacional" },
  { id: "p5", chave: "perda_estimada", label: "Perdas estimadas", valor: 4, unidade: "%", grupo: "Operacional" },
  { id: "p6", chave: "quebra_copos", label: "Quebra de copos por 100 convidados", valor: 6, unidade: "un", grupo: "Operacional" },
  { id: "p7", chave: "consumo_medio_pessoa", label: "Consumo médio por convidado", valor: 4.5, unidade: "doses", grupo: "Consumo" },
  { id: "p8", chave: "gelo_kg_pessoa", label: "Gelo por convidado", valor: 1.2, unidade: "kg", grupo: "Consumo" },
  { id: "p9", chave: "insumos_pessoa", label: "Insumos por convidado", valor: 4.5, unidade: "R$", grupo: "Consumo" },
  { id: "p10", chave: "markup_eventos", label: "Markup Eventos", valor: 3.5, unidade: "x", grupo: "Precificação" },
  { id: "p11", chave: "markup_7steakhouse", label: "Markup 7Steakhouse", valor: 3.0, unidade: "x", grupo: "Precificação" },
  { id: "p12", chave: "markup_goatbotequim", label: "Markup Goat Botequim", valor: 2.8, unidade: "x", grupo: "Precificação" },
];

export const tiposEvento: TipoEvento[] = [
  { id: "t1", nome: "Casamento", consumoBebidaPessoa: 5, geloKgPessoa: 1.4, insumosPessoa: 5, equipePor50: 2 },
  { id: "t2", nome: "Corporativo", consumoBebidaPessoa: 3.5, geloKgPessoa: 1, insumosPessoa: 3.5, equipePor50: 1.5 },
  { id: "t3", nome: "Aniversário", consumoBebidaPessoa: 4.5, geloKgPessoa: 1.2, insumosPessoa: 4.5, equipePor50: 2 },
  { id: "t4", nome: "Confraternização", consumoBebidaPessoa: 4, geloKgPessoa: 1.1, insumosPessoa: 4, equipePor50: 1.5 },
];

// ─── Cálculos derivados ───────────────────────────────────────────────────
export function calcularEvento(evento: Evento) {
  const tipo = tiposEvento.find((t) => t.nome === evento.tipo) || tiposEvento[0];
  const param = (k: string) => parametros.find((p) => p.chave === k)?.valor ?? 0;

  const dosesEstimadas = evento.convidados * tipo.consumoBebidaPessoa;
  const geloKg = evento.convidados * tipo.geloKgPessoa;
  const insumos = evento.convidados * tipo.insumosPessoa;
  const equipeNec = Math.ceil((evento.convidados / 50) * tipo.equipePor50);

  const custoDrinks = evento.drinks.reduce((acc, dId) => {
    const d = drinks.find((x) => x.id === dId);
    if (!d) return acc;
    return acc + d.custoUnitario * (dosesEstimadas / Math.max(evento.drinks.length, 1));
  }, 0);

  const custoEquipe = equipeNec * 6 * param("custo_equipe_hora"); // 6h evento
  const custoFixo = param("custo_operacional_evento");
  const custoTotal = custoDrinks + custoEquipe + custoFixo + insumos;
  const repasse = (evento.valorNegociado * param("repasse_percentual")) / 100;
  const lucro = evento.valorNegociado - custoTotal - repasse;
  const margemPct = (lucro / evento.valorNegociado) * 100;

  return {
    dosesEstimadas: Math.round(dosesEstimadas),
    geloKg: Math.round(geloKg),
    insumos,
    equipeNec,
    custoDrinks,
    custoEquipe,
    custoFixo,
    custoTotal,
    repasse,
    lucro,
    margemPct,
    rentabilidadePorConvidado: lucro / evento.convidados,
  };
}

export function calcularOrcamentoEvento(evento: Evento) {
  // 1 & 2 & 3. Média de custo dos drinks selecionados
  let mediaCustoDrinks = 0;
  if (evento.drinks.length > 0) {
    const drinksData = evento.drinks.map((id) => drinks.find((d) => d.id === id)).filter(Boolean) as typeof drinks;
    const somaCustoDrinks = drinksData.reduce((acc, d) => acc + d.custoUnitario, 0);
    mediaCustoDrinks = somaCustoDrinks / drinksData.length;
  }

  // 4 & 5. Custo base dos drinks
  const drinksPorPessoa = evento.drinksPorPessoa || 0;
  const custoBaseDrinks = mediaCustoDrinks * drinksPorPessoa * evento.convidados;

  // 6 & 7. Valor final dos drinks
  const percentualAdicional = evento.markupAdicionalDrinks || 0;
  const valorDrinksEvento = custoBaseDrinks * (1 + percentualAdicional / 100);

  // Equipe
  const valorEquipe = 
    ((evento.equipe?.bartender?.qtd || 0) * (evento.equipe?.bartender?.valorUnitario || 200)) +
    ((evento.equipe?.keeper?.qtd || 0) * (evento.equipe?.keeper?.valorUnitario || 200)) +
    ((evento.equipe?.copeira?.qtd || 0) * (evento.equipe?.copeira?.valorUnitario || 200));

  // Gelo
  const pacotesCalculados = Math.ceil((evento.convidados / 100) * 35);
  const pacotesFinais = evento.gelo?.pacotesOverride !== undefined ? evento.gelo.pacotesOverride : pacotesCalculados;
  const valorGelo = pacotesFinais * (evento.gelo?.valorUnitario || 6);

  // Gasolina
  const valorGasolina = evento.viagem?.incluir ? (evento.viagem?.valor || 0) : 0;

  // Gastos diversos
  const valorGastosDiversos = (evento.gastosDiversos || []).reduce((acc, item) => acc + (item.valor || 0), 0);

  // Lucro
  const lucro = evento.lucroDesejado || 0;

  // Resumo final
  const valorTotalOrcamento = valorDrinksEvento + valorEquipe + valorGelo + valorGasolina + valorGastosDiversos + lucro;
  const mediaPorPessoa = evento.convidados > 0 ? valorTotalOrcamento / evento.convidados : 0;
  const custoTotalOrcamento = custoBaseDrinks + valorEquipe + valorGelo + valorGasolina + valorGastosDiversos;

  // Pagamento
  const percPago = evento.pagamento?.percentualPago || 0;
  const valorPago = valorTotalOrcamento * (percPago / 100);
  const valorPendente = valorTotalOrcamento - valorPago;
  const percPendente = 100 - percPago;
  
  let statusPagamento = "Não pago";
  if (percPago === 100) statusPagamento = "Pago integralmente";
  else if (percPago > 0) statusPagamento = "Parcialmente pago";

  return {
    mediaCustoDrinks,
    custoBaseDrinks,
    valorDrinksEvento,
    valorEquipe,
    pacotesGelo: pacotesFinais,
    valorGelo,
    valorGasolina,
    valorGastosDiversos,
    lucro,
    valorTotalOrcamento,
    custoTotalOrcamento,
    mediaPorPessoa,
    valorPago,
    valorPendente,
    percPendente,
    statusPagamento,
  };
}

export function vendasResumo(filtroUnidade?: Unidade) {
  const lista = filtroUnidade ? vendas.filter((v) => v.unidade === filtroUnidade) : vendas;
  const receita = lista.reduce((a, v) => a + v.precoUnitario * v.quantidade, 0);
  const custo = lista.reduce((a, v) => a + v.custoUnitario * v.quantidade, 0);
  const lucro = receita - custo;
  return {
    total: lista.length,
    receita,
    custo,
    lucro,
    margem: (lucro / receita) * 100,
    ticketMedio: receita / lista.length,
  };
}

export function rankingDrinks() {
  const map = new Map<string, { nome: string; qtd: number; receita: number; lucro: number }>();
  vendas.forEach((v) => {
    const cur = map.get(v.drinkId) || { nome: v.drinkNome, qtd: 0, receita: 0, lucro: 0 };
    cur.qtd += v.quantidade;
    cur.receita += v.precoUnitario * v.quantidade;
    cur.lucro += (v.precoUnitario - v.custoUnitario) * v.quantidade;
    map.set(v.drinkId, cur);
  });
  return Array.from(map.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.receita - a.receita);
}

export function vendasPorDia(dias = 14) {
  const out: { data: string; receita: number; lucro: number }[] = [];
  const hoje = new Date();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const dia = d.toISOString().slice(0, 10);
    const lista = vendas.filter((v) => v.data.slice(0, 10) === dia);
    const receita = lista.reduce((a, v) => a + v.precoUnitario * v.quantidade, 0);
    const lucro = lista.reduce((a, v) => a + (v.precoUnitario - v.custoUnitario) * v.quantidade, 0);
    out.push({ data: dia, receita, lucro });
  }
  return out;
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtBRL2 = fmtBRL;
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;
export const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
