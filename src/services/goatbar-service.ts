import { drinks as seedDrinks } from "@/lib/mock-data";

type Drink = { id: string; name: string; cost: number; price: number; image: string };
type Sale = { id: string; total_revenue: number; total_cost: number; date: string };
type Event = {
  id: string;
  client_name: string;
  event_type: string;
  total_price: number;
  total_cost: number;
  date: string;
  guests?: number;
  duration?: number;
  total_profit?: number;
};

type Inventory = { id: string; name: string; quantity: number; unit?: string; updated_at?: string };
type Movement = { id: string; inventory_id: string; type: "in" | "out" | "loss"; quantity: number; source: "event" | "sale" | "manual"; created_at: string };

const STORAGE_KEY = "goatbar_mock_db_v1";

const initialDrinks: Drink[] = seedDrinks.map((d) => ({
  id: d.id,
  name: d.nome,
  cost: d.custoUnitario,
  price: d.precoVenda,
  image: d.imagem?.startsWith("/") ? d.imagem : `/${d.imagem ?? "drinks/old-fashioned.jpg"}`,
}));

const seed = {
  drinks: initialDrinks,
  sales: [
    { id: "s1", total_revenue: 4200, total_cost: 1680, date: new Date().toISOString() },
    { id: "s2", total_revenue: 3500, total_cost: 1400, date: new Date().toISOString() },
  ] satisfies Sale[],
  events: [{ id: "e1", client_name: "Cliente Seed", event_type: "Corporativo", total_price: 6200, total_cost: 2800, date: new Date().toISOString() }] satisfies Event[],
  inventory: [] as Inventory[],
  movements: [] as Movement[],
};

function needsMigration(db: any) {
  return !Array.isArray(db?.drinks) || db.drinks.length < initialDrinks.length;
}

function readDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
  const parsed = JSON.parse(raw);
  if (needsMigration(parsed)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
  parsed.drinks = parsed.drinks.map((d: Drink) => ({
    ...d,
    image: d.image?.startsWith("/") ? d.image : `/${d.image}`,
  }));
  return parsed;
}

function writeDb(db: any) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export const goatbarService = {
  listDrinks: async () => readDb().drinks as Drink[],
  createDrink: async (payload: { name: string; cost: number; price: number; image?: string }) => {
    const db = readDb();
    db.drinks.unshift({
      id: crypto.randomUUID(),
      name: payload.name,
      cost: payload.cost,
      price: payload.price,
      image: payload.image ?? "/drinks/old-fashioned.jpg",
    });
    writeDb(db);
  },
  listSales: async () => readDb().sales as Sale[],
  createSale: async (payload: {
    location: "7steakhouse" | "goatbotequim";
    items: { drink_id: string; quantity: number; price: number; cost: number }[];
  }) => {
    const totals = payload.items.reduce(
      (acc, i) => ({ revenue: acc.revenue + i.price * i.quantity, cost: acc.cost + i.cost * i.quantity }),
      { revenue: 0, cost: 0 },
    );
    const db = readDb();
    db.sales.unshift({ id: crypto.randomUUID(), total_revenue: totals.revenue, total_cost: totals.cost, date: new Date().toISOString() });
    writeDb(db);
  },
  listEvents: async () => readDb().events as Event[],
  createEvent: async (payload: any) => {
    const db = readDb();
    db.events.unshift({ id: crypto.randomUUID(), ...payload });
    writeDb(db);
  },
  listInventory: async () => readDb().inventory as Inventory[],
  createInventory: async (payload: any) => {
    const db = readDb();
    db.inventory.unshift({ id: crypto.randomUUID(), ...payload, updated_at: new Date().toISOString() });
    writeDb(db);
  },
  updateInventoryQuantity: async (id: string, quantity: number, source: "event" | "sale" | "manual", type: "in" | "out" | "loss") => {
    const db = readDb();
    const row = db.inventory.find((i: Inventory) => i.id === id);
    if (!row) return;
    row.quantity = type === "in" ? row.quantity + quantity : Math.max(0, row.quantity - quantity);
    row.updated_at = new Date().toISOString();
    db.movements.unshift({ id: crypto.randomUUID(), inventory_id: id, type, quantity, source, created_at: new Date().toISOString() });
    writeDb(db);
  },
  listInventoryMovements: async () => readDb().movements as Movement[],
};
