import { type Drink } from "@/lib/mock-data";
import { type SelectedDrinksPayload } from "@/lib/drinks-canonical";

export interface EventMenuDrink {
  id: string;
  name: string;
  description: string;
  category?: string;
}

export type EventMenuLayout = "compact" | "standard" | "expanded";
export type EventMenuArtworkMode = "automatic" | "library" | "ai" | "upload";

export type EventMenuPersonalization =
  | { kind: "wedding"; initials: string; label: string; date?: string }
  | { kind: "birthday"; label: string }
  | { kind: "corporate"; label: string }
  | { kind: "bachelor"; label: string }
  | { kind: "generic"; label: string };

export const MENU_PAGE_WIDTH = 567; // pt (official Canva size)
export const MENU_PAGE_HEIGHT = 850.5; // pt (official Canva size)
export const MENU_DRINKS_TOP = 135; // pt (below "Menu" header)
export const MENU_CONTENT_MAX_WIDTH = 440; // pt (safe inner arch width)
export const MENU_FOOTER_TOP = 780; // pt (GOATBAR + Instagram/QR)
export const MENU_PERSONALIZATION_TOP = 675; // pt (reserved zone for personalization)
export const MENU_PERSONALIZATION_HEIGHT = 100; // pt (y = 675 to 775 pt)

export const MENU_SAFE_HEIGHT_LAST_PAGE = MENU_PERSONALIZATION_TOP - MENU_DRINKS_TOP; // 540 pt
export const MENU_SAFE_HEIGHT_OTHER_PAGES = MENU_FOOTER_TOP - MENU_DRINKS_TOP - 20; // 625 pt

export const MENU_TYPOGRAPHY = {
  drinkName: {
    fontFamily: '"Neue Montreal Regular", "Neue Montreal", Helvetica, Arial, sans-serif',
    fontSize: 20, // pt (exact Canva standard)
    lineHeight: 24, // pt
    fontWeight: 400,
    color: "#701117", // official wine color
  },
  drinkDescription: {
    fontFamily: '"Neue Montreal Regular", "Neue Montreal", Helvetica, Arial, sans-serif',
    fontSize: 16, // pt (exact Canva standard)
    lineHeight: 20, // pt
    fontWeight: 400,
    color: "#0f1414", // official dark tone
  },
  titleDescGap: 4, // pt
  minGap: 8, // pt (minimum gap between drinks)
  maxGap: 34, // pt (maximum gap for few drinks to keep balanced spacing)
} as const;

export interface EventMenuDrinkLayout extends EventMenuDrink {
  nameLines: string[];
  descriptionLines: string[];
  blockHeight: number;
}

export interface EventMenuPageLayout {
  pageIndex: number;
  totalPages: number;
  isLastPage: boolean;
  drinks: EventMenuDrinkLayout[];
  drinksTop: number;
  drinksHeight: number;
  availableHeight: number;
  gap: number;
  topPadding: number;
  personalization: EventMenuPersonalization | null;
  artworkUrl?: string | null;
}

export interface EventMenuComputedLayout {
  pageWidth: number;
  pageHeight: number;
  drinksAreaWidth: number;
  pages: EventMenuPageLayout[];
}

export interface EventMenuModel {
  title: string;
  subtitle?: string;
  drinks: EventMenuDrink[];
  layout: EventMenuLayout;
  columns: 1;
  pages: EventMenuDrink[][];
  computedLayout: EventMenuComputedLayout;
  personalization: EventMenuPersonalization;
  artworkMode: EventMenuArtworkMode;
  artworkUrl?: string | null;
  warnings: string[];
}

export interface EventMenuContext {
  selectedDrinks: SelectedDrinksPayload | string[] | null | undefined;
  catalog: Drink[];
  eventName?: string | null;
  eventType?: string | null;
  clientName?: string | null;
  brideName?: string | null;
  groomName?: string | null;
  date?: string | null;
  artworkMode?: EventMenuArtworkMode;
  artworkUrl?: string | null;
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

interface SelectedEntry {
  id?: string;
  name?: string;
  description?: string;
}

function selectedEntries(selected: SelectedDrinksPayload | string[] | null | undefined): SelectedEntry[] {
  if (!selected) return [];
  if (Array.isArray(selected)) {
    return selected.flatMap((value: any) => {
      if (typeof value === "string") return [{ id: value, name: value }];
      if (value && typeof value === "object") {
        const id = value.id || value.drink_id;
        const name = value.name || value.nome;
        const description = value.description || value.descricao;
        return id || name ? [{ id, name, description }] : [];
      }
      return [];
    });
  }
  if (selected.items?.length) {
    return selected.items.map((item: any) => ({
      id: item.drink_id || item.id,
      name: item.name || item.nome,
      description: item.description || item.descricao,
    }));
  }
  return (selected.ids || []).map((id) => ({ id }));
}

export function resolveEventMenuDrinks(
  selected: SelectedDrinksPayload | string[] | null | undefined,
  catalog: Drink[],
): EventMenuDrink[] {
  const seen = new Set<string>();

  return selectedEntries(selected).flatMap((entry) => {
    const byId = entry.id ? catalog.find((drink) => drink.id === entry.id) : undefined;
    const byName = entry.name
      ? catalog.find((drink) => normalize(drink.nome) === normalize(entry.name!))
      : undefined;
    const drink = byId || byName;
    const name = drink?.nome || entry.name || entry.id || "";
    if (!name) return [];

    const key = drink?.id || normalize(name);
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      id: drink?.id || entry.id || key,
      name,
      description: drink?.descricao?.trim() || entry.description?.trim() || "",
      category: drink?.categoria,
    }];
  });
}

/**
 * Quebra de linha inteligente por palavras para calcular altura real do texto.
 */
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxCharsPerLine) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Calcula as quebras de linha e a altura real do bloco de um drink (título + descrição)
 * utilizando as fontes canônicas Neue Montreal 20pt / 16pt.
 */
export function computeDrinkLayout(drink: EventMenuDrink): EventMenuDrinkLayout {
  // Na largura de 440pt (área segura do arco):
  // Neue Montreal 20pt acomoda até 43 caracteres por linha.
  // Neue Montreal 16pt acomoda até 58 caracteres por linha.
  const nameLines = wrapText(drink.name, 43);
  const descriptionLines = drink.description ? wrapText(drink.description, 58) : [];

  const nameHeight = Math.max(1, nameLines.length) * MENU_TYPOGRAPHY.drinkName.lineHeight;
  const descHeight = descriptionLines.length * MENU_TYPOGRAPHY.drinkDescription.lineHeight;
  const gap = descriptionLines.length > 0 ? MENU_TYPOGRAPHY.titleDescGap : 0;
  const blockHeight = nameHeight + gap + descHeight;

  return {
    ...drink,
    nameLines: nameLines.length ? nameLines : [drink.name],
    descriptionLines,
    blockHeight,
  };
}

/**
 * Calcula a altura total ocupada por uma lista de drinks com um espaçamento mínimo dado.
 */
export function calculateDrinksHeight(drinks: EventMenuDrinkLayout[], gap = MENU_TYPOGRAPHY.minGap): number {
  if (drinks.length === 0) return 0;
  const totalBlocks = drinks.reduce((sum, d) => sum + d.blockHeight, 0);
  return totalBlocks + (drinks.length - 1) * gap;
}

/**
 * Distribui verticalmente os drinks de forma equilibrada dentro da área útil,
 * evitando buracos no fundo e mantendo espaçamentos elegantes e harmônicos.
 */
export function balanceDrinksVerticalDistribution(
  drinks: EventMenuDrinkLayout[],
  availableHeight: number,
): { gap: number; topPadding: number; groupHeight: number } {
  const k = drinks.length;
  if (k === 0) return { gap: 0, topPadding: 0, groupHeight: 0 };

  const totalBlocks = drinks.reduce((sum, d) => sum + d.blockHeight, 0);
  const slack = Math.max(0, availableHeight - totalBlocks);

  if (k === 1) {
    return {
      gap: 0,
      topPadding: slack / 2,
      groupHeight: totalBlocks,
    };
  }

  // Mantém a lista como um bloco visual centralizado na folha.
  // Em vez de "esticar" os drinks por toda a área útil, reduzimos progressivamente
  // o espaçamento conforme a quantidade aumenta e usamos o espaço restante como
  // padding superior/inferior simétrico. Isso reproduz melhor a composição do Canva.
  const countAwareMaxGap =
    k <= 3 ? MENU_TYPOGRAPHY.maxGap :
    k <= 5 ? 26 :
    k <= 7 ? 18 :
    k <= 9 ? 14 :
    12;

  const naturalGap = slack / Math.max(1, k - 1);
  const gap = Math.min(
    countAwareMaxGap,
    Math.max(MENU_TYPOGRAPHY.minGap, naturalGap),
  );
  const groupHeight = totalBlocks + (k - 1) * gap;
  const topPadding = Math.max(0, (availableHeight - groupHeight) / 2);
  return { gap, topPadding, groupHeight };
}

/**
 * Pagina a lista de drinks baseando-se na altura real das linhas.
 * A personalização fica sempre reservada para a última página.
 */
export function paginateDrinks(drinks: EventMenuDrinkLayout[]): EventMenuDrinkLayout[][] {
  if (drinks.length === 0) return [[]];

  // 1. Caso caiba tudo em 1 página com a personalização:
  const heightAllOnLast = calculateDrinksHeight(drinks, MENU_TYPOGRAPHY.minGap);
  if (heightAllOnLast <= MENU_SAFE_HEIGHT_LAST_PAGE) {
    return [drinks];
  }

  // 2. Se não couber em 1 página, tentamos distribuir de forma visualmente equilibrada
  // entre o menor número de páginas possível (evitando 9 itens na pág 1 e 1 isolado na pág 2).
  for (let targetPages = 2; targetPages <= 6; targetPages++) {
    const targetPerChunk = Math.ceil(drinks.length / targetPages);
    const candidatePages: EventMenuDrinkLayout[][] = [];
    let possible = true;

    for (let p = 0; p < targetPages; p++) {
      const isLast = p === targetPages - 1;
      const maxCap = isLast ? MENU_SAFE_HEIGHT_LAST_PAGE : MENU_SAFE_HEIGHT_OTHER_PAGES;
      const start = p * targetPerChunk;
      const chunk = drinks.slice(start, start + targetPerChunk);
      if (chunk.length === 0) {
        possible = false;
        break;
      }
      const h = calculateDrinksHeight(chunk, MENU_TYPOGRAPHY.minGap);
      if (h > maxCap) {
        possible = false;
        break;
      }
      candidatePages.push(chunk);
    }

    if (possible && candidatePages.reduce((s, c) => s + c.length, 0) === drinks.length) {
      return candidatePages;
    }
  }

  // 3. Fallback ganancioso preservando sempre itens para a última página
  const pages: EventMenuDrinkLayout[][] = [];
  let remaining = [...drinks];

  while (remaining.length > 0) {
    const isProjectedLastPage =
      calculateDrinksHeight(remaining, MENU_TYPOGRAPHY.minGap) <= MENU_SAFE_HEIGHT_LAST_PAGE;
    if (isProjectedLastPage) {
      pages.push(remaining);
      break;
    }

    let currentChunk: EventMenuDrinkLayout[] = [];
    let currentHeight = 0;
    const maxCapacity = MENU_SAFE_HEIGHT_OTHER_PAGES;

    for (let i = 0; i < remaining.length; i++) {
      if (i === remaining.length - 1 && currentChunk.length > 0) {
        // Deixa pelo menos 1 drink para a página seguinte
        break;
      }

      const drink = remaining[i];
      const additionalGap = currentChunk.length > 0 ? MENU_TYPOGRAPHY.minGap : 0;
      const nextHeight = currentHeight + additionalGap + drink.blockHeight;

      if (currentChunk.length > 0 && nextHeight > maxCapacity) {
        break;
      }

      currentChunk.push(drink);
      currentHeight = nextHeight;
    }

    if (currentChunk.length === 0 && remaining.length > 0) {
      currentChunk.push(remaining[0]);
    }

    pages.push(currentChunk);
    remaining = remaining.slice(currentChunk.length);
  }

  return pages;
}

/**
 * Motor de layout unificado: calcula medidas, gaps, offsets e páginas compartilhados
 * por Preview e PDF com 100% de equivalência visual.
 */
export function calculateMenuLayout(
  rawDrinks: EventMenuDrink[],
  personalization: EventMenuPersonalization,
  artworkUrl?: string | null,
): EventMenuComputedLayout {
  const layouts = rawDrinks.map(computeDrinkLayout);
  const drinkPages = paginateDrinks(layouts);
  const totalPages = drinkPages.length;

  const pages: EventMenuPageLayout[] = drinkPages.map((pageDrinks, index) => {
    const isLastPage = index === totalPages - 1;
    const availableHeight = isLastPage ? MENU_SAFE_HEIGHT_LAST_PAGE : MENU_SAFE_HEIGHT_OTHER_PAGES;
    const distribution = balanceDrinksVerticalDistribution(pageDrinks, availableHeight);

    return {
      pageIndex: index,
      totalPages,
      isLastPage,
      drinks: pageDrinks,
      drinksTop: MENU_DRINKS_TOP,
      drinksHeight: availableHeight,
      availableHeight,
      gap: distribution.gap,
      topPadding: distribution.topPadding,
      personalization: isLastPage ? personalization : null,
      artworkUrl: isLastPage ? artworkUrl : null,
    };
  });

  return {
    pageWidth: MENU_PAGE_WIDTH,
    pageHeight: MENU_PAGE_HEIGHT,
    drinksAreaWidth: MENU_CONTENT_MAX_WIDTH,
    pages,
  };
}

export function getEventMenuLayout(
  drinkCount: number,
  estimatedWeight = drinkCount * 1.9,
): Pick<EventMenuModel, "layout" | "columns"> {
  if (drinkCount <= 5 && estimatedWeight <= 10) return { layout: "expanded", columns: 1 };
  if (drinkCount <= 8 && estimatedWeight <= 15) return { layout: "standard", columns: 1 };
  return { layout: "compact", columns: 1 };
}

export function paginateEventMenuDrinks(drinks: EventMenuDrink[], maxWeight = 18.5): EventMenuDrink[][] {
  const layouts = drinks.map(computeDrinkLayout);
  const pages = paginateDrinks(layouts);
  return pages.map((page) =>
    page.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      category: d.category,
    })),
  );
}

function initialsFromNames(names: string[]): string {
  return names
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => {
      const clean = name.trim();
      return clean ? clean.charAt(0).toUpperCase() : "";
    })
    .join("");
}

function formatMenuDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/**
 * Resolve a personalização garantindo a preservação da ordem dos nomes
 * conforme o cadastro do evento (ex: noivo/noiva ou nome do casal).
 */
export function resolveEventMenuPersonalization(input: {
  eventType?: string | null;
  eventName?: string | null;
  clientName?: string | null;
  brideName?: string | null;
  groomName?: string | null;
  date?: string | null;
}): EventMenuPersonalization {
  const type = normalize(input.eventType || "");
  const eventName = input.eventName?.trim() || input.clientName?.trim() || "";

  if (type.includes("casamento")) {
    const rawNamesFromEvent = eventName
      .replace(/^casamento(?:\s+de)?\s+/i, "")
      .split(/\s*(?:&| e |\+|\/)\s*/i)
      .map((s) => s.trim())
      .filter(Boolean);

    let resolvedNames: string[] = [];
    if (rawNamesFromEvent.length >= 2) {
      resolvedNames = rawNamesFromEvent.slice(0, 2);
    } else {
      // Prioriza a ordem que apareceu no cadastro
      const explicit = [input.groomName?.trim(), input.brideName?.trim()].filter(Boolean) as string[];
      resolvedNames = explicit.length >= 2 ? explicit : [eventName];
    }

    const label = resolvedNames.length >= 2 ? resolvedNames.join(" & ") : eventName;
    const initials = initialsFromNames(resolvedNames) || "GB";

    return {
      kind: "wedding",
      initials,
      label,
      date: formatMenuDate(input.date),
    };
  }

  if (type.includes("anivers")) return { kind: "birthday", label: "Happy Birthday" };
  if (type.includes("corporat") || type.includes("confratern")) {
    return { kind: "corporate", label: eventName || "Cheers!" };
  }
  if (type.includes("despedida") || type.includes("solteir")) {
    return { kind: "bachelor", label: "Game Over" };
  }
  return { kind: "generic", label: eventName };
}

export function validateEventMenuModel(menu: Pick<EventMenuModel, "drinks" | "pages">) {
  const warnings: string[] = [];
  if (menu.drinks.length === 0) warnings.push("Nenhum drink selecionado no orçamento atual.");

  const missingDescriptions = menu.drinks.filter((drink) => !drink.description.trim());
  if (missingDescriptions.length) {
    warnings.push(
      `${missingDescriptions.length} drink(s) sem descrição cadastrada no módulo de Drinks.`,
    );
  }

  if (menu.pages.length > 1) {
    warnings.push(`O cardápio será gerado em ${menu.pages.length} páginas para evitar sobreposição.`);
  }
  return warnings;
}

export function buildEventMenuModel(input: EventMenuContext): EventMenuModel {
  const drinks = resolveEventMenuDrinks(input.selectedDrinks, input.catalog);
  const personalization = resolveEventMenuPersonalization(input);
  const computedLayout = calculateMenuLayout(drinks, personalization, input.artworkUrl);
  const pages = computedLayout.pages.map((p) =>
    p.drinks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      category: d.category,
    })),
  );

  const drinkCount = drinks.length;
  const layout: EventMenuLayout =
    drinkCount <= 5 && pages.length === 1 ? "expanded" : drinkCount <= 8 && pages.length === 1 ? "standard" : "compact";

  const base = {
    title: "Menu",
    subtitle: input.eventName?.trim() || undefined,
    drinks,
    layout,
    columns: 1,
    pages,
    computedLayout,
    personalization,
    artworkMode: input.artworkMode || "automatic",
    artworkUrl: input.artworkUrl || null,
  } satisfies Omit<EventMenuModel, "warnings">;

  return {
    ...base,
    warnings: validateEventMenuModel(base),
  };
}
