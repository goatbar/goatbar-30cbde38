import { supabase } from "@/integrations/supabase/client";

export interface Event {
  id: string;
  client_name: string;
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
    return data as Event[];
  },

  async getEventById(id: string) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Event;
  },

  async createEvent(payload: Partial<Event>) {
    const { data, error } = await supabase
      .from("events")
      .insert(payload)
      .select()
      .single();
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
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("date", date);
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
      .maybeSingle();
    if (error) throw error;
    return data as BudgetVersion;
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
    // If isNewVersion is false, it might just be updating a draft of the current version
    // But user wants versioning, so typically we create a new one.
    
    let versionNumber = 1;
    if (isNewVersion) {
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
    }

    const { data, error } = await supabase
      .from("event_budget_versions")
      .insert({
        ...payload,
        event_id: eventId,
        version_number: versionNumber,
        is_current: true,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as BudgetVersion;
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
        note
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
  }
};
