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
  precoVenda: number;
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
  equipe: number;
  valorNegociado: number;
  custoPrevisto: number;
  observacoes: string;
  status: "rascunho" | "confirmado" | "em_andamento" | "concluido" | "cancelado";
  contratoId?: string;
}

export interface Contrato {
  id: string;
  eventoId: string;
  cliente: string;
  status: "rascunho" | "enviado" | "assinado";
  criadoEm: string;
  template: string;
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
  { id: "d1", nome: "Negroni Goat", categoria: "Clássico", descricao: "Gin, Campari, vermute rosso, twist de laranja queimada.", ingredientes: ["Gin", "Campari", "Vermute Rosso", "Laranja"], custoUnitario: 9.5, precoVenda: 38, status: "ativo", disponibilidade: ["Eventos", "7Steakhouse", "Goat Botequim"] },
  { id: "d2", nome: "Old Fashioned 7", categoria: "Clássico", descricao: "Bourbon, açúcar demerara, angostura, casca de laranja.", ingredientes: ["Bourbon", "Demerara", "Angostura"], custoUnitario: 12, precoVenda: 46, status: "ativo", disponibilidade: ["7Steakhouse", "Eventos"] },
  { id: "d3", nome: "Goat Smash", categoria: "Autoral", descricao: "Mezcal, hortelã, limão siciliano, xarope de agave.", ingredientes: ["Mezcal", "Hortelã", "Limão", "Agave"], custoUnitario: 11, precoVenda: 42, status: "ativo", disponibilidade: ["Eventos", "Goat Botequim"] },
  { id: "d4", nome: "Espresso Martini", categoria: "Autoral", descricao: "Vodka, café espresso, licor de café, açúcar.", ingredientes: ["Vodka", "Espresso", "Licor de café"], custoUnitario: 8.5, precoVenda: 36, status: "ativo", disponibilidade: ["Eventos", "7Steakhouse", "Goat Botequim"] },
  { id: "d5", nome: "Caipirinha Premium", categoria: "Brasileiro", descricao: "Cachaça envelhecida, limão tahiti, açúcar mascavo.", ingredientes: ["Cachaça", "Limão", "Açúcar mascavo"], custoUnitario: 6, precoVenda: 28, status: "ativo", disponibilidade: ["Goat Botequim", "Eventos"] },
  { id: "d6", nome: "Penicillin", categoria: "Clássico", descricao: "Whisky escocês, mel, gengibre, limão, lagavulin float.", ingredientes: ["Whisky", "Mel", "Gengibre", "Limão"], custoUnitario: 13, precoVenda: 48, status: "ativo", disponibilidade: ["7Steakhouse"] },
  { id: "d7", nome: "Tonika de Pera", categoria: "Refrescante", descricao: "Gin, redução de pera, tônica artesanal, alecrim.", ingredientes: ["Gin", "Pera", "Tônica", "Alecrim"], custoUnitario: 10, precoVenda: 39, status: "ativo", disponibilidade: ["Eventos", "Goat Botequim"] },
  { id: "d8", nome: "Margarita Picante", categoria: "Autoral", descricao: "Tequila, cointreau, limão, pimenta dedo de moça.", ingredientes: ["Tequila", "Cointreau", "Limão", "Pimenta"], custoUnitario: 9, precoVenda: 36, status: "ativo", disponibilidade: ["Eventos", "Goat Botequim"] },
  { id: "d9", nome: "Sour de Maracujá", categoria: "Sour", descricao: "Bourbon, maracujá fresco, clara de ovo, demerara.", ingredientes: ["Bourbon", "Maracujá", "Clara"], custoUnitario: 8, precoVenda: 34, status: "ativo", disponibilidade: ["Eventos", "7Steakhouse"] },
  { id: "d10", nome: "Goat Spritz", categoria: "Aperitivo", descricao: "Aperol, prosecco, soda, laranja.", ingredientes: ["Aperol", "Prosecco", "Soda"], custoUnitario: 7.5, precoVenda: 32, status: "ativo", disponibilidade: ["Eventos", "Goat Botequim"] },
  { id: "d11", nome: "Boulevardier", categoria: "Clássico", descricao: "Bourbon, Campari, vermute rosso.", ingredientes: ["Bourbon", "Campari", "Vermute"], custoUnitario: 11, precoVenda: 44, status: "ativo", disponibilidade: ["7Steakhouse"] },
  { id: "d12", nome: "Mule de Maçã Verde", categoria: "Refrescante", descricao: "Vodka, suco de maçã verde, gengibre, limão.", ingredientes: ["Vodka", "Maçã verde", "Gengibre"], custoUnitario: 7, precoVenda: 30, status: "inativo", disponibilidade: ["Goat Botequim"] },
];

export const margem = (d: Drink) => ((d.precoVenda - d.custoUnitario) / d.precoVenda) * 100;

// ─── Vendas (90 dias) ─────────────────────────────────────────────────────
function geraVendas(): Venda[] {
  const out: Venda[] = [];
  const hoje = new Date();
  const ativas = drinks.filter((d) => d.status === "ativo");
  for (let i = 0; i < 90; i++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    const numLanc = 6 + Math.floor(Math.random() * 8);
    for (let j = 0; j < numLanc; j++) {
      const d = ativas[Math.floor(Math.random() * ativas.length)];
      const unidades = d.disponibilidade.filter((u) => u !== "Eventos");
      const u: Unidade = unidades.length ? unidades[Math.floor(Math.random() * unidades.length)] : "7Steakhouse";
      const qtd = 1 + Math.floor(Math.random() * 6);
      out.push({
        id: `v${i}-${j}`,
        data: data.toISOString(),
        unidade: u,
        drinkId: d.id,
        drinkNome: d.nome,
        quantidade: qtd,
        precoUnitario: d.precoVenda,
        custoUnitario: d.custoUnitario,
      });
    }
  }
  return out;
}
export const vendas: Venda[] = geraVendas();

// ─── Eventos ──────────────────────────────────────────────────────────────
export const eventos: Evento[] = [
  { id: "e1", nome: "Casamento Helena & Rafael", cliente: "Helena Vasconcellos", telefone: "(11) 98765-4321", email: "helena@email.com", data: "2026-05-12", horario: "19:00", local: "Villa Bisutti", cidade: "São Paulo", tipo: "Casamento", convidados: 220, drinks: ["d1", "d3", "d7", "d10"], equipe: 9, valorNegociado: 48000, custoPrevisto: 18500, observacoes: "Bar principal + ilha de drinks autorais.", status: "confirmado", contratoId: "c1" },
  { id: "e2", nome: "Corporativo Itaú BBA", cliente: "Itaú BBA", telefone: "(11) 3000-1000", email: "eventos@itaubba.com", data: "2026-04-29", horario: "18:30", local: "Auditório Faria Lima", cidade: "São Paulo", tipo: "Corporativo", convidados: 320, drinks: ["d4", "d10", "d8"], equipe: 12, valorNegociado: 62000, custoPrevisto: 24000, observacoes: "Coquetel de lançamento.", status: "em_andamento", contratoId: "c2" },
  { id: "e3", nome: "Aniversário 40 — Marcelo", cliente: "Marcelo Andrade", telefone: "(11) 99999-1111", email: "marcelo@email.com", data: "2026-06-08", horario: "21:00", local: "Casa do Cliente", cidade: "Alphaville", tipo: "Aniversário", convidados: 90, drinks: ["d1", "d2", "d6"], equipe: 4, valorNegociado: 19500, custoPrevisto: 7800, observacoes: "Whisky bar temático.", status: "confirmado" },
  { id: "e4", nome: "Casamento Bárbara & Tiago", cliente: "Bárbara Lima", telefone: "(11) 91234-5678", email: "barbara@email.com", data: "2026-03-15", horario: "20:00", local: "Fazenda 7 Lagos", cidade: "Itu", tipo: "Casamento", convidados: 180, drinks: ["d3", "d5", "d10"], equipe: 8, valorNegociado: 42000, custoPrevisto: 16200, observacoes: "Bar com identidade rústica.", status: "concluido" },
  { id: "e5", nome: "Lançamento Porsche Cayenne", cliente: "Porsche Center", telefone: "(11) 4000-5555", email: "marketing@porsche.com.br", data: "2026-05-22", horario: "19:30", local: "Showroom Berrini", cidade: "São Paulo", tipo: "Corporativo", convidados: 140, drinks: ["d2", "d6", "d11"], equipe: 6, valorNegociado: 35000, custoPrevisto: 13800, observacoes: "VIP, foco em destilados premium.", status: "rascunho" },
];

// ─── Contratos ────────────────────────────────────────────────────────────
export const contratos: Contrato[] = [
  { id: "c1", eventoId: "e1", cliente: "Helena Vasconcellos", status: "assinado", criadoEm: "2026-01-15", template: "Casamento Padrão" },
  { id: "c2", eventoId: "e2", cliente: "Itaú BBA", status: "enviado", criadoEm: "2026-02-02", template: "Corporativo" },
  { id: "c3", eventoId: "e3", cliente: "Marcelo Andrade", status: "rascunho", criadoEm: "2026-02-20", template: "Aniversário" },
];

// ─── Parâmetros de cálculo ────────────────────────────────────────────────
export const parametros: ParametroCalculo[] = [
  { id: "p1", chave: "repasse_percentual", label: "Percentual de repasse", valor: 15, unidade: "%", grupo: "Repasse", descricao: "Aplicado sobre receita líquida" },
  { id: "p2", chave: "custo_equipe_hora", label: "Custo de equipe por hora", valor: 65, unidade: "R$", grupo: "Custos" },
  { id: "p3", chave: "custo_operacional_evento", label: "Custo operacional fixo por evento", valor: 850, unidade: "R$", grupo: "Custos" },
  { id: "p4", chave: "margem_minima", label: "Margem mínima aceitável", valor: 35, unidade: "%", grupo: "Operacional" },
  { id: "p5", chave: "markup_padrao", label: "Markup padrão", valor: 3.2, unidade: "x", grupo: "Operacional" },
  { id: "p6", chave: "perda_estimada", label: "Perdas estimadas", valor: 4, unidade: "%", grupo: "Operacional" },
  { id: "p7", chave: "quebra_copos", label: "Quebra de copos por 100 convidados", valor: 6, unidade: "un", grupo: "Operacional" },
  { id: "p8", chave: "consumo_medio_pessoa", label: "Consumo médio por convidado", valor: 4.5, unidade: "doses", grupo: "Consumo" },
  { id: "p9", chave: "gelo_kg_pessoa", label: "Gelo por convidado", valor: 1.2, unidade: "kg", grupo: "Consumo" },
  { id: "p10", chave: "insumos_pessoa", label: "Insumos por convidado", valor: 4.5, unidade: "R$", grupo: "Consumo" },
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
