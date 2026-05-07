// Mock data store — realistic fictional data for the Goat Bar Management System.
// Designed to be replaced by Lovable Cloud queries in the future.

export type Unidade = "Eventos" | "7Steakhouse" | "Goat Botequim";

export interface ModalityConfig {
  active: boolean;
  cost: number;
  price?: number;
}

export interface Insumo {
  nome: string;
  custo: number;
}

export interface Drink {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  custoUnitario: number; // Exclusivo para Eventos
  insumos?: Insumo[];
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
  maoDeObraNomes?: string;
  maoDeObraDetalhes?: { data: string; valor: number; qtdPessoas: number; nomes?: string }[];
  reposicaoRestaurante?: number; // Steakhouse only (soma total)
  custosRestauranteDetalhes?: { descricao: string; valor: number }[];
  observacoes?: string;
}

export interface InventoryItem {
  id: string;
  nome: string;
  quantidadeTotal: number;
  observacoes: string;
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

  // Novos campos de orçamento (Versão Atual)
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
  lead_source?: string;
  referral_name?: string;
  is_paid_full?: boolean;
  
  // Legacy/Computed
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
  groupo: "Repasse" | "Custos" | "Consumo" | "Operacional";
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
  {
    id: "caipirinha",
    nome: "Caipirinha",
    categoria: "Cachaça",
    descricao: "Cachaça, limão e açúcar.",
    custoUnitario: 2.37,
    insumos: [],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: true, cost: 13.25, price: 25 },
      goatbotequim: { active: true, cost: 2.37, price: 20 }
    },
    imagem: "https://images.unsplash.com/photo-1541546106583-b4f853b4306a?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-limao",
    nome: "Caipivodka Limão",
    categoria: "Vodka",
    descricao: "Vodka, limão e açúcar.",
    custoUnitario: 2.20,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Limão", custo: 0.20 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 2.20 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 3.87, price: 22 }
    },
    imagem: "https://images.unsplash.com/photo-1541546106583-b4f853b4306a?w=400&auto=format&fit=crop"
  },
  {
    id: "caipi-limao-cravo-mel",
    nome: "Caipivodka limão cravo e mel",
    categoria: "Vodka",
    descricao: "Vodka, limão cravo e mel.",
    custoUnitario: 2.70,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Cravo", custo: 0.10 },
      { nome: "Mel", custo: 0.40 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 2.70 },
      steakhouse: { active: true, cost: 13.25, price: 30 },
      goatbotequim: { active: true, cost: 4.37, price: 22 }
    },
    imagem: "https://images.unsplash.com/photo-1541546106583-b4f853b4306a?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-morango",
    nome: "Caipivodka Morango",
    categoria: "Vodka",
    descricao: "Vodka e morangos frescos.",
    custoUnitario: 3.60,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Morango", custo: 1.60 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.60 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: true, cost: 5.37, price: 22 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-abacaxi",
    nome: "Caipivodka Abacaxi",
    categoria: "Vodka",
    descricao: "Vodka, abacaxi e raspas de limão.",
    custoUnitario: 2.80,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Abacaxi", custo: 0.50 },
      { nome: "Raspas", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 2.80 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1587223962905-276f75608b4f?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-maracuja",
    nome: "Caip Maracujá com baunilha",
    categoria: "Vodka",
    descricao: "Vodka, maracujá e açúcar de baunilha.",
    custoUnitario: 3.20,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Maracujá", custo: 0.90 },
      { nome: "Açúcar Baunilha", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.20 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: true, cost: 4.47, price: 22 }
    },
    imagem: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop"
  },
  {
    id: "moscow-mule",
    nome: "Moscow Mule",
    categoria: "Vodka",
    descricao: "Vodka, limão e sifão de gengibre.",
    custoUnitario: 3.10,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Sifão", custo: 0.90 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.10 },
      steakhouse: { active: true, cost: 17.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1513415277900-a62401e19be4?w=400&auto=format&fit=crop"
  },
  {
    id: "london-mule",
    nome: "London Mule",
    categoria: "Gin",
    descricao: "Gin, limão e sifão de gengibre.",
    custoUnitario: 5.76,
    insumos: [
      { nome: "Gin", custo: 4.66 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Sifão", custo: 0.90 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 5.76 },
      steakhouse: { active: true, cost: 18.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1513415277900-a62401e19be4?w=400&auto=format&fit=crop"
  },
  {
    id: "mojito",
    nome: "Mojito",
    categoria: "Rum",
    descricao: "Vodka, limão, hortelã e água com gás.",
    custoUnitario: 3.00,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Hortelã", custo: 0.50 },
      { nome: "Água com gás", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.00 },
      steakhouse: { active: true, cost: 16.76, price: 32 },
      goatbotequim: { active: true, cost: 4.67, price: 25 }
    },
    imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop"
  },
  {
    id: "aquario",
    nome: "Aquário",
    categoria: "Vodka",
    descricao: "Vodka, limão, curaçao, alecrim e água com gás.",
    custoUnitario: 4.25,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Curaçao", custo: 1.00 },
      { nome: "Alecrim", custo: 0.25 },
      { nome: "Açúcar", custo: 0.50 },
      { nome: "Água com gás", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 4.25 },
      steakhouse: { active: true, cost: 17.26, price: 32 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1597290282695-edc43d0e7129?w=400&auto=format&fit=crop"
  },
  {
    id: "sex-on-the-beach",
    nome: "Sex on The Beach",
    categoria: "Vodka",
    descricao: "Vodka, suco de laranja, xarope de pêssego e grenadine.",
    custoUnitario: 6.62,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Suco laranja", custo: 0.80 },
      { nome: "Xarope pêssego", custo: 2.64 },
      { nome: "Grenadine", custo: 0.88 },
      { nome: "Jujuba", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 6.62 },
      steakhouse: { active: true, cost: 17.76, price: 32 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop"
  },
  {
    id: "bossa-nova",
    nome: "Bossa Nova",
    categoria: "Vodka",
    descricao: "Vodka, uva e água de coco.",
    custoUnitario: 4.00,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Uva", custo: 1.00 },
      { nome: "Água de coco", custo: 1.00 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 4.00 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "gin-tonica",
    nome: "Gin Tônica",
    categoria: "Gin",
    descricao: "Gin, tônica, limão siciliano e especiarias.",
    custoUnitario: 6.71,
    insumos: [
      { nome: "Gin", custo: 4.66 },
      { nome: "Tônica", custo: 1.50 },
      { nome: "Limão siciliano", custo: 0.30 },
      { nome: "Especiaria", custo: 0.25 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 6.71 },
      steakhouse: { active: true, cost: 18.55, price: 35 },
      goatbotequim: { active: true, cost: 8.17, price: 28 }
    },
    imagem: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&auto=format&fit=crop"
  },
  {
    id: "tom-collins",
    nome: "Tom Collins",
    categoria: "Gin",
    descricao: "Gin, limão, água com gás e cereja.",
    custoUnitario: 5.91,
    insumos: [
      { nome: "Gin", custo: 4.66 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Água com gás", custo: 0.30 },
      { nome: "Cereja", custo: 0.75 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 5.91 },
      steakhouse: { active: true, cost: 19.05, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop"
  },
  {
    id: "fitzgerald",
    nome: "Fitzgerald",
    categoria: "Gin",
    descricao: "Gin, limão, angostura e twist.",
    custoUnitario: 7.23,
    insumos: [
      { nome: "Gin", custo: 4.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Angostura", custo: 2.83 },
      { nome: "Twist", custo: 0.20 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 7.23 },
      steakhouse: { active: true, cost: 19.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1544145945-f904253d0c7b?w=400&auto=format&fit=crop"
  },
  {
    id: "bramble",
    nome: "Bramble",
    categoria: "Gin",
    descricao: "Gin, limão e xarope de amora.",
    custoUnitario: 7.06,
    insumos: [
      { nome: "Gin", custo: 4.66 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Xarope amora", custo: 1.40 },
      { nome: "Guarnição", custo: 0.80 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 7.06 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&auto=format&fit=crop"
  },
  {
    id: "aperol-spritz",
    nome: "Aperol Spritz",
    categoria: "Aperitivos",
    descricao: "Aperol, champanhe, laranja e água com gás.",
    custoUnitario: 10.50,
    insumos: [
      { nome: "Aperol", custo: 4.00 },
      { nome: "Champanhe", custo: 6.00 },
      { nome: "Laranja", custo: 0.20 },
      { nome: "Água com gás", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 10.50 },
      steakhouse: { active: true, cost: 20.50, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1560512823-829485b8bf24?w=400&auto=format&fit=crop"
  },
  {
    id: "cest-la-vie",
    nome: "C'est Lá Vie",
    categoria: "Gin",
    descricao: "Xarope, limão, champanhe, água com gás e gelo.",
    custoUnitario: 9.51,
    insumos: [
      { nome: "Xarope", custo: 2.64 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Champanhe", custo: 6.00 },
      { nome: "Água com gás", custo: 0.30 },
      { nome: "Gelo", custo: 0.37 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 9.51 },
      steakhouse: { active: true, cost: 22.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop"
  },
  {
    id: "mint-jullep",
    nome: "Mint Jullep",
    categoria: "Whisky",
    descricao: "Whisky, limão e hortelã.",
    custoUnitario: 5.50,
    insumos: [
      { nome: "Whisky", custo: 5.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Hortelã", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 5.50 },
      steakhouse: { active: true, cost: 21.20, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "whisky-sour",
    nome: "Whisky Sour",
    categoria: "Whisky",
    descricao: "Whisky, limão, proteína e guarnição.",
    custoUnitario: 5.80,
    insumos: [
      { nome: "Whisky", custo: 5.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Proteína", custo: 0.30 },
      { nome: "Guarnição", custo: 0.30 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 5.80 },
      steakhouse: { active: true, cost: 21.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "negroni",
    nome: "Negroni",
    categoria: "Gin",
    descricao: "Vermute, gin e campari.",
    custoUnitario: 9.70,
    insumos: [
      { nome: "Vermute", custo: 2.20 },
      { nome: "Gin", custo: 4.00 },
      { nome: "Campari", custo: 3.50 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 9.70 },
      steakhouse: { active: true, cost: 25.35, price: 45 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop"
  },
  {
    id: "campari-tonica",
    nome: "Campari Tônica",
    categoria: "Aperitivos",
    descricao: "Campari, tônica e twist laranja.",
    custoUnitario: 9.70,
    insumos: [
      { nome: "Tônica", custo: 1.50 },
      { nome: "Campari", custo: 8.00 },
      { nome: "Twist laranja", custo: 0.20 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 9.70 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop"
  },
  {
    id: "raspberry",
    nome: "Raspberry",
    categoria: "Vodka",
    descricao: "Vodka, coulis, espuma.",
    custoUnitario: 4.00,
    insumos: [
      { nome: "Vodka", custo: 4.00 },
      { nome: "Coulis", custo: 0.00 },
      { nome: "Espuma", custo: 0.00 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 4.00 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "stamping",
    nome: "Stamping Passion",
    categoria: "Vodka",
    descricao: "Vodka, maracujá, limão, açúcar baunilha e tabasco.",
    custoUnitario: 3.90,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Maracujá", custo: 0.90 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Açúcar baunilha", custo: 0.30 },
      { nome: "Tabasco", custo: 0.40 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.90 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop"
  },
  {
    id: "olho-grego",
    nome: "Olho Grego",
    categoria: "Vodka",
    descricao: "Vodka, limão, xarope amêndoas, xarope curaçao.",
    custoUnitario: 7.00,
    insumos: [
      { nome: "Vodka", custo: 4.00 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Xarope amêndoas", custo: 1.40 },
      { nome: "Xarope curaçao", custo: 1.40 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 7.00 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1597290282695-edc43d0e7129?w=400&auto=format&fit=crop"
  },
  {
    id: "cosmopolitan",
    nome: "Cosmopolitan",
    categoria: "Vodka",
    descricao: "Vodka, xarope cramberry, limão e cointreau.",
    custoUnitario: 8.97,
    insumos: [
      { nome: "Vodka", custo: 4.00 },
      { nome: "Xarope Cramberry", custo: 2.10 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Cointreau", custo: 2.57 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 8.97 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop"
  },
  {
    id: "apple-martini",
    nome: "Apple Martini",
    categoria: "Vodka",
    descricao: "Xarope e vodka.",
    custoUnitario: 3.70,
    insumos: [
      { nome: "Xarope", custo: 2.20 },
      { nome: "Vodka", custo: 2.00 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.70 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1587223962905-276f75608b4f?w=400&auto=format&fit=crop"
  },
  {
    id: "expresso-martini",
    nome: "Expresso Martini",
    categoria: "Vodka",
    descricao: "Vodka, açúcar baunilha, bailays e café.",
    custoUnitario: 4.86,
    insumos: [
      { nome: "Vodka", custo: 2.00 },
      { nome: "Açúcar baunilha", custo: 0.50 },
      { nome: "Bailays", custo: 1.86 },
      { nome: "Café", custo: 0.50 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 4.86 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1544145945-f904253d0c7b?w=400&auto=format&fit=crop"
  },
  {
    id: "paloma",
    nome: "Paloma",
    categoria: "Tequila",
    descricao: "Tequila, xarope grapefruit, limão e grapefruit.",
    custoUnitario: 13.98,
    insumos: [
      { nome: "Tequila", custo: 10.73 },
      { nome: "Xarope grapefruit", custo: 2.80 },
      { nome: "Limão", custo: 0.20 },
      { nome: "Grapefruit", custo: 0.25 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 13.98 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "soda-italiana",
    nome: "Soda Italiana",
    categoria: "Sem Álcool",
    descricao: "Xarope e água com gás.",
    custoUnitario: 3.34,
    insumos: [
      { nome: "Xarope", custo: 2.64 },
      { nome: "Água com gás", custo: 0.70 }
    ],
    modalityConfig: {
      evento: { active: true, cost: 3.34 },
      steakhouse: { active: true, cost: 3.34, price: 25 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "old-fashioned",
    nome: "Old Fashioned",
    categoria: "Whisky",
    descricao: "Whisky premium, angostura e açúcar.",
    custoUnitario: 24.35,
    insumos: [
      { nome: "Whisky premium", custo: 20.00 },
      { nome: "Angostura", custo: 2.85 },
      { nome: "Açúcar", custo: 1.50 }
    ],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: true, cost: 24.35, price: 45 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },

  // --- DOSES BOTEQUIM ---
  {
    id: "dose-cachaca",
    nome: "Cachaça (Dose)",
    categoria: "Doses",
    descricao: "Dose de cachaça premium.",
    custoUnitario: 1.50,
    insumos: [{ nome: "Cachaça", custo: 1.50 }],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 1.50, price: 7.00 }
    },
    imagem: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop"
  },
  {
    id: "dose-vodka",
    nome: "Vodka (Dose)",
    categoria: "Doses",
    descricao: "Dose de vodka standard.",
    custoUnitario: 3.00,
    insumos: [{ nome: "Vodka", custo: 3.00 }],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 3.00, price: 14.00 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "dose-gin",
    nome: "Gin (Dose)",
    categoria: "Doses",
    descricao: "Dose de gin nacional.",
    custoUnitario: 6.00,
    insumos: [{ nome: "Gin", custo: 6.00 }],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 6.00, price: 17.00 }
    },
    imagem: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&auto=format&fit=crop"
  },
  {
    id: "dose-whisky",
    nome: "Whisky (Dose)",
    categoria: "Doses",
    descricao: "Dose de whisky 8 anos.",
    custoUnitario: 10.00,
    insumos: [{ nome: "Whisky", custo: 10.00 }],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 10.00, price: 25.00 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "dose-campari",
    nome: "Campari (Dose)",
    categoria: "Doses",
    descricao: "Dose de campari.",
    custoUnitario: 7.00,
    insumos: [{ nome: "Campari", custo: 7.00 }],
    modalityConfig: {
      evento: { active: false, cost: 0 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: true, cost: 7.00, price: 25.00 }
    },
    imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop"
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

// ─── Inventário ────────────────────────────────────────────────────────────
export const inventoryItems: InventoryItem[] = [
  {
    id: "inv-1",
    nome: "Vodka",
    quantidadeTotal: 20,
    observacoes: "- Estoque casa: 8 unidades\n- 7 Steakhouse: 5 unidades\n- Goat Botequim: 4 unidades\n- Evento reservado: 3 unidades"
  },
  {
    id: "inv-2",
    nome: "Gin",
    quantidadeTotal: 12,
    observacoes: "- Estoque casa: 12 unidades"
  }
];

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
  { id: "p1", chave: "repasse_percentual", label: "Percentual de repasse", valor: 15, unidade: "%", groupo: "Repasse", descricao: "Aplicado sobre receita líquida" },
  { id: "p2", chave: "custo_equipe_hora", label: "Custo de equipe por hora", valor: 65, unidade: "R$", groupo: "Custos" },
  { id: "p3", chave: "custo_operacional_evento", label: "Custo operacional fixo por evento", valor: 850, unidade: "R$", groupo: "Custos" },
  { id: "p4", chave: "margem_minima", label: "Margem mínima aceitável", valor: 35, unidade: "%", groupo: "Operacional" },
  { id: "p5", chave: "perda_estimada", label: "Perdas estimadas", valor: 4, unidade: "%", groupo: "Operacional" },
  { id: "p6", chave: "quebra_copos", label: "Quebra de copos por 100 convidados", valor: 6, unidade: "un", groupo: "Operacional" },
  { id: "p7", chave: "consumo_medio_pessoa", label: "Consumo médio por convidado", valor: 4.5, unidade: "doses", groupo: "Consumo" },
  { id: "p8", chave: "gelo_kg_pessoa", label: "Gelo por convidado", valor: 1.2, unidade: "kg", groupo: "Consumo" },
  { id: "p9", chave: "insumos_pessoa", label: "Insumos por convidado", valor: 4.5, unidade: "R$", groupo: "Consumo" },
  { id: "p10", chave: "markup_eventos", label: "Markup Eventos", valor: 3.5, unidade: "x", groupo: "Precificação" },
  { id: "p11", chave: "markup_7steakhouse", label: "Markup 7Steakhouse", valor: 3.0, unidade: "x", groupo: "Precificação" },
  { id: "p12", chave: "markup_goatbotequim", label: "Markup Goat Botequim", valor: 2.8, unidade: "x", groupo: "Precificação" },
];

export const tiposEvento: TipoEvento[] = [
  { id: "t1", nome: "Casamento", consumoBebidaPessoa: 5, geloKgPessoa: 1.4, insumosPessoa: 5, equipePor50: 2 },
  { id: "t2", nome: "Corporativo", consumoBebidaPessoa: 3.5, geloKgPessoa: 1, insumosPessoa: 3.5, equipePor50: 1.5 },
  { id: "t3", nome: "Aniversário", consumoBebidaPessoa: 4.5, geloKgPessoa: 1.2, insumosPessoa: 4.5, equipePor50: 2 },
  { id: "t4", nome: "Confraternização", consumoBebidaPessoa: 4, geloKgPessoa: 1.1, insumosPessoa: 4, equipePor50: 1.5 },
];

// ─── Cálculos derivados ───────────────────────────────────────────────────
export function calcularEvento(evento: Evento, drinksList: Drink[] = drinks) {
  const tipo = tiposEvento.find((t) => t.nome === evento.tipo) || tiposEvento[0];
  const param = (k: string) => parametros.find((p) => p.chave === k)?.valor ?? 0;

  const dosesEstimadas = evento.convidados * tipo.consumoBebidaPessoa;
  const geloKg = evento.convidados * tipo.geloKgPessoa;
  const insumos = evento.convidados * tipo.insumosPessoa;
  const equipeNec = Math.ceil((evento.convidados / 50) * tipo.equipePor50);

  const custoDrinks = evento.drinks.reduce((acc, dId) => {
    const d = drinksList.find((x) => x.id === dId);
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

export function calcularOrcamentoEvento(evento: Evento, drinksList: Drink[] = drinks) {
  if (!evento) return null;

  // --- DRINKS ---
  const validDrinks = (evento.drinks || []).filter(id => drinksList.some(d => d.id === id));
  
  const custoBaseDrinks = validDrinks.reduce((acc, drinkId) => {
    const drink = drinksList.find(d => d.id === drinkId);
    return acc + (drink?.custoUnitario || 0);
  }, 0);
  
  const convidados = Number(evento.convidados) || 0;
  const drinksPorPessoa = Number(evento.drinksPorPessoa) || 0;
  const totalDoses = convidados * drinksPorPessoa;
  const qtdDrinksSelecionados = validDrinks.length;
  const mediaCustoDrinks = qtdDrinksSelecionados > 0 ? (custoBaseDrinks / qtdDrinksSelecionados) : 0;
  
  const markupAdicional = Number(evento.markupAdicionalDrinks) || 0;
  const valorDrinksEvento = totalDoses * mediaCustoDrinks * (1 + markupAdicional / 100);

  // --- EQUIPE ---
  const valorEquipe = Object.values(evento.equipe || {}).reduce((acc, p) => acc + ((Number(p.qtd) || 0) * (Number(p.valorUnitario) || 0)), 0);

  // --- GELO ---
  const pacotesGelo = Number(evento.gelo?.pacotesOverride) || Math.ceil((convidados / 100) * 35);
  const valorGelo = pacotesGelo * (Number(evento.gelo?.valorUnitario) || 6);

  // --- LOGÍSTICA ---
  const valorGasolina = evento.viagem?.incluir ? (Number(evento.viagem.valor) || 0) : 0;

  // --- GASTOS DIVERSOS ---
  const valorGastosDiversos = (evento.gastosDiversos || []).reduce((acc, g) => acc + (Number(g.valor) || 0), 0);

  // --- TOTAIS ---
  const custoTotalOrcamento = valorDrinksEvento + valorEquipe + valorGelo + valorGasolina + valorGastosDiversos;
  const lucroDesejado = Number(evento.lucroDesejado) || 0;
  const valorTotalSemDesconto = custoTotalOrcamento + lucroDesejado;
  const valorDesconto = Number(evento.desconto) || 0;
  const valorTotalOrcamento = valorTotalSemDesconto - valorDesconto;
  
  const lucro = valorTotalOrcamento - custoTotalOrcamento;
  const mediaPorPessoa = convidados > 0 ? valorTotalOrcamento / convidados : 0;
  
  const percentualPago = Number(evento.pagamento?.percentualPago) || 0;
  const valorPago = (valorTotalOrcamento * percentualPago) / 100;
  const valorPendente = valorTotalOrcamento - valorPago;
  const percPendente = 100 - percentualPago;
  
  let statusPagamento = "Não pago";
  if (percentualPago >= 100) statusPagamento = "Pago integralmente";
  else if (percentualPago > 0) statusPagamento = "Parcialmente pago";

  return {
    mediaCustoDrinks,
    custoBaseDrinks,
    valorDrinksEvento,
    valorEquipe,
    pacotesGelo,
    valorGelo,
    valorGasolina,
    valorGastosDiversos,
    lucro,
    valorTotalOrcamento,
    valorTotalSemDesconto,
    valorDesconto,
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
  return Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
}
