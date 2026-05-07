import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

// --- Tipos para os Serviços ---
export interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  file_url?: string;
  file_path?: string;
  file_type?: string;
  is_default: boolean;
  variables_schema: string[];
  status: string;
  created_at: string;
}

export interface ContractSigner {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
  role?: string;
  address?: string;
  is_active: boolean;
}

export interface Glassware {
  id: string;
  name: string;
  type?: string;
  replacement_value: number;
  is_active: boolean;
}

export interface EventContract {
  id: string;
  event_id: string;
  template_id?: string;
  signer_id?: string;
  status: string;
  version: number;
  generated_file_url?: string;
  signed_file_url?: string;
  signature_certificate_url?: string;
  generated_at?: string;
  sent_for_signature_at?: string;
  fully_signed_at?: string;
}

// --- 1. Templates Service ---
export const contractTemplatesService = {
  async listTemplates() {
    const { data, error } = await supabase
      .from("contract_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as ContractTemplate[];
  },

  async createTemplate(payload: Omit<ContractTemplate, "id" | "created_at">) {
    const { data, error } = await supabase
      .from("contract_templates")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTemplate(id: string, payload: Partial<ContractTemplate>) {
    const { data, error } = await supabase
      .from("contract_templates")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteTemplate(id: string) {
    const { error } = await supabase.from("contract_templates").delete().eq("id", id);
    if (error) throw error;
  },

  async setDefaultTemplate(id: string) {
    // Primeiro remove o default de todos
    await supabase.from("contract_templates").update({ is_default: false }).neq("id", id);
    // Define o novo default
    return this.updateTemplate(id, { is_default: true });
  },

  async uploadTemplateFile(file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `templates/${fileName}`;

    const { data, error } = await supabase.storage
      .from("contract-templates")
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from("contract-templates")
      .getPublicUrl(filePath);

    return { publicUrl, filePath };
  }
};

// --- 2. Signers Service ---
export const contractSignersService = {
  async listSigners() {
    const { data, error } = await supabase
      .from("contract_signers")
      .select("*")
      .order("name");
    if (error) throw error;
    return data as ContractSigner[];
  },

  async createSigner(payload: Omit<ContractSigner, "id" | "is_active">) {
    const { data, error } = await supabase
      .from("contract_signers")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSigner(id: string, payload: Partial<ContractSigner>) {
    const { data, error } = await supabase
      .from("contract_signers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// --- 3. Glassware Service ---
export const glasswareService = {
  async listGlassware() {
    const { data, error } = await supabase
      .from("glassware")
      .select("*")
      .order("name");
    if (error) throw error;
    return data as Glassware[];
  },

  async createGlassware(payload: Omit<Glassware, "id" | "is_active">) {
    const { data, error } = await supabase
      .from("glassware")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateGlassware(id: string, payload: Partial<Glassware>) {
    const { data, error } = await supabase
      .from("glassware")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// --- 4. Event Contracts Service ---
export const eventContractsService = {
  async getContractByEventId(eventId: string) {
    const { data, error } = await supabase
      .from("event_contracts")
      .select(`
        *,
        contract_templates (name),
        contract_signers (name)
      `)
      .eq("event_id", eventId)
      .limit(1);
    if (error) throw error;
    return (data && data.length > 0) ? data[0] : null;
  },

  async createContractForEvent(eventId: string, templateId: string, signerId: string) {
    const { data, error } = await supabase
      .from("event_contracts")
      .insert({
        event_id: eventId,
        template_id: templateId,
        signer_id: signerId,
        status: "draft",
        version: 1
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateContractStatus(contractId: string, status: string) {
    const { data, error } = await supabase
      .from("event_contracts")
      .update({ 
        status, 
        updated_at: new Date().toISOString(),
        fully_signed_at: status === "signed" ? new Date().toISOString() : null
      })
      .eq("id", contractId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async compileContractVariables(eventId: string) {
    // 1. Busca dados do evento no LocalStorage (via AppStore)
    const store = JSON.parse(localStorage.getItem("goatbar-storage-v7") || "{}");
    const evento = store.state?.eventos?.find((e: any) => e.id === eventId);
    
    if (!evento) throw new Error("Evento não encontrado");

    // 2. Busca dados do cliente no Supabase
    const { data: clientData } = await supabase
      .from("event_contract_client_data")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    // 3. Busca lista de copos para a tabela de reposição
    const { data: glasses } = await supabase
      .from("glassware")
      .select("*")
      .eq("is_active", true);

    // 4. Monta o dicionário de variáveis
    const variables = {
      cliente_nome: clientData?.client_name || evento.nome,
      cliente_documento: clientData?.cpf_cnpj || "",
      cliente_endereco: clientData?.address || "",
      cliente_email: clientData?.email || "",
      evento_nome: evento.nome,
      evento_data: new Date(evento.data).toLocaleDateString("pt-BR"),
      evento_local: evento.local || "A definir",
      evento_convidados: evento.convidados,
      evento_valor_total: evento.orcamento?.valorTotal || 0,
      drinks_lista: (evento.drinks || []).join(", "),
      tabela_reposicao: (evento.drinks || []).map((dId: string) => {
        const glassId = evento.coposVinculados?.[dId];
        const glass = glasses?.find(g => g.id === glassId);
        return `${dId}: ${glass?.name || "Copo Padrão"} (R$ ${glass?.replacement_value || 15})`;
      }).join("\n"),
      data_emissao: new Date().toLocaleDateString("pt-BR")
    };

    return variables;
  }
};

// --- 5. Public Form Service ---
export const clientContractFormService = {
  async createPublicFormToken(eventId: string) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

    const { data, error } = await supabase
      .from("event_contract_client_data")
      .upsert({
        event_id: eventId,
        public_token: token,
        token_expires_at: expiresAt.toISOString(),
      }, { onConflict: 'event_id' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getFormByToken(token: string) {
    const { data, error } = await supabase
      .from("event_contract_client_data")
      .select("*")
      .eq("public_token", token)
      .single();
    if (error) throw error;
    return data;
  },

  async submitClientData(token: string, payload: any) {
    // 1. Get the event_id first
    const { data: form, error: fetchError } = await supabase
      .from("event_contract_client_data")
      .select("event_id")
      .eq("public_token", token)
      .single();
    
    if (fetchError) throw fetchError;

    // 2. Update the client data record
    const { data, error: updateError } = await supabase
      .from("event_contract_client_data")
      .update({
        ...payload,
        submitted_at: new Date().toISOString()
      })
      .eq("public_token", token)
      .select()
      .single();
    
    if (updateError) throw updateError;

    // 3. Sync critical info back to the main events table
    if (form?.event_id) {
        await supabase
          .from("events")
          .update({
            client_name: payload.client_name,
            phone: payload.phone,
            email: payload.email
          })
          .eq("id", form.event_id);
    }

    return data;
  }
};
