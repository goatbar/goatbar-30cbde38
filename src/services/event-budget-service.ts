import { supabase } from "@/integrations/supabase/client";

export interface Event {
  id: string;
  client_name: string;
  event_name?: string;
  phone?: string;
  email?: string;
  date: string;
  event_time?: string;
  event_location?: string;
  city?: string;
  event_type: string;
  guests: number;
  drinks?: string[];
  notes?: string;
  status: string;
  lead_source?: string;
  referral_name?: string;
  is_paid_full: boolean;
  payment_due_date?: string;
  payment_percent_received?: number;
  current_budget_value?: number;
  current_profit_value?: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetVersion {
  id: string;
  event_id: string;
  version_number: number;
  is_current: boolean;
  status: string;

  // Budget Details
  selected_drinks: any;
  drinks_per_person: number;
  drinks_markup_percentage: number;
  drinks_cost_sum: number;
  average_drink_cost: number;
  drinks_base_cost: number;
  drinks_final_value: number;

  // Staff
  bartender_quantity: number;
  bartender_unit_value: number;
  keeper_quantity: number;
  keeper_unit_value: number;
  copeira_quantity: number;
  copeira_unit_value: number;
  team_total_value: number;

  // Ice
  ice_packages_quantity: number;
  ice_package_unit_value: number;
  ice_total_value: number;

  // Travel
  has_travel: boolean;
  fuel_value: number;

  // Misc
  miscellaneous_items: any;
  miscellaneous_total_value: number;

  // Profit & Final
  discount_value: number;
  discount_description?: string;
  profit_value: number;
  final_budget_value: number;
  average_value_per_person: number;

  // Payment
  payment_method?: string;
  paid_percentage: number;
  paid_value: number;
  pending_percentage: number;
  pending_value: number;
  pending_payment_date?: string;

  created_at: string;
  updated_at: string;
}

export interface BudgetHistory {
  id: string;
  event_id: string;
  budget_version_id?: string;
  action: string;
  changed_fields?: any;
  previous_data?: any;
  new_data?: any;
  previous_final_value?: number;
  new_final_value?: number;
  created_at: string;
}

export interface NegotiationHistory {
  id: string;
  event_id: string;
  status: string;
  note?: string;
  created_at: string;
}

export const eventBudgetService = {
  // --- Events ---
  async listEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });
    if (error) throw error;

    const events = (data || []) as Event[];
    if (events.length === 0) return events;

    const { data: currentBudgets, error: budgetError } = await supabase
      .from("event_budget_versions")
      .select(
        "event_id, profit_value, paid_percentage, pending_payment_date, final_budget_value, discount_value, discount_description",
      )
      .eq("is_current", true);

    if (budgetError) {
      console.warn(
        "Falha ao carregar versões atuais de orçamento. Usando dados base de events.",
        budgetError,
      );
      return events;
    }

    const budgetByEvent = new Map((currentBudgets || []).map((b: any) => [b.event_id, b]));

    return events.map((event) => {
      const budget = budgetByEvent.get(event.id);
      if (!budget) return event;

      const discount = Number(budget.discount_value || 0);
      const discountDescription = budget.discount_description;

      // Parse detailed discounts to separate drink discounts from regular discounts
      let drinkDiscount = 0;
      if (discountDescription) {
        try {
          const parsed = JSON.parse(discountDescription);
          if (Array.isArray(parsed?.descontos)) {
            drinkDiscount = parsed.descontos
              .filter((d: any) => !!d.deduzirCustoDrinks)
              .reduce((acc: number, d: any) => acc + (Number(d.valor) || 0), 0);
          }
        } catch {}
      }

      const regularDiscount = Math.max(0, discount - drinkDiscount);
      const budgetProfit = Number(budget.profit_value || 0);
      const reconciledProfit = budgetProfit - regularDiscount;

      return {
        ...event,
        current_budget_value: Number(budget.final_budget_value || event.current_budget_value || 0),
        current_profit_value: reconciledProfit,
        payment_percent_received: Number(
          budget.paid_percentage ?? event.payment_percent_received ?? 0,
        ),
        payment_due_date: budget.pending_payment_date || event.payment_due_date,
      };
    });
  },

  async getEventById(id: string) {
    const { data, error } = await supabase.from("events").select("*").eq("id", id).limit(1);
    if (error) throw error;
    return data && data.length > 0 ? (data[0] as Event) : null;
  },

  async createEvent(payload: Partial<Event>) {
    const { data, error } = await supabase.from("events").insert(payload).select().single();
    if (error) throw error;
    return data as Event;
  },

  async updateEvent(id: string, payload: Partial<Event>) {
    const { data, error } = await supabase
      .from("events")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Event;
  },

  async deleteEvent(id: string) {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) throw error;
  },

  async checkEventsSameDate(date: string) {
    const { data, error } = await supabase.from("events").select("*").eq("date", date);
    if (error) throw error;
    return data as Event[];
  },

  // --- Budgets ---
  async getCurrentBudget(eventId: string) {
    const { data, error } = await supabase
      .from("event_budget_versions")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_current", true)
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? (data[0] as BudgetVersion) : null;
  },

  async listBudgetVersions(eventId: string) {
    const { data, error } = await supabase
      .from("event_budget_versions")
      .select("*")
      .eq("event_id", eventId)
      .order("version_number", { ascending: false });
    if (error) throw error;
    return data as BudgetVersion[];
  },

  async createBudgetVersion(eventId: string, payload: any, isNewVersion: boolean = true) {
    if (!isNewVersion) {
      // Try to find current version to update
      const current = await this.getCurrentBudget(eventId);
      if (current) {
        const { data, error } = await supabase
          .from("event_budget_versions")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", current.id)
          .select()
          .single();
        if (error) throw error;
        return data as BudgetVersion;
      }
    }

    // Otherwise, create a new version
    let versionNumber = 1;
    const { data: latest } = await supabase
      .from("event_budget_versions")
      .select("version_number")
      .eq("event_id", eventId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      versionNumber = latest.version_number + 1;
    }

    // Set all others to NOT current
    await supabase
      .from("event_budget_versions")
      .update({ is_current: false })
      .eq("event_id", eventId);

    const { data, error } = await supabase
      .from("event_budget_versions")
      .insert({
        ...payload,
        event_id: eventId,
        version_number: versionNumber,
        is_current: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as BudgetVersion;
  },

  async deleteBudgetVersion(budgetId: string) {
    // Delete history first (if no cascade in DB)
    await supabase.from("event_budget_history").delete().eq("budget_version_id", budgetId);

    const { error } = await supabase.from("event_budget_versions").delete().eq("id", budgetId);
    if (error) throw error;
  },

  async updateBudgetDraft(budgetId: string, payload: any) {
    const { data, error } = await supabase
      .from("event_budget_versions")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", budgetId)
      .select()
      .single();
    if (error) throw error;
    return data as BudgetVersion;
  },

  async setCurrentVersion(eventId: string, budgetId: string) {
    await supabase
      .from("event_budget_versions")
      .update({ is_current: false })
      .eq("event_id", eventId);

    const { data, error } = await supabase
      .from("event_budget_versions")
      .update({ is_current: true })
      .eq("id", budgetId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- History ---
  async addBudgetHistory(payload: Omit<BudgetHistory, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("event_budget_history")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getBudgetHistory(eventId: string) {
    const { data, error } = await supabase
      .from("event_budget_history")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as BudgetHistory[];
  },

  // --- Negotiation ---
  async updateNegotiationStatus(eventId: string, status: string, note?: string) {
    // Update event status
    await this.updateEvent(eventId, { status });

    // Add to negotiation history
    const { data, error } = await supabase
      .from("event_negotiation_history")
      .insert({
        event_id: eventId,
        status,
        note,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getNegotiationHistory(eventId: string) {
    const { data, error } = await supabase
      .from("event_negotiation_history")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as NegotiationHistory[];
  },

  async updateNegotiationNote(noteId: string, note: string) {
    const { data, error } = await supabase
      .from("event_negotiation_history")
      .update({ note })
      .eq("id", noteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteNegotiationNote(noteId: string) {
    const { error } = await supabase.from("event_negotiation_history").delete().eq("id", noteId);
    if (error) throw error;
  },

  async createLegacyEvent(payload: {
    client_name: string;
    event_type: string;
    date: string;
    city: string;
    guests: number;
    drinks: string[];
    final_budget_value: number;
    paid_value: number;
    average_drink_cost: number;
  }) {
    const drinksBaseCost = payload.average_drink_cost * payload.guests * 4;
    const profitValue = Math.max(0, payload.final_budget_value - drinksBaseCost);
    const paidPercentage =
      payload.final_budget_value > 0
        ? Math.min(100, Math.round((payload.paid_value / payload.final_budget_value) * 100))
        : 0;

    const eventPayload = {
      client_name: payload.client_name,
      event_name: payload.client_name,
      event_type: payload.event_type,
      date: payload.date,
      city: payload.city,
      guests: payload.guests,
      drinks: payload.drinks,
      status: "finalizado",
      current_budget_value: payload.final_budget_value,
      current_profit_value: profitValue,
      payment_percent_received: paidPercentage,
      is_paid_full: payload.paid_value >= payload.final_budget_value,
    };

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert(eventPayload)
      .select()
      .single();

    if (eventError) throw eventError;

    const budgetPayload = {
      event_id: event.id,
      version_number: 1,
      is_current: true,
      status: "approved",
      selected_drinks: { ids: payload.drinks, copos: {} },
      drinks_per_person: 4,
      drinks_markup_percentage: 0,
      drinks_cost_sum: payload.average_drink_cost * payload.drinks.length,
      average_drink_cost: payload.average_drink_cost,
      drinks_base_cost: drinksBaseCost,
      drinks_final_value: drinksBaseCost,
      bartender_quantity: 0,
      bartender_unit_value: 200,
      keeper_quantity: 0,
      keeper_unit_value: 200,
      copeira_quantity: 0,
      copeira_unit_value: 200,
      team_total_value: 0,
      ice_packages_quantity: 0,
      ice_package_unit_value: 6,
      ice_total_value: 0,
      has_travel: false,
      fuel_value: 0,
      miscellaneous_items: [],
      miscellaneous_total_value: 0,
      discount_value: 0,
      profit_value: profitValue,
      final_budget_value: payload.final_budget_value,
      average_value_per_person:
        payload.guests > 0 ? payload.final_budget_value / payload.guests : 0,
      paid_percentage: paidPercentage,
      paid_value: payload.paid_value,
      pending_percentage: 100 - paidPercentage,
      pending_value: Math.max(0, payload.final_budget_value - payload.paid_value),
      updated_at: new Date().toISOString(),
    };

    const { data: budget, error: budgetError } = await supabase
      .from("event_budget_versions")
      .insert(budgetPayload)
      .select()
      .single();

    if (budgetError) throw budgetError;

    return { event, budget };
  },
};
