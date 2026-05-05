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
  precoVenda?: number;
  imagem?: string;
}

const drinkSeeds: DrinkSeed[] = [
  { id: "d1", nome: "Caipi Limão", categoria: "Caipirinhas", descricao: "Vodka, limão e simple syrup.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }], imagem: "/drinks/d1.jpg" },
  { id: "d2", nome: "Caipi Limão, Cravo e Mel", categoria: "Caipirinhas", descricao: "Vodka, limão, simple syrup, cravo e melaço.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Cravo", custo: 0.1 }, { nome: "Mel", custo: 0.4 }], imagem: "/drinks/d2.jpg" },
  { id: "d3", nome: "Caipi Morango", categoria: "Caipirinhas", descricao: "Vodka, morango e simple syrup.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Morango", custo: 1.6 }], imagem: "/drinks/d3.jpg" },
  { id: "d4", nome: "Caipi Abacaxi com Raspas de Limão Siciliano", categoria: "Caipirinhas", descricao: "Vodka, abacaxi, simple syrup e raspas de limão siciliano.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Abacaxi", custo: 0.5 }, { nome: "Raspas", custo: 0.3 }], imagem: "/drinks/d4.jpg" },
  { id: "d5", nome: "Caipi Maracujá", categoria: "Caipirinhas", descricao: "Vodka, maracujá, simple syrup e açúcar de baunilha.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Maracujá", custo: 0.9 }, { nome: "Açúcar Baunilha", custo: 0.3 }], imagem: "/drinks/d5.jpg" },
  { id: "d6", nome: "Moscow Mule", categoria: "Mules", descricao: "Vodka, suco de limão, simple syrup, espuma de gengibre e hortelã.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Sifão (ginger)", custo: 0.9 }], imagem: "/drinks/d6.jpg" },
  { id: "d7", nome: "London Mule", categoria: "Mules", descricao: "Gin, suco de limão, simple syrup, espuma de gengibre e hortelã.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Limão", custo: 0.2 }, { nome: "Sifão (ginger)", custo: 0.9 }], imagem: "/drinks/d7.jpg" },
  { id: "d8", nome: "Mojito", categoria: "Refrescantes", descricao: "Rum, limão, simple syrup, hortelã e água com gás.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Hortelã", custo: 0.5 }, { nome: "Água com gás", custo: 0.3 }], imagem: "/drinks/d8.jpg" },
  { id: "d9", nome: "Aquário", categoria: "Autoral", descricao: "Vodka, limão, simple syrup, curaçau blue e água com gás.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Curaçao", custo: 1.0 }, { nome: "Alecrim", custo: 0.25 }, { nome: "Açúcar", custo: 0.5 }, { nome: "Água com gás", custo: 0.3 }], imagem: "/drinks/d9.jpg" },
  { id: "d10", nome: "Sex on the Beach", categoria: "Tropicais", descricao: "Vodka, suco de laranja, licor de pêssego e grenadine.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Suco de laranja", custo: 0.8 }, { nome: "Xarope de pêssego", custo: 2.64 }, { nome: "Grenadine", custo: 0.88 }, { nome: "Jujuba", custo: 0.3 }], imagem: "/drinks/d10.jpg" },
  { id: "d11", nome: "Bossa Nova", categoria: "Tropicais", descricao: "Vodka, uva verde, simple syrup e água de coco.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Uva", custo: 1.0 }, { nome: "Água de coco", custo: 1.0 }], imagem: "/drinks/d11.jpg" },
  { id: "d12", nome: "Gin & Tônica", categoria: "Gin", descricao: "Gin, tônica, limão siciliano e especiarias.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Tônica", custo: 1.5 }, { nome: "Limão siciliano", custo: 0.3 }, { nome: "Especiaria", custo: 0.25 }], imagem: "/drinks/d12.jpg" },
  { id: "d13", nome: "Tom Collins", categoria: "Clássico", descricao: "Gin, limão, simple syrup, água com gás e cereja.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Limão", custo: 0.2 }, { nome: "Água com gás", custo: 0.3 }, { nome: "Cereja", custo: 0.75 }], imagem: "/drinks/d13.jpg" },
  { id: "d14", nome: "Fitzgerald", categoria: "Clássico", descricao: "Gin, limão, simple syrup e angostura bitter.", ingredientes: [{ nome: "Gin", custo: 4.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Angostura", custo: 2.83 }, { nome: "Twist", custo: 0.2 }], imagem: "/drinks/d14.jpg" },
  { id: "d15", nome: "Bramble", categoria: "Gin", descricao: "Gin, limão, simple syrup e xarope de amora.", ingredientes: [{ nome: "Gin", custo: 4.66 }, { nome: "Limão", custo: 0.2 }, { nome: "Simple syrup", custo: 0.2 }, { nome: "Xarope de amora", custo: 1.4 }], imagem: "/drinks/bramble.jpg" },
  { id: "d16", nome: "Aperol Spritz", categoria: "Aperitivo", descricao: "Espumante, aperol e água com gás.", ingredientes: [{ nome: "Aperol", custo: 4.0 }, { nome: "Champanhe", custo: 6.0 }, { nome: "Laranja", custo: 0.2 }, { nome: "Água com gás", custo: 0.3 }], imagem: "/drinks/d16.jpg" },
  { id: "d17", nome: "C'est la Vie", categoria: "Autoral", descricao: "Espumante, suco de limão e xarope de flor de sabugueiro.", ingredientes: [{ nome: "Xarope", custo: 2.64 }, { nome: "Limão", custo: 0.2 }, { nome: "Champanhe", custo: 6.0 }, { nome: "Água com gás", custo: 0.3 }, { nome: "Gelo", custo: 0.37 }], imagem: "/drinks/d17.jpg" },
  { id: "d18", nome: "Mint Julep", categoria: "Whisky", descricao: "Whisky, limão, simple syrup e hortelã.", ingredientes: [{ nome: "Whisky", custo: 5.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Hortelã", custo: 0.3 }], imagem: "/drinks/d18.jpg" },
  { id: "d19", nome: "Whisky Sour", categoria: "Sour", descricao: "Whisky, limão, simple syrup e proteína.", ingredientes: [{ nome: "Whisky", custo: 5.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Proteína", custo: 0.3 }, { nome: "Guarnição", custo: 0.3 }], imagem: "/drinks/d19.jpg" },
  { id: "d20", nome: "Negroni", categoria: "Clássico", descricao: "Gin, Campari e Vermute Rosso.", ingredientes: [{ nome: "Vermute", custo: 2.2 }, { nome: "Gin", custo: 4.0 }, { nome: "Campari", custo: 3.5 }], imagem: "/drinks/d20.jpg" },
  { id: "d21", nome: "Campari Tônica", categoria: "Aperitivo", descricao: "Campari, tônica e twist de laranja.", ingredientes: [{ nome: "Tônica", custo: 1.5 }, { nome: "Campari", custo: 8.0 }, { nome: "Twist laranja", custo: 0.2 }] },
  { id: "d22", nome: "Raspberry", categoria: "Autoral", descricao: "Vodka, coulis de framboesa e espuma cítrica.", ingredientes: [{ nome: "Vodka", custo: 4.0 }, { nome: "Coulis", custo: 0 }, { nome: "Espuma", custo: 0 }], status: "inativo" },
  { id: "d23", nome: "Stamping Passion", categoria: "Autoral", descricao: "Vodka, maracujá, limão, simple syrup, tabasco e açúcar de baunilha.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Maracujá", custo: 0.9 }, { nome: "Limão", custo: 0.2 }, { nome: "Açúcar baunilha", custo: 0.3 }, { nome: "Tabasco", custo: 0.4 }], imagem: "/drinks/d23.jpg" },
  { id: "d24", nome: "Olho Grego", categoria: "Autoral", descricao: "Vodka, limão, xarope amêndoas e xarope Curaçau Blue e espuma cítrica.", ingredientes: [{ nome: "Vodka", custo: 4.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Xarope amêndoas", custo: 1.4 }, { nome: "Xarope Curaçau Blue", custo: 1.4 }, { nome: "Espuma cítrica", custo: 1.0 }], imagem: "/drinks/olho-grego.jpg" },
  { id: "d25", nome: "Cosmopolitan", categoria: "Clássico", descricao: "Vodka, limão, xarope cramberry e cointreau.", ingredientes: [{ nome: "Vodka", custo: 4.0 }, { nome: "Limão", custo: 0.2 }, { nome: "Xarope cramberry", custo: 2.1 }, { nome: "Cointreau", custo: 2.57 }], imagem: "/drinks/cosmopolitan.jpg" },
  { id: "d26", nome: "Apple Martini", categoria: "Martini", descricao: "Vodka, suco de limão e licor de maçã verde.", ingredientes: [{ nome: "Xarope", custo: 2.2 }, { nome: "Vodka", custo: 2.0 }], imagem: "/drinks/d26.jpg" },
  { id: "d27", nome: "Expresso Martini", categoria: "Martini", descricao: "Vodka, café e licor de café.", ingredientes: [{ nome: "Vodka", custo: 2.0 }, { nome: "Açúcar baunilha", custo: 0.5 }, { nome: "Baileys", custo: 1.86 }, { nome: "Café", custo: 0.5 }], imagem: "/drinks/d27.jpg" },
  { id: "d28", nome: "Paloma", categoria: "Tequila", descricao: "Tequila, limão, grapefruit, topo de água com gás.", ingredientes: [{ nome: "Tequila", custo: 10.73 }, { nome: "Limão", custo: 0.2 }, { nome: "Grapefruit", custo: 0.25 }, { nome: "Água com gás", custo: 0.3 }], imagem: "/drinks/paloma.jpg" },
  { id: "d29", nome: "Soda Italiana", categoria: "Sem álcool", descricao: "Xarope artesanal e água com gás.", ingredientes: [{ nome: "Xarope", custo: 2.64 }, { nome: "Água com gás", custo: 0.7 }] },
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
    precoVenda: s.precoVenda ?? precoSugerido(custo),
    status: s.status ?? "ativo",
    disponibilidade: s.disponibilidade ?? todasUnidades,
    imagem: s.imagem,
  };
});

export const fichaTecnica = Object.fromEntries(
  drinkSeeds.map((s) => [s.id, s.ingredientes]),
);

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
