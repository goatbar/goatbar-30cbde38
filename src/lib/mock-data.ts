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
    descricao: "Cachaça premium, limão e açúcar.",
    custoUnitario: 13.25,
    modalityConfig: {
      evento: { active: true, cost: 13.25, price: 25 },
      steakhouse: { active: true, cost: 13.25, price: 25 },
      goatbotequim: { active: true, cost: 13.25, price: 25 }
    },
    imagem: "https://images.unsplash.com/photo-1541546106583-b4f853b4306a?w=400&auto=format&fit=crop"
  },
  {
    id: "caipi-limao-cravo-mel",
    nome: "Caipirinha Limão Cravo e Mel",
    categoria: "Cachaça",
    descricao: "Cachaça, limão cravo e mel silvestre.",
    custoUnitario: 15.00,
    modalityConfig: {
      evento: { active: true, cost: 15.00, price: 30 },
      steakhouse: { active: true, cost: 15.00, price: 30 },
      goatbotequim: { active: true, cost: 15.00, price: 30 }
    },
    imagem: "https://images.unsplash.com/photo-1541546106583-b4f853b4306a?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-morango",
    nome: "Caipivodka Morango",
    categoria: "Vodka",
    descricao: "Vodka e morangos frescos.",
    custoUnitario: 15.40,
    modalityConfig: {
      evento: { active: true, cost: 15.40, price: 30 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: true, cost: 15.40, price: 30 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-abacaxi",
    nome: "Caipivodka Abacaxi",
    categoria: "Vodka",
    descricao: "Vodka, abacaxi e raspas de limão.",
    custoUnitario: 15.40,
    modalityConfig: {
      evento: { active: true, cost: 15.40, price: 30 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: true, cost: 15.40, price: 30 }
    },
    imagem: "https://images.unsplash.com/photo-1587223962905-276f75608b4f?w=400&auto=format&fit=crop"
  },
  {
    id: "caipivodka-maracuja",
    nome: "Caipivodka Maracujá",
    categoria: "Vodka",
    descricao: "Vodka, maracujá e açúcar de baunilha.",
    custoUnitario: 15.40,
    modalityConfig: {
      evento: { active: true, cost: 15.40, price: 30 },
      steakhouse: { active: true, cost: 15.40, price: 30 },
      goatbotequim: { active: true, cost: 15.40, price: 30 }
    },
    imagem: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop"
  },
  {
    id: "mojito",
    nome: "Mojito",
    categoria: "Rum",
    descricao: "Rum, limão, hortelã e água com gás.",
    custoUnitario: 16.76,
    modalityConfig: {
      evento: { active: true, cost: 16.76, price: 32 },
      steakhouse: { active: true, cost: 16.76, price: 32 },
      goatbotequim: { active: true, cost: 16.76, price: 32 }
    },
    imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop"
  },
  {
    id: "sex-on-the-beach",
    nome: "Sex on the Beach",
    categoria: "Vodka",
    descricao: "Vodka, suco de laranja, xarope de pêssego e grenadine.",
    custoUnitario: 6.62,
    modalityConfig: {
      evento: { active: true, cost: 6.62 },
      steakhouse: { active: true, cost: 17.76, price: 32 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop"
  },
  {
    id: "aquario",
    nome: "Aquário",
    categoria: "Vodka",
    descricao: "Vodka, limão, curaçao, alecrim e água com gás.",
    custoUnitario: 17.26,
    modalityConfig: {
      evento: { active: true, cost: 17.26, price: 32 },
      steakhouse: { active: true, cost: 17.26, price: 32 },
      goatbotequim: { active: true, cost: 17.26, price: 32 }
    },
    imagem: "https://images.unsplash.com/photo-1597290282695-edc43d0e7129?w=400&auto=format&fit=crop"
  },
  {
    id: "moscow-mule",
    nome: "Moscow Mule",
    categoria: "Vodka",
    descricao: "Vodka, limão e sifão de gengibre.",
    custoUnitario: 17.55,
    modalityConfig: {
      evento: { active: true, cost: 17.55, price: 35 },
      steakhouse: { active: true, cost: 17.55, price: 35 },
      goatbotequim: { active: true, cost: 17.55, price: 35 }
    },
    imagem: "https://images.unsplash.com/photo-1513415277900-a62401e19be4?w=400&auto=format&fit=crop"
  },
  {
    id: "london-mule",
    nome: "London Mule",
    categoria: "Gin",
    descricao: "Gin, limão e sifão de gengibre.",
    custoUnitario: 5.76,
    modalityConfig: {
      evento: { active: true, cost: 5.76 },
      steakhouse: { active: true, cost: 18.55, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1513415277900-a62401e19be4?w=400&auto=format&fit=crop"
  },
  {
    id: "gin-tonica",
    nome: "Gin Tônica",
    categoria: "Gin",
    descricao: "Gin, tônica, limão siciliano e especiarias.",
    custoUnitario: 18.55,
    modalityConfig: {
      evento: { active: true, cost: 18.55, price: 35 },
      steakhouse: { active: true, cost: 18.55, price: 35 },
      goatbotequim: { active: true, cost: 18.55, price: 35 }
    },
    imagem: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&auto=format&fit=crop"
  },
  {
    id: "fitz-gerald",
    nome: "Fitz Gerald",
    categoria: "Gin",
    descricao: "Gin, limão, angostura e twist.",
    custoUnitario: 19.55,
    modalityConfig: {
      evento: { active: true, cost: 19.55, price: 35 },
      steakhouse: { active: true, cost: 19.55, price: 35 },
      goatbotequim: { active: true, cost: 19.55, price: 35 }
    },
    imagem: "https://images.unsplash.com/photo-1544145945-f904253d0c7b?w=400&auto=format&fit=crop"
  },
  {
    id: "tom-collins",
    nome: "Tom Collins",
    categoria: "Gin",
    descricao: "Gin, limão, água com gás e cereja.",
    custoUnitario: 5.91,
    modalityConfig: {
      evento: { active: true, cost: 5.91 },
      steakhouse: { active: true, cost: 19.05, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop"
  },
  {
    id: "aperol-spritz",
    nome: "Aperol Spritz",
    categoria: "Aperitivos",
    descricao: "Aperol, espumante, laranja e água com gás.",
    custoUnitario: 10.50,
    modalityConfig: {
      evento: { active: true, cost: 10.50 },
      steakhouse: { active: true, cost: 20.50, price: 35 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1560512823-829485b8bf24?w=400&auto=format&fit=crop"
  },
  {
    id: "cest-la-vie",
    nome: "C’est lá vie",
    categoria: "Gin",
    descricao: "Xarope, limão, espumante, água com gás e gelo.",
    custoUnitario: 9.51,
    modalityConfig: {
      evento: { active: true, cost: 9.51 },
      steakhouse: { active: true, cost: 22.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop"
  },
  {
    id: "expresso-martini",
    nome: "Expresso Martini",
    categoria: "Vodka",
    descricao: "Vodka, açúcar baunilha, bailays e café.",
    custoUnitario: 4.86,
    modalityConfig: {
      evento: { active: true, cost: 4.86 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1544145945-f904253d0c7b?w=400&auto=format&fit=crop"
  },
  {
    id: "apple-martini",
    nome: "Apple Martini",
    categoria: "Vodka",
    descricao: "Xarope e vodka.",
    custoUnitario: 3.70,
    modalityConfig: {
      evento: { active: true, cost: 3.70 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1587223962905-276f75608b4f?w=400&auto=format&fit=crop"
  },
  {
    id: "stamping",
    nome: "Stamping",
    categoria: "Vodka",
    descricao: "Vodka, maracujá, limão, açúcar baunilha e tabasco.",
    custoUnitario: 3.90,
    modalityConfig: {
      evento: { active: true, cost: 3.90 },
      steakhouse: { active: true, cost: 20.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop"
  },
  {
    id: "mint-jullep",
    nome: "Mint Jullep",
    categoria: "Whisky",
    descricao: "Whisky, limão e hortelã.",
    custoUnitario: 5.50,
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
    modalityConfig: {
      evento: { active: true, cost: 5.80 },
      steakhouse: { active: true, cost: 21.70, price: 40 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "old-fashioned",
    nome: "Old Fashioned",
    categoria: "Whisky",
    descricao: "Whisky premium, angostura e açúcar.",
    custoUnitario: 24.35,
    modalityConfig: {
      evento: { active: true, cost: 13.00 },
      steakhouse: { active: true, cost: 24.35, price: 45 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "negroni",
    nome: "Negroni",
    categoria: "Gin",
    descricao: "Gin, vermute e campari.",
    custoUnitario: 25.35,
    modalityConfig: {
      evento: { active: true, cost: 9.70 },
      steakhouse: { active: true, cost: 25.35, price: 45 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop"
  },
  {
    id: "soda-italiana",
    nome: "Soda Italiana",
    categoria: "Sem Álcool",
    descricao: "Xarope e água com gás.",
    custoUnitario: 3.34,
    modalityConfig: {
      evento: { active: true, cost: 3.34 },
      steakhouse: { active: true, cost: 10.00, price: 25 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "campari-tonica",
    nome: "Campari Tônica",
    categoria: "Aperitivos",
    descricao: "Campari, tônica e twist de laranja.",
    custoUnitario: 9.70,
    modalityConfig: {
      evento: { active: true, cost: 9.70 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop"
  },
  {
    id: "paloma",
    nome: "Paloma",
    categoria: "Tequila",
    descricao: "Tequila, xarope grapefruit, limão e grapefruit.",
    custoUnitario: 13.98,
    modalityConfig: {
      evento: { active: true, cost: 13.98 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&auto=format&fit=crop"
  },
  {
    id: "bossa-nova",
    nome: "Bossa Nova",
    categoria: "Vodka",
    descricao: "Vodka, uva e água de coco.",
    custoUnitario: 4.00,
    modalityConfig: {
      evento: { active: true, cost: 4.00 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&auto=format&fit=crop"
  },
  {
    id: "bramble",
    nome: "Bramble",
    categoria: "Gin",
    descricao: "Gin, limão e xarope de amora.",
    custoUnitario: 7.06,
    modalityConfig: {
      evento: { active: true, cost: 7.06 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&auto=format&fit=crop"
  },
  {
    id: "olho-grego",
    nome: "Olho Grego",
    categoria: "Vodka",
    descricao: "Vodka, limão e xaropes especiais.",
    custoUnitario: 7.00,
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
    descricao: "Vodka, cramberry, limão e cointreau.",
    custoUnitario: 8.97,
    modalityConfig: {
      evento: { active: true, cost: 8.97 },
      steakhouse: { active: false, cost: 0 },
      goatbotequim: { active: false, cost: 0 }
    },
    imagem: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&auto=format&fit=crop"
  },

  // --- DOSES BOTEQUIM ---
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
    },
    imagem: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop"
  },
  {
    id: "dose-vodka",
    nome: "Vodka (Dose)",
    categoria: "Doses",
    descricao: "Dose de vodka standard.",
    custoUnitario: 3.00,
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
  // --- DRINKS ---
  const custoBaseDrinks = evento.drinks.reduce((acc, drinkId) => {
    const drink = drinks.find(d => d.id === drinkId);
    return acc + (drink?.custoUnitario || 0);
  }, 0);
  
  const totalDoses = evento.convidados * evento.drinksPorPessoa;
  const mediaCustoDrinks = evento.drinks.length > 0 ? (custoBaseDrinks / evento.drinks.length) : 0;
  
  const valorDrinksEvento = totalDoses * mediaCustoDrinks * (1 + (evento.markupAdicionalDrinks || 0) / 100);

  // --- EQUIPE ---
  const valorEquipe = Object.values(evento.equipe).reduce((acc, p) => acc + (p.qtd * p.valorUnitario), 0);

  // --- GELO ---
  const pacotesGelo = evento.gelo?.pacotesOverride || Math.ceil((evento.convidados / 100) * 35);
  const valorGelo = pacotesGelo * (evento.gelo?.valorUnitario || 6);

  // --- LOGÍSTICA ---
  const valorGasolina = evento.viagem?.incluir ? evento.viagem.valor : 0;

  // --- GASTOS DIVERSOS ---
  const valorGastosDiversos = (evento.gastosDiversos || []).reduce((acc, g) => acc + g.valor, 0);

  // --- TOTAIS ---
  const custoTotalOrcamento = valorDrinksEvento + valorEquipe + valorGelo + valorGasolina + valorGastosDiversos;
  const valorTotalSemDesconto = custoTotalOrcamento + (evento.lucroDesejado || 0);
  const valorDesconto = evento.desconto || 0;
  const valorTotalOrcamento = valorTotalSemDesconto - valorDesconto;
  
  const lucro = valorTotalOrcamento - custoTotalOrcamento;
  const mediaPorPessoa = evento.convidados > 0 ? valorTotalOrcamento / evento.convidados : 0;
  
  const valorPago = (valorTotalOrcamento * (evento.pagamento?.percentualPago || 0)) / 100;
  const valorPendente = valorTotalOrcamento - valorPago;
  const percPago = evento.pagamento?.percentualPago || 0;
  const percPendente = 100 - percPago;
  
  let statusPagamento = "Não pago";
  if (percPago === 100) statusPagamento = "Pago integralmente";
  else if (percPago > 0) statusPagamento = "Parcialmente pago";

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
