import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const goatbarService = {
  listDrinks: async () => (await db.from("drinks").select("*").order("created_at", { ascending: false })).data ?? [],
  createDrink: async (payload: { name: string; cost: number; price: number }) => {
    const { error } = await db.from("drinks").insert(payload);
    if (error) throw error;
  },
  listSales: async () => (await db.from("sales").select("*, sales_items(*, drinks(name))").order("date", { ascending: false })).data ?? [],
  createSale: async (payload: {
    location: "7steakhouse" | "goatbotequim";
    items: { drink_id: string; quantity: number; price: number; cost: number }[];
  }) => {
    const totals = payload.items.reduce((acc, i) => ({
      revenue: acc.revenue + i.price * i.quantity,
      cost: acc.cost + i.cost * i.quantity,
    }), { revenue: 0, cost: 0 });
    const { data: sale, error } = await db.from("sales").insert({
      location: payload.location,
      total_revenue: totals.revenue,
      total_cost: totals.cost,
      total_profit: totals.revenue - totals.cost,
    }).select("id").single();
    if (error) throw error;
    const items = payload.items.map((i) => ({ ...i, sale_id: sale.id }));
    const { error: itemError } = await db.from("sales_items").insert(items);
    if (itemError) throw itemError;
  },
  listEvents: async () => (await db.from("events").select("*").order("date", { ascending: false })).data ?? [],
  createEvent: async (payload: any) => {
    const { error } = await db.from("events").insert(payload);
    if (error) throw error;
  },
  listInventory: async () => (await db.from("inventory").select("*").order("updated_at", { ascending: false })).data ?? [],
  createInventory: async (payload: any) => {
    const { error } = await db.from("inventory").insert(payload);
    if (error) throw error;
  },
  updateInventoryQuantity: async (id: string, quantity: number, source: "event" | "sale" | "manual", type: "in" | "out" | "loss") => {
    const { data: row, error } = await db.from("inventory").select("quantity").eq("id", id).single();
    if (error) throw error;
    const nextQty = type === "in" ? row.quantity + quantity : Math.max(0, row.quantity - quantity);
    const { error: updateError } = await db.from("inventory").update({ quantity: nextQty }).eq("id", id);
    if (updateError) throw updateError;
    const { error: moveError } = await db.from("inventory_movements").insert({ inventory_id: id, type, quantity, source });
    if (moveError) throw moveError;
  },
  listInventoryMovements: async () => (await db.from("inventory_movements").select("*, inventory(name)").order("created_at", { ascending: false })).data ?? [],
};
