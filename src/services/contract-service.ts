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
    const fileExt = file.name.split(".").pop() || "docx";
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `templates/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from("contract-templates")
        .upload(filePath, file, { upsert: true });

      if (error) {
        console.warn("Upload no Supabase Storage falhou, usando Data URL fallback:", error.message);
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        return { publicUrl: dataUrl, filePath: `local/${fileName}` };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("contract-templates").getPublicUrl(filePath);

      return { publicUrl, filePath };
    } catch (e: any) {
      console.warn("Erro ao fazer upload do arquivo, usando Data URL fallback:", e);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      return { publicUrl: dataUrl, filePath: `local/${file.name}` };
    }
  },
};

// --- Helper de Renderização de Template com Variáveis ---
export function renderContractTemplate(templateBody: string, variables: Record<string, any>): string {
  let result = templateBody;
  Object.keys(variables).forEach((key) => {
    const val = variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : "";
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    result = result.replace(regex, val);
  });
  return result;
}

export const DEFAULT_CONTRACT_BODY = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BAR E COQUETELARIA

Pelo presente instrumento particular de prestação de serviços:

CONTRATANTE: {{cliente_nome}}, CPF/CNPJ: {{cliente_documento}}, Endereço: {{cliente_endereco}}, E-mail: {{cliente_email}}, Telefone: {{cliente_telefone}}.

CONTRATADA: GOAT BAR EVENTOS LTDA, representada por {{socio_nome}}, CPF: {{socio_cpf}}, Cargo: {{socio_cargo}}.

1. CLÁUSULA PRIMEIRA - DO OBJETO
O presente contrato tem como objeto a prestação de serviços de bar e coquetelaria para o evento "{{evento_nome}}" ({{evento_tipo}}), a realizar-se no dia {{evento_data}} às {{evento_horario}}, no local {{evento_local}} - {{evento_cidade}}, para o público estimado de {{evento_convidados}} convidados.

2. CLÁUSULA SEGUNDA - DO CARDÁPIO DE BEBIDAS
Os drinks e bebidas inclusos no evento são:
{{drinks_lista}}

Descrição do Cardápio:
{{bebidas_descricao}}

3. CLÁUSULA TERCEIRA - DO VALOR E FORMA DE PAGAMENTO
Pela prestação dos serviços acordados, o CONTRATANTE pagará à CONTRATADA o valor total de {{evento_valor_total}}, mediante a forma de pagamento: {{evento_forma_pagamento}}.

4. CLÁUSULA QUARTA - REPOSIÇÃO DE COPUS E UTENSÍLIOS
Em caso de quebra, dano ou extravio de copos e utensílios fornecidos pela CONTRATADA, o CONTRATANTE responsabiliza-se pelo ressarcimento dos valores de reposição conforme tabela:
{{tabela_reposicao}}

Data de Emissão: {{data_emissao}}

_____________________________________________
CONTRATANTE: {{cliente_nome}}

_____________________________________________
CONTRATADA: GOAT BAR EVENTOS LTDA ({{socio_nome}})`;

// --- 2. Signers Service ---
export const contractSignersService = {
  async listSigners() {
    const { data, error } = await supabase.from("contract_signers").select("*").order("name");
    if (error) throw error;
    return data as ContractSigner[];
  },

  async createSigner(payload: Omit<ContractSigner, "id" | "is_active">) {
    const { data, error } = await supabase
      .from("contract_signers")
      .insert({ ...payload, is_active: true })
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
  },
};

// --- 3. Glassware Service ---
export const glasswareService = {
  async listGlassware() {
    const { data, error } = await supabase.from("glassware").select("*").order("name");
    if (error) throw error;
    return data as Glassware[];
  },

  async createGlassware(payload: Omit<Glassware, "id" | "is_active">) {
    const { data, error } = await supabase.from("glassware").insert({ ...payload, is_active: true }).select().single();
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
  },
};

// --- 4. Event Contracts Service ---
export const eventContractsService = {
  async listAllContracts() {
    const { data, error } = await supabase.from("event_contracts").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data as EventContract[];
  },

  async getContractByEventId(eventId: string) {
    const { data, error } = await supabase
      .from("event_contracts")
      .select(
        `
        *,
        contract_templates (name),
        contract_signers (name)
      `,
      )
      .eq("event_id", eventId)
      .limit(1);
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  async createContractForEvent(eventId: string, templateId: string, signerId: string, customContent?: string) {
    const { data, error } = await supabase
      .from("event_contracts")
      .insert({
        event_id: eventId,
        template_id: templateId,
        signer_id: signerId,
        status: "draft",
        version: 1,
        generated_at: new Date().toISOString(),
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
        fully_signed_at: status === "signed" ? new Date().toISOString() : null,
      })
      .eq("id", contractId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadSignedContractFile(eventId: string, file: File): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${eventId}_signed_${Date.now()}.${fileExt}`;
    const filePath = `signed/${fileName}`;

    try {
      const { error } = await supabase.storage
        .from("contract-templates")
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("contract-templates").getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.warn("Storage upload error for signed contract, using Data URL fallback:", err);
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  },

  async saveSignedContract(eventId: string, signedFileUrl: string, contractId?: string): Promise<any> {
    if (contractId) {
      const { data, error } = await supabase
        .from("event_contracts")
        .update({
          signed_file_url: signedFileUrl,
          status: "signed",
          updated_at: new Date().toISOString(),
          fully_signed_at: new Date().toISOString(),
        })
        .eq("id", contractId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from("event_contracts")
        .insert({
          event_id: eventId,
          signed_file_url: signedFileUrl,
          status: "signed",
          version: 1,
          generated_at: new Date().toISOString(),
          fully_signed_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async compileContractVariables(eventId: string, signerId?: string) {
    // 1. Busca dados do evento no Supabase (Fonte real de verdade)
    const { data: evento, error: evError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (evError || !evento) throw new Error("Evento não encontrado no banco de dados");

    // 2. Busca dados do cliente no Supabase
    const { data: clientData } = await supabase
      .from("event_contract_client_data")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    // 3. Busca lista de copos para a tabela de reposição
    const { data: glasses } = await supabase.from("glassware").select("*").eq("is_active", true);

    // 4. Busca sócio assinante se informado
    let signer: ContractSigner | null = null;
    if (signerId) {
      const { data: s } = await supabase
        .from("contract_signers")
        .select("*")
        .eq("id", signerId)
        .maybeSingle();
      signer = s as ContractSigner | null;
    }

    // 5. Busca o orçamento atual para obter a descrição das bebidas
    const { data: currentBudget } = await supabase
      .from("event_budget_versions")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_current", true)
      .maybeSingle();

    const selectedDrinksObj = currentBudget?.selected_drinks as any;
    const descricaoBebidas = selectedDrinksObj?.descricaoBebidas || "";

    const fmt = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

    const drinksArray = Array.isArray(evento.drinks) ? evento.drinks : [];

    const tabelaReposicaoLines = glasses && glasses.length > 0
      ? glasses.map((g) => `• ${g.name} (${g.type || "Copo"}): ${fmt(g.replacement_value)} por unidade`).join("\n")
      : "• Copos Padrão: R$ 15,00 por unidade em caso de quebra/perda";

    // Monta o dicionário de variáveis
    const variables: Record<string, string> = {
      cliente_nome: clientData?.client_name || evento.client_name || "Não informado",
      cliente_documento: clientData?.cpf_cnpj || "Não informado",
      cliente_endereco: clientData?.address || evento.event_location || "Não informado",
      cliente_email: clientData?.email || evento.email || "Não informado",
      cliente_telefone: clientData?.phone || evento.phone || "Não informado",
      evento_nome: evento.event_name || evento.client_name || "Evento GOAT Bar",
      evento_tipo: evento.event_type || "Evento Social",
      evento_data: evento.date ? new Date(evento.date + "T00:00:00").toLocaleDateString("pt-BR") : "A definir",
      evento_horario: evento.event_time || "A definir",
      evento_local: evento.event_location || "A definir",
      evento_cidade: evento.city || "A definir",
      evento_convidados: String(evento.guests || 0),
      evento_valor_total: fmt(currentBudget?.final_budget_value || evento.current_budget_value || 0),
      evento_forma_pagamento: currentBudget?.payment_method || "A combinar",
      drinks_lista: drinksArray.length > 0 ? drinksArray.join(", ") : "Conforme cardápio selecionado",
      bebidas_descricao: descricaoBebidas || "Serviço de bar de coquetéis artesanais",
      tabela_reposicao: tabelaReposicaoLines,
      socio_nome: signer?.name || "Representante GOAT Bar",
      socio_cpf: signer?.cpf || "",
      socio_cargo: signer?.role || "Sócio Diretor",
      data_emissao: new Date().toLocaleDateString("pt-BR"),
    };

    return variables;
  },
};

// --- 5. Public Form Service ---
export const clientContractFormService = {
  async createPublicFormToken(eventId: string) {
    const token =
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

    const { data, error } = await supabase
      .from("event_contract_client_data")
      .upsert(
        {
          event_id: eventId,
          public_token: token,
          token_expires_at: expiresAt.toISOString(),
        },
        { onConflict: "event_id" },
      )
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
        submitted_at: new Date().toISOString(),
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
          email: payload.email,
        })
        .eq("id", form.event_id);
    }

    return data;
  },
};
