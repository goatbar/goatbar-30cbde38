import { supabase } from "@/integrations/supabase/client";
import { eventBudgetService } from "@/services/event-budget-service";

const STORAGE_KEY = "goatbar-functional-store-v11";

export async function migrateLocalStorageToSupabase() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { success: false, message: "Nenhum dado local encontrado para migração." };

  try {
    const store = JSON.parse(raw);
    const eventos = store.eventos || [];
    
    if (eventos.length === 0) {
      return { success: false, message: "Nenhum evento encontrado no armazenamento local." };
    }

    let migratedCount = 0;

    for (const ev of eventos) {
      // 1. Criar o evento no Supabase
      const eventPayload = {
        client_name: ev.client_name || ev.nome,
        phone: ev.phone || ev.telefone,
        email: ev.email,
        date: ev.date || ev.data,
        event_time: ev.event_time,
        event_location: ev.event_location || ev.local,
        city: ev.city || ev.cidade,
        event_type: ev.event_type || ev.tipo,
        guests: ev.guests || ev.convidados,
        notes: ev.notes || ev.observacoes,
        status: (ev.status || "NOVO").toUpperCase(),
        lead_source: ev.lead_source,
        referral_name: ev.referral_name,
        current_budget_value: ev.current_budget_value || 0,
        current_profit_value: ev.current_profit_value || 0
      };

      const { data: newEvent, error: evError } = await supabase
        .from("events")
        .insert(eventPayload)
        .select()
        .single();

      if (evError) {
        console.error("Erro ao migrar evento:", ev.nome, evError);
        continue;
      }

      // 2. Tentar migrar o orçamento se existir (snapshotted in mock)
      // No mock, o orçamento costuma estar dentro do evento ou em outra tabela
      // Se houver lógica de orçamentos complexa, precisaríamos de mais mapeamento.
      
      migratedCount++;
    }

    // Opcional: Limpar localStorage após migração bem-sucedida? 
    // Melhor deixar para o usuário decidir ou marcar como migrado.

    return { 
      success: true, 
      message: `${migratedCount} eventos migrados com sucesso para o banco de dados real.` 
    };
  } catch (e) {
    console.error("Erro na migração:", e);
    return { success: false, message: "Erro crítico durante a migração dos dados." };
  }
}

export function hasLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const store = JSON.parse(raw);
    return (store.eventos && store.eventos.length > 0);
  } catch {
    return false;
  }
}
