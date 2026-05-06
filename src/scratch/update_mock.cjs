const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Goatbar-system', 'src', 'lib', 'mock-data.ts');
let content = fs.readFileSync(filePath, 'utf-8');

const drinkInterfaceOld = `export interface Drink {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  custoUnitario: number; // Exclusivo para Eventos
  modalityConfig: {`;

const drinkInterfaceNew = `export interface Insumo {
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
  modalityConfig: {`;

content = content.replace(drinkInterfaceOld, drinkInterfaceNew);

const newDrinksStr = `export const drinks: Drink[] = [
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
];`;

content = content.replace(/export const drinks: Drink\[\] = \[.*?\n\};\napplyPrices\(\);\n/s, newDrinksStr + '\n');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done!');
