import { describe, expect, it } from "vitest";
import {
  buildEventMenuModel,
  calculateMenuLayout,
  computeDrinkLayout,
  paginateEventMenuDrinks,
  resolveEventMenuDrinks,
  resolveEventMenuPersonalization,
  wrapText,
  MENU_PAGE_WIDTH,
  MENU_PAGE_HEIGHT,
  MENU_DRINKS_TOP,
  MENU_FOOTER_TOP,
  MENU_PERSONALIZATION_TOP,
  MENU_TYPOGRAPHY,
  type EventMenuDrink,
} from "@/lib/event-menu";
import type { Drink } from "@/lib/mock-data";

const modalityConfig = {
  evento: { active: true, cost: 5 },
  steakhouse: { active: false, cost: 0 },
  goatbotequim: { active: false, cost: 0 },
};

const catalog: Drink[] = [
  {
    id: "d1",
    nome: "Moscow Mule",
    categoria: "Vodka",
    descricao: "Vodka, limão e espuma de gengibre.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d2",
    nome: "Gin Tônica",
    categoria: "Gin",
    descricao: "Gin, tônica e botânicos.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d3",
    nome: "Caipi Morango",
    categoria: "Vodka",
    descricao: "Vodka, morango e simple syrup.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d4",
    nome: "Fitzgerald",
    categoria: "Gin",
    descricao: "Gin, limão, simple syrup e angustura bitter.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d5",
    nome: "Cosmopolitan",
    categoria: "Vodka",
    descricao: "Vodka, limão, cranberry e cointreau.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d6",
    nome: "Bramble",
    categoria: "Gin",
    descricao: "Gin, limão, simple syrup e xarope de amora.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d7",
    nome: "Apple Martini",
    categoria: "Vodka",
    descricao: "Vodka, suco de limão e licor de maçã verde.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d8",
    nome: "Bossa Nova",
    categoria: "Vodka",
    descricao: "Vodka, uva verde, simple syrup e água de côco.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d9",
    nome: "Mojito",
    categoria: "Rum",
    descricao: "Rum, limão, simple syrup, hortelã e água com gás.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d10",
    nome: "Expresso Martini",
    categoria: "Vodka",
    descricao: "Vodka, café e licor de café.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d11",
    nome: "Penicillin",
    categoria: "Whisky",
    descricao: "Whisky escocês, limão, mel, gengibre e single malt.",
    custoUnitario: 7,
    modalityConfig,
  },
  {
    id: "d12",
    nome: "Aperol Spritz",
    categoria: "Espumante",
    descricao: "Aperol, espumante prosecco, água com gás e rodela de laranja.",
    custoUnitario: 6,
    modalityConfig,
  },
  {
    id: "d13",
    nome: "Whisky Sour",
    categoria: "Whisky",
    descricao: "Bourbon whisky, suco de limão siciliano, xarope de açúcar e clara de ovo pasteurizada.",
    custoUnitario: 7,
    modalityConfig,
  },
  {
    id: "d14",
    nome: "Negroni Clássico",
    categoria: "Gin",
    descricao: "Gin London Dry, vermute rosso artesanal, Campari e twist de casca de laranja bahia.",
    custoUnitario: 6.5,
    modalityConfig,
  },
  {
    id: "d-long-name",
    nome: "Caipi Abacaxi com Raspas de Limão Siciliano e Especiarias",
    categoria: "Vodka",
    descricao: "Vodka premium, abacaxi maduro em cubos, açúcar demerara e raspas frescas de limão siciliano.",
    custoUnitario: 5,
    modalityConfig,
  },
  {
    id: "d-long-desc",
    nome: "Gin Tropical Especial da Casa",
    categoria: "Gin",
    descricao: "Gin infusionado com zimbro, redução de maracujá com baunilha de madagascar, energético tropical premium, tônica artesanal e alecrim defumado na hora do serviço.",
    custoUnitario: 7,
    modalityConfig,
  },
];

describe("event menu - mandatory validation suite", () => {
  it("resolves persisted snapshots against the current catalog description", () => {
    const drinks = resolveEventMenuDrinks(
      { ids: ["d1"], items: [{ drink_id: "d1", name: "Moscow Mule", unit_cost: 5 }] },
      catalog,
    );
    expect(drinks[0]).toMatchObject({
      id: "d1",
      name: "Moscow Mule",
      description: "Vodka, limão e espuma de gengibre.",
    });
  });

  it("preserves a historical selected drink even when it is no longer in catalog", () => {
    const drinks = resolveEventMenuDrinks(
      { ids: ["old"], items: [{ drink_id: "old", name: "Drink antigo", unit_cost: 4 }] },
      catalog,
    );
    expect(drinks[0]).toMatchObject({ id: "old", name: "Drink antigo", description: "" });
  });

  it("garante que cada drink aparece exatamente uma vez (sem duplicatas)", () => {
    const drinks = resolveEventMenuDrinks(
      ["d1", "d1", "d2", "d2", "d3"],
      catalog,
    );
    expect(drinks).toHaveLength(3);
    const ids = drinks.map((d) => d.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("garante que a descrição corresponde fielmente ao cadastro do módulo de Drinks (sem IA reescrever)", () => {
    const drinks = resolveEventMenuDrinks(["d1", "d2", "d3"], catalog);
    expect(drinks[0].description).toBe(catalog[0].descricao);
    expect(drinks[1].description).toBe(catalog[1].descricao);
    expect(drinks[2].description).toBe(catalog[2].descricao);
  });

  it("garante padrão oficial Canva de tipografia: Neue Montreal 20pt para nome e 16pt para descrição", () => {
    expect(MENU_TYPOGRAPHY.drinkName.fontSize).toBe(20);
    expect(MENU_TYPOGRAPHY.drinkName.lineHeight).toBe(24);
    expect(MENU_TYPOGRAPHY.drinkName.color).toBe("#701117");

    expect(MENU_TYPOGRAPHY.drinkDescription.fontSize).toBe(16);
    expect(MENU_TYPOGRAPHY.drinkDescription.lineHeight).toBe(20);
    expect(MENU_TYPOGRAPHY.drinkDescription.color).toBe("#0f1414");
  });

  it("garante composição estrita em uma única coluna", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d2", "d3", "d4", "d5"],
      catalog,
    });
    expect(menu.columns).toBe(1);
  });

  it("garante medidas canônicas oficiais do modelo (567 x 850.5 pt)", () => {
    expect(MENU_PAGE_WIDTH).toBe(567);
    expect(MENU_PAGE_HEIGHT).toBe(850.5);
  });

  it("casamento: gera iniciais reais, preserva a ordem do cadastro e formata data", () => {
    const p1 = resolveEventMenuPersonalization({
      eventType: "Casamento",
      groomName: "Sidney",
      brideName: "Lúcia",
      date: "2025-05-14",
    });
    expect(p1).toEqual({
      kind: "wedding",
      initials: "SL",
      label: "Sidney & Lúcia",
      date: "14.05.2025",
    });

    // Ordem invertida no cadastro deve ser preservada
    const p2 = resolveEventMenuPersonalization({
      eventType: "Casamento",
      eventName: "Isidora & Christian",
      date: "2026-09-05",
    });
    expect(p2).toEqual({
      kind: "wedding",
      initials: "IC",
      label: "Isidora & Christian",
      date: "05.09.2026",
    });
  });

  it("aniversário, corporativo e despedida utilizam a personalização correta", () => {
    expect(resolveEventMenuPersonalization({ eventType: "Aniversário" })).toMatchObject({
      kind: "birthday",
      label: "Happy Birthday",
    });

    expect(resolveEventMenuPersonalization({ eventType: "Corporativo", eventName: "Gala Anual" })).toMatchObject({
      kind: "corporate",
      label: "Gala Anual",
    });

    expect(resolveEventMenuPersonalization({ eventType: "Confraternização", eventName: "Festa da Firma" })).toMatchObject({
      kind: "corporate",
      label: "Festa da Firma",
    });

    expect(resolveEventMenuPersonalization({ eventType: "Despedida de Solteiro" })).toMatchObject({
      kind: "bachelor",
      label: "Game Over",
    });
  });

  it("textos longos fazem wrap por palavras corretamente", () => {
    const longName = "Caipi Abacaxi Especial com Raspas de Limão Siciliano e Especiarias";
    const wrappedName = wrapText(longName, 43);
    expect(wrappedName.length).toBeGreaterThan(1);
    expect(wrappedName.join(" ")).toBe(longName);

    const longDesc = "Vodka premium artesanal, maracujá fresco, xarope de baunilha de madagascar e açúcar demerara aromatizado.";
    const wrappedDesc = wrapText(longDesc, 58);
    expect(wrappedDesc.length).toBeGreaterThan(1);
    expect(wrappedDesc.join(" ")).toBe(longDesc);

    const layout = computeDrinkLayout({
      id: "test",
      name: longName,
      description: longDesc,
    });
    expect(layout.nameLines.length).toBe(wrappedName.length);
    expect(layout.descriptionLines.length).toBe(wrappedDesc.length);
    expect(layout.blockHeight).toBeGreaterThan(48); // Mais que o padrão de 1 linha
  });

  it("preview e PDF compartilham o mesmo modelo de layout e cálculo", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d2", "d3"],
      catalog,
      eventType: "Casamento",
      groomName: "Sidney",
      brideName: "Lúcia",
      date: "2025-05-14",
    });

    expect(menu.computedLayout).toBeDefined();
    expect(menu.computedLayout.pageWidth).toBe(567);
    expect(menu.computedLayout.pageHeight).toBe(850.5);
    expect(menu.computedLayout.drinksAreaWidth).toBe(440);
    expect(menu.computedLayout.pages[0].drinksTop).toBe(MENU_DRINKS_TOP);
    expect(menu.computedLayout.pages[0].drinks).toHaveLength(3);
  });

  // TESTES DE CARGA E DISTRIBUIÇÃO VERTICAL OBRIGATÓRIOS: 3, 5, 8, 10, 14 drinks
  it("cenário 3 drinks: distribui verticalmente com espaçamento agradável e sem invadir zonas proibidas", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d2", "d3"],
      catalog,
      eventType: "Casamento",
      groomName: "A",
      brideName: "B",
    });

    expect(menu.pages).toHaveLength(1);
    const page = menu.computedLayout.pages[0];
    expect(page.drinks).toHaveLength(3);

    // Gap confortável para poucos drinks
    expect(page.gap).toBeGreaterThanOrEqual(20);
    expect(page.gap).toBeLessThanOrEqual(MENU_TYPOGRAPHY.maxGap);

    // Padding superior para centralizar
    expect(page.topPadding).toBeGreaterThan(50);

    // Validação de não-invasão
    const totalContentBottom = page.drinksTop + page.topPadding + page.drinks.reduce((s, d) => s + d.blockHeight, 0) + 2 * page.gap;
    expect(totalContentBottom).toBeLessThan(MENU_PERSONALIZATION_TOP);
  });

  it("cenário 5 drinks: distribuição equilibrada e harmônica em 1 página", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d2", "d3", "d4", "d5"],
      catalog,
      eventType: "Aniversário",
    });

    expect(menu.pages).toHaveLength(1);
    const page = menu.computedLayout.pages[0];
    expect(page.drinks).toHaveLength(5);
    expect(page.gap).toBeGreaterThanOrEqual(16);
    expect(page.gap).toBeLessThanOrEqual(MENU_TYPOGRAPHY.maxGap);

    const totalContentBottom = page.drinksTop + page.topPadding + page.drinks.reduce((s, d) => s + d.blockHeight, 0) + 4 * page.gap;
    expect(totalContentBottom).toBeLessThan(MENU_PERSONALIZATION_TOP);
  });

  it("cenário 8 drinks: preenchimento completo e equilibrado em 1 página", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8"],
      catalog,
      eventType: "Casamento",
      groomName: "Sidney",
      brideName: "Lúcia",
    });

    expect(menu.pages).toHaveLength(1);
    const page = menu.computedLayout.pages[0];
    expect(page.drinks).toHaveLength(8);
    expect(page.gap).toBeGreaterThanOrEqual(MENU_TYPOGRAPHY.minGap);

    const totalContentBottom = page.drinksTop + page.topPadding + page.drinks.reduce((s, d) => s + d.blockHeight, 0) + 7 * page.gap;
    expect(totalContentBottom).toBeLessThanOrEqual(MENU_PERSONALIZATION_TOP);
  });

  it("cenário 10 drinks: gera página 2 automaticamente, sem cortes e com personalização na última página", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d10"],
      catalog,
      eventType: "Casamento",
      groomName: "Sidney",
      brideName: "Lúcia",
    });

    expect(menu.pages.length).toBeGreaterThan(1);
    expect(menu.computedLayout.pages.length).toBeGreaterThan(1);

    // Personalização aparece na última página
    const lastPage = menu.computedLayout.pages.at(-1)!;
    expect(lastPage.isLastPage).toBe(true);
    expect(lastPage.personalization).not.toBeNull();
    expect(lastPage.personalization?.kind).toBe("wedding");

    // Primeira página não possui personalização
    const firstPage = menu.computedLayout.pages[0];
    expect(firstPage.isLastPage).toBe(false);
    expect(firstPage.personalization).toBeNull();

    // Nenhum drink cortado
    const totalRenderedDrinks = menu.computedLayout.pages.reduce((sum, p) => sum + p.drinks.length, 0);
    expect(totalRenderedDrinks).toBe(10);
  });

  it("cenário 14 drinks: gera páginas necessárias e garante ausência de overlap", () => {
    const menu = buildEventMenuModel({
      selectedDrinks: [
        "d1", "d2", "d3", "d4", "d5", "d6", "d7",
        "d8", "d9", "d10", "d11", "d12", "d13", "d14"
      ],
      catalog,
      eventType: "Corporativo",
      eventName: "Convenção Anual",
    });

    expect(menu.pages.length).toBeGreaterThanOrEqual(2);

    for (const page of menu.computedLayout.pages) {
      // Verifica ausência de overlap entre drinks consecutivos
      let currentY = page.drinksTop + page.topPadding;
      for (const drink of page.drinks) {
        expect(drink.blockHeight).toBeGreaterThan(0);
        const drinkBottom = currentY + drink.blockHeight;
        expect(drinkBottom).toBeLessThanOrEqual(MENU_FOOTER_TOP);
        currentY = drinkBottom + page.gap;
      }
    }
  });

  it("nomes e descrições longas: calcula altura real e pagina preventivamente sem estourar o rodapé", () => {
    const longDrinksCatalog: Drink[] = [
      {
        id: "l1",
        nome: "Caipi Abacaxi com Raspas de Limão Siciliano",
        categoria: "Vodka",
        descricao: "Vodka premium, abacaxi maduro em cubos, açúcar demerara e raspas frescas de limão siciliano.",
        custoUnitario: 5,
        modalityConfig,
      },
      {
        id: "l2",
        nome: "Gin Tropical Especial da Casa com Especiarias",
        categoria: "Gin",
        descricao: "Gin infusionado com zimbro, redução de maracujá com baunilha de madagascar, energético tropical premium, tônica artesanal e alecrim defumado na hora do serviço.",
        custoUnitario: 7,
        modalityConfig,
      },
      {
        id: "l3",
        nome: "Bramble Artesanal com Infusão de Amora Selvagem",
        categoria: "Gin",
        descricao: "Gin artesanal destilado em alambique de cobre, xarope caseiro de amora silvestre, suco fresco de limão taiti e gelo translúcido lapidado.",
        custoUnitario: 6,
        modalityConfig,
      },
      {
        id: "l4",
        nome: "Fitzgerald Defumado com Bitter Aromático",
        categoria: "Gin",
        descricao: "Gin London Dry premium, xarope simples aromatizado, suco de limão siciliano espremido e gotas selecionadas de bitter aromático envelhecido.",
        custoUnitario: 6,
        modalityConfig,
      },
      {
        id: "l5",
        nome: "Moscow Mule Clássico com Espuma Densa Artesanal",
        categoria: "Vodka",
        descricao: "Vodka filtrada dez vezes, suco fresco de limão tahiti, calda de gengibre fresco prensado e finalizado com nossa famosa espuma densa de gengibre.",
        custoUnitario: 5.5,
        modalityConfig,
      },
      {
        id: "l6",
        nome: "Cosmopolitan Contemporâneo com Twist de Laranja",
        categoria: "Vodka",
        descricao: "Vodka cítrica importada, licor de laranja Cointreau, suco concentrado de cranberry e suco fresco de limão com óleos essenciais da casca.",
        custoUnitario: 6.5,
        modalityConfig,
      },
      {
        id: "l7",
        nome: "Penicillin Escocês com Gengibre Caramelizado",
        categoria: "Whisky",
        descricao: "Whisky escocês blended, mel silvestre orgânico, extrato puro de gengibre picante, suco de limão siciliano e float de whisky defumado de Islay.",
        custoUnitario: 8,
        modalityConfig,
      },
    ];

    const menu = buildEventMenuModel({
      selectedDrinks: ["l1", "l2", "l3", "l4", "l5", "l6", "l7"],
      catalog: longDrinksCatalog,
      eventType: "Casamento",
      groomName: "Christian",
      brideName: "Isidora",
    });

    // Drinks com múltiplas linhas ocupam mais altura e disparam paginação segura
    expect(menu.pages.length).toBeGreaterThanOrEqual(2);

    for (const page of menu.computedLayout.pages) {
      const pageBottomLimit = page.isLastPage ? MENU_PERSONALIZATION_TOP : MENU_FOOTER_TOP;
      let y = page.drinksTop + page.topPadding;
      for (const drink of page.drinks) {
        y += drink.blockHeight;
        expect(y).toBeLessThanOrEqual(pageBottomLimit + 5);
        y += page.gap;
      }
    }
  });
});
