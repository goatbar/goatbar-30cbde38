// Mock data store — realistic fictional data for the Goat Bar Management System.
// Designed to be replaced by Lovable Cloud queries in the future.

export type Unidade = "Eventos" | "7Steakhouse" | "Goat Botequim";

export interface Drink {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  ingredientes: string[];
  custoUnitario: number;
  custoUnitario: number;
  precoVenda7Steakhouse: number;
  precoVendaGoatBotequim: number;
  status: "ativo" | "inativo";
  disponibilidade: Unidade[];
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
// Precificação oficial Goat Bar — custo de insumos por dose.
// Preço de venda calculado com markup ~3.5x e arredondado para múltiplos de R$ 2.
const todasUnidades: Unidade[] = ["Eventos", "7Steakhouse", "Goat Botequim"];
const precoSugerido = (custo: number) => Math.max(18, Math.round((custo * 3.5) / 2) * 2);

interface DrinkSeed {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  ingredientes: { nome: string; custo: number }[];
  status?: "ativo" | "inativo";
  disponibilidade?: Unidade[];
  precoVenda7Steakhouse?: number;
  precoVendaGoatBotequim?: number;
  imagem?: string;
}

const drinkSeeds: DrinkSeed[] = [
  { id: "d1", nome: "Caipivodka Limão", categoria: "Caipirinhas", descricao: "Vodka e limão.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }], imagem: "/drinks/d1.jpg" },
  { id: "d2", nome: "Caipivodka limão cravo e mel", categoria: "Caipirinhas", descricao: "Vodka, limão cravo e mel.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Cravo", custo: 0.1 }, { nome: "Mel", custo: 0.4 }], imagem: "/drinks/d2.jpg" },
  { id: "d3", nome: "Caipivodka Morango", categoria: "Caipirinhas", descricao: "Vodka e morango.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Morango", custo: 1.6 }], imagem: "/drinks/d3.jpg" },
  { id: "d4", nome: "Caipivodka Abacaxi", categoria: "Caipirinhas", descricao: "Vodka, abacaxi e raspas.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Abacaxi", custo: 0.5 }, { nome: "Raspas", custo: 0.3 }], imagem: "/drinks/d4.jpg" },
  { id: "d5", nome: "Caip Maracujá com baunilha", categoria: "Caipirinhas", descricao: "Vodka, maracujá e açúcar de baunilha.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Maracujá", custo: 0.9 }, { nome: "Açúcar Baunilha", custo: 0.3 }], imagem: "/drinks/d5.jpg" },
  { id: "d6", nome: "Moscow Mule", categoria: "Mules", descricao: "Vodka, limão e sifão.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Sifão", custo: 0.9 }], imagem: "/drinks/d6.jpg" },
  { id: "d7", nome: "London Mule", categoria: "Mules", descricao: "Gin, limão e sifão.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Limão", custo: 0.2 }, { nome: "Sifão", custo: 0.9 }], imagem: "/drinks/d7.jpg" },
  { id: "d8", nome: "Mojito", categoria: "Refrescantes", descricao: "Vodka, limão, hortelã e água com gás.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Hortelã", custo: 0.5 }, { nome: "Água com gás", custo: 0.3 }], imagem: "/drinks/d8.jpg" },
  { id: "d9", nome: "Aquario", categoria: "Autoral", descricao: "Vodka, limão, curaçao, alecrim, açúcar e água com gás.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Curaçao", custo: 1.0 }, { nome: "Alecrim", custo: 0.25 }, { nome: "Açúcar", custo: 0.5 }, { nome: "Agua com gas", custo: 0.3 }], imagem: "/drinks/d9.jpg" },
  { id: "d10", nome: "Sex on The Beach", categoria: "Tropicais", descricao: "Vodka, suco de laranja, xarope pêssego, grenadine e jujuba.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Suco laranja", custo: 0.8 }, { nome: "Xarope pêssego", custo: 2.64 }, { nome: "Grenadine", custo: 0.88 }, { nome: "Jujuba", custo: 0.3 }], imagem: "/drinks/d10.jpg" },
  { id: "d11", nome: "Bossa Nova", categoria: "Tropicais", descricao: "Vodka, uva e água de coco.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Uva", custo: 1.0 }, { nome: "Água de coco", custo: 1.0 }], imagem: "/drinks/d11.jpg" },
  { id: "d12", nome: "Gin tônica", categoria: "Gin", descricao: "Gin, tônica, limão siciliano e especiaria.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Tônica", custo: 1.5 }, { nome: "Limão siciliano", custo: 0.3 }, { nome: "Especiaria", custo: 0.25 }], imagem: "/drinks/d12.jpg" },
  { id: "d13", nome: "Tom Collins", categoria: "Clássico", descricao: "Gin, limão, água com gás e cereja.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Limão", custo: 0.2 }, { nome: "Água com gás", custo: 0.3 }, { nome: "Cereja", custo: 0.75 }], imagem: "/drinks/d13.jpg" },
  { id: "d14", nome: "Fitzgerald", categoria: "Clássico", descricao: "Gin, limão, angostura e twist.", ingredientes: [{ nome: "Gin", custo: 4.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Angostura", custo: 2.83 }, { nome: "Twist", custo: 0.2 }], imagem: "/drinks/d14.jpg" },
  { id: "d15", nome: "Bramble", categoria: "Gin", descricao: "Gin, limão, xarope de amora e guarnição.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Limão", custo: 0.2 }, { nome: "Xarope amora", custo: 1.4 }, { nome: "Guarnicao", custo: 0.8 }], imagem: "/drinks/bramble.jpg" },
  { id: "d16", nome: "Aperol Spritz", categoria: "Aperitivo", descricao: "Aperol, champanhe, laranja e água com gás.", ingredientes: [{ nome: "Aperol", custo: 4.0 }, { nome: "Champanhe", custo: 6.0 }, { nome: "Laranja", custo: 0.2 }, { nome: "Água com gás", custo: 0.3 }], imagem: "/drinks/d16.jpg" },
  { id: "d17", nome: "Cest Lá Vie", categoria: "Autoral", descricao: "Xarope, limão, champanhe, água com gás e gelo.", ingredientes: [{ nome: "Xarope", custo: 2.64 }, { nome: "Limão", custo: 0.2 }, { nome: "Champanhe", custo: 6.0 }, { nome: "Água com gás", custo: 0.3 }, { nome: "Gelo", custo: 0.37 }], imagem: "/drinks/d17.jpg" },
  { id: "d18", nome: "Mint Jullep", categoria: "Whisky", descricao: "Whisky, limão e hortelã.", ingredientes: [{ nome: "Whisky", custo: 5.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Hortelã", custo: 0.3 }], imagem: "/drinks/d18.jpg" },
  { id: "d19", nome: "Whisky Sour", categoria: "Sour", descricao: "Whisky, limão, proteina e guarnicao.", ingredientes: [{ nome: "Whisky", custo: 5.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Proteina", custo: 0.3 }, { nome: "Guarnicao", custo: 0.3 }], imagem: "/drinks/d19.jpg" },
  { id: "d20", nome: "Negroni", categoria: "Clássico", descricao: "Vermute, gin e campari.", ingredientes: [{ nome: "Vermute", custo: 2.2 }, { nome: "Gin", custo: 4.0 }, { nome: "Campari", custo: 3.5 }], imagem: "/drinks/d20.jpg" },
  { id: "d21", nome: "Campari Tônica", categoria: "Aperitivo", descricao: "Tônica, campari e twist laranja.", ingredientes: [{ nome: "Tônica", custo: 1.5 }, { nome: "Campari", custo: 8.0 }, { nome: "Twist laranja", custo: 0.2 }] },
  { id: "d22", nome: "Raspberry", categoria: "Autoral", descricao: "Vodka, coulis e espuma.", ingredientes: [{ nome: "Vodka", custo: 4.0 }, { nome: "Coulis", custo: 0 }, { nome: "Espuma", custo: 0 }], status: "inativo" },
  { id: "d23", nome: "Stamping", categoria: "Autoral", descricao: "Vodka, maracuja, limão, açúcar baunilha e tabasco.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Maracuja", custo: 0.9 }, { nome: "Limão", custo: 0.2 }, { nome: "Açúcar baunilha", custo: 0.3 }, { nome: "Tabasco", custo: 0.4 }], imagem: "/drinks/d23.jpg" },
  { id: "d24", nome: "Olho Grego", categoria: "Autoral", descricao: "Vodka, limão, xarope amendoas e xarope curaçao.", ingredientes: [{ nome: "Vodka", custo: 4.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Xorape amendoas", custo: 1.4 }, { nome: "Xarope curaçao", custo: 1.4 }], imagem: "/drinks/olho-grego.jpg" },
  { id: "d25", nome: "Cosmopolitan", categoria: "Clássico", descricao: "Vodka, xarope cramberry, limão e cointreau.", ingredientes: [{ nome: "Vodka", custo: 4.0 }, { nome: "Xarope Cramberry", custo: 2.1 }, { nome: "Limão", custo: 0.2 }, { nome: "Cointreau", custo: 2.57 }], imagem: "/drinks/cosmopolitan.jpg" },
  { id: "d26", nome: "Apple Martini", categoria: "Martini", descricao: "Xarope e vodka.", ingredientes: [{ nome: "Xarope", custo: 2.2 }, { nome: "Vodka", custo: 2.0 }], imagem: "/drinks/d26.jpg" },
  { id: "d27", nome: "Expresso Martini", categoria: "Martini", descricao: "Vodka, açúcar baunilha, baileys e café.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Açúcar baunilha", custo: 0.5 }, { nome: "Bailays", custo: 1.86 }, { nome: "Café", custo: 0.5 }], imagem: "/drinks/d27.jpg" },
  { id: "d28", nome: "Paloma", categoria: "Tequila", descricao: "Tequila, xarope grapefruit, limão e grapefruit.", ingredientes: [{ nome: "Tequila", custo: 10.73 }, { nome: "Xarope grapefruit", custo: 2.8 }, { nome: "Limão", custo: 0.2 }, { nome: "Grapefruit", custo: 0.25 }], imagem: "/drinks/paloma.jpg" },
  { id: "d29", nome: "Soda Italiana", categoria: "Sem álcool", descricao: "Xarope e água com gás.", ingredientes: [{ nome: "Xarope", custo: 2.64 }, { nome: "Água com gás", custo: 0.7 }] },
];

export const drinks: Drink[] = drinkSeeds.map((s) => {
  const custo = +s.ingredientes.reduce((a, i) => a + i.custo, 0).toFixed(2);
  return {
    id: s.id,
    nome: s.nome,
    categoria: s.categoria,
    descricao: s.descricao,
    ingredientes: s.ingredientes.map((i) => i.nome),
    custoUnitario: custo,
    precoVenda7Steakhouse: s.precoVenda7Steakhouse ?? Math.max(18, Math.round((custo * 3.0) / 2) * 2),
    precoVendaGoatBotequim: s.precoVendaGoatBotequim ?? Math.max(15, Math.round((custo * 2.8) / 2) * 2),
    status: s.status ?? "ativo",
    disponibilidade: s.disponibilidade ?? todasUnidades,
    imagem: s.imagem,
  };
});

export const fichaTecnica = Object.fromEntries(
  drinkSeeds.map((s) => [s.id, s.ingredientes]),
);

export const margem = (precoVenda: number, custo: number) => ((precoVenda - custo) / precoVenda) * 100;

// ─── Vendas (90 dias) ─────────────────────────────────────────────────────
export const vendas: Venda[] = [];

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
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const fmtBRL2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;
export const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
