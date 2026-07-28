import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { numberToWordsBRL } from "@/lib/number-to-words-brl";
import {
  formatBrazilianDocument,
  getBrazilianDocumentType,
  formatDocumentWithType,
} from "@/lib/format-document";

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

// --- Helper de Renderização e Mapeamento de Template com Variáveis ---
export function getTemplateContent(template?: ContractTemplate | null): string {
  if (!template) return "";

  if (
    template.variables_schema &&
    typeof template.variables_schema === "object" &&
    !Array.isArray(template.variables_schema)
  ) {
    const schemaObj = template.variables_schema as any;
    if (schemaObj.content && typeof schemaObj.content === "string" && schemaObj.content.trim().length > 0) {
      return schemaObj.content;
    }
  }

  if (template.description && template.description.trim().length > 0) {
    return template.description;
  }

  return "";
}

export function getTemplateMapping(template?: ContractTemplate | null): Record<string, string> {
  if (
    template?.variables_schema &&
    typeof template.variables_schema === "object" &&
    !Array.isArray(template.variables_schema)
  ) {
    const schemaObj = template.variables_schema as any;
    if (schemaObj.mapping && typeof schemaObj.mapping === "object") {
      return schemaObj.mapping as Record<string, string>;
    }
  }
  return {};
}

export interface PlaceholderValidationResult {
  token: string;
  key: string;
  label: string;
  value: string;
  isFilled: boolean;
}

export function validateContractPlaceholders(
  templateBody: string,
  variables: Record<string, any>
): {
  filled: PlaceholderValidationResult[];
  unfilled: PlaceholderValidationResult[];
} {
  const filled: PlaceholderValidationResult[] = [];
  const unfilled: PlaceholderValidationResult[] = [];
  const seenTokens = new Set<string>();

  // Detecta tags {{chave}} ou [TAGS] presentes estritamente no modelo
  const regex = /\{\{\s*([a-zA-Z0-9._]+)\s*\}\}|\[([A-Z0-9_]+)\]/g;
  let match;

  while ((match = regex.exec(templateBody || "")) !== null) {
    const key = match[1] || match[2];
    const token = match[0];

    if (key && !seenTokens.has(token)) {
      seenTokens.add(token);
      const val = variables[key] !== undefined && variables[key] !== null ? String(variables[key]).trim() : "";
      const isMissing = !val || val === "Não informado" || val === "A definir";

      const item: PlaceholderValidationResult = {
        token,
        key,
        label: key,
        value: val || "Sem informação cadastrada",
        isFilled: !isMissing,
      };

      if (!isMissing) {
        filled.push(item);
      } else {
        unfilled.push(item);
      }
    }
  }

  return { filled, unfilled };
}

export function renderContractTemplate(
  templateBody: string,
  variables: Record<string, any>,
  customMapping?: Record<string, string>
): string {
  if (!templateBody) return "";
  let result = templateBody;

  // 1. Limpa invólucros de chips HTML (<span class="docx-field-chip"...>...</span>) extraindo o token limpo
  result = result.replace(/<span[^>]*class="docx-field-chip"[^>]*>([\s\S]*?)<\/span>/gi, (_match, inner) => {
    return inner.replace(/<button[^>]*>.*?<\/button>/gi, "").trim();
  });

  // 2. Substituição via mapeamento customizado (De-Para do Usuário)
  if (customMapping) {
    Object.keys(customMapping).forEach((sysKey) => {
      const matchToken = customMapping[sysKey];
      if (matchToken && matchToken.trim().length > 0) {
        const rawVal = variables[sysKey];
        const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim().length > 0
          ? String(rawVal)
          : "Não informado";

        const escaped = matchToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Elimina o token completo e qualquer sufixo 'xx' ou 'x' colado
        const regex = new RegExp(`${escaped}(?:xx|x)?`, "gi");
        result = result.replace(regex, val);
      }
    });
  }

  // 3. Substituição padrão para tags {{chave}} e [CHAVE] eliminando sufixos 'xx'
  Object.keys(variables).forEach((key) => {
    const rawVal = variables[key];
    const val = rawVal !== undefined && rawVal !== null && String(rawVal).trim().length > 0
      ? String(rawVal)
      : "Não informado";

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const curlyRegex = new RegExp(`{{\\s*${escapedKey}\\s*}}(?:xx|x)?`, "gi");
    const bracketRegex = new RegExp(`\\[\\s*${escapedKey.toUpperCase()}\\s*\\](?:xx|x)?`, "gi");

    result = result.replace(curlyRegex, val).replace(bracketRegex, val);
  });

  // 4. Limpeza final de qualquer placeholder genérico não substituído e sufixos 'xx' residuais
  result = result.replace(/\{\{\s*[\w.]+\s*\}\}(?:xx|x)?/gi, "Não informado");
  result = result.replace(/\[\s*[\w._]+\s*\](?:xx|x)?/gi, "Não informado");

  return result;
}

export const DEFAULT_CONTRACT_BODY = "";

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

  async deleteSigner(id: string) {
    const { error } = await supabase.from("contract_signers").delete().eq("id", id);
    if (error) throw error;
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

    // 6. Cálculos de Horário e Período do Evento
    const horaInicioStr = evento.event_time || "19:00";
    const durationHours = Number(evento.duration_hours) || 6;
    let horaFimStr = "01:00";

    try {
      const parts = horaInicioStr.split(":");
      const startH = parseInt(parts[0], 10) || 19;
      const startM = parseInt(parts[1], 10) || 0;
      const totalMinutes = startH * 60 + startM + Math.round(durationHours * 60);
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const formatTwo = (n: number) => String(n).padStart(2, "0");
      horaFimStr = `${formatTwo(endH)}:${formatTwo(endM)}`;
    } catch (err) {
      console.warn("Erro ao calcular horário final do evento:", err);
    }
    const periodoEventoStr = `${horaInicioStr} às ${horaFimStr}`;

    // 7. Cálculos Financeiros
    const totalVal = currentBudget?.final_budget_value || evento.current_budget_value || 0;
    const entryVal = currentBudget?.paid_value || currentBudget?.deposit_value || (totalVal * 0.5);
    const remainingVal = Math.max(0, totalVal - entryVal);
    const numGuests = Number(evento.guests) || 1;
    const valPerPerson = (currentBudget as any)?.value_per_person || (totalVal > 0 && numGuests > 0 ? totalVal / numGuests : 0);

    // 8. Cálculo da Data de Pagamento Final (Data do Evento - 7 dias)
    let finalPaymentDateStr = "A definir (7 dias antes do evento)";
    if (evento.date) {
      try {
        const evDate = new Date(evento.date + "T00:00:00");
        evDate.setDate(evDate.getDate() - 7);
        finalPaymentDateStr = evDate.toLocaleDateString("pt-BR");
      } catch (err) {
        console.warn("Erro ao calcular data final de pagamento:", err);
      }
    }

    // 9. Extração dos Dados Atualizados do Contratante (Vindo do Formulário do Link como Fonte de Verdade)
    const clientNotes = (clientData?.notes && typeof clientData.notes === "object" ? clientData.notes : {}) as any;
    const rawDocument = clientData?.cpf_cnpj || clientNotes?.cpf_cnpj || evento.client_cpf_cnpj;
    const formattedDocument = formatBrazilianDocument(rawDocument);
    const documentWithType = formatDocumentWithType(rawDocument);
    const documentType = getBrazilianDocumentType(rawDocument);

    const rgClient = clientData?.rg || clientNotes?.rg || "Não informado";
    const whatsappClient = clientData?.whatsapp || clientData?.phone || evento.phone || "Não informado";
    const cepClient = clientData?.cep || clientNotes?.cep || "Não informado";
    const cityClient = clientData?.city || clientNotes?.city || evento.city || "Não informado";
    const stateClient = clientData?.state || clientNotes?.state || "SP";

    // Local do Evento Atualizado pelo Formulário
    const venueName = clientNotes?.venue_name || evento.event_location || "A definir";
    const venueAddress = clientNotes?.venue_address || clientData?.address || evento.event_location || "A definir";
    const venueCity = clientNotes?.venue_city || evento.city || "A definir";
    const venueCep = clientNotes?.venue_cep || "A definir";
    const venueComplement = clientNotes?.venue_complement || "";

    // 10. Cálculos de Condição, Meio de Pagamento e Cláusula Completa
    const meioPagamentoStr = currentBudget?.payment_channel || clientNotes?.payment_channel || "PIX";
    const percentualNum = totalVal > 0 ? Math.round((entryVal / totalVal) * 100) : 50;
    const percentualText = `${percentualNum}%`;
    const percentualExtenso = percentualNum === 30 ? "30% (trinta por cento)" :
                              percentualNum === 40 ? "40% (quarenta por cento)" :
                              percentualNum === 50 ? "50% (cinquenta por cento)" :
                              `${percentualNum}%`;

    let formaPagamentoDesc = "";
    if (entryVal >= totalVal) {
      formaPagamentoDesc = `Pagamento integral via ${meioPagamentoStr} no ato da assinatura do contrato.`;
    } else if (percentualNum > 0) {
      formaPagamentoDesc = `${percentualText} no ato da assinatura do contrato e o valor restante deverá ser pago até a data limite de ${finalPaymentDateStr} (7 dias antes da realização do evento), por meio de ${meioPagamentoStr}.`;
    } else {
      formaPagamentoDesc = `Entrada de ${fmt(entryVal)} no ato da assinatura do contrato e saldo remanescente de ${fmt(remainingVal)} até a data limite de ${finalPaymentDateStr} (${meioPagamentoStr}).`;
    }

    let clausulaPagamentoStr = "";
    if (entryVal >= totalVal) {
      clausulaPagamentoStr = `O CONTRATANTE efetuará o pagamento integral do valor de ${fmt(totalVal)} (${numberToWordsBRL(totalVal).toLowerCase()}) no ato da assinatura do contrato, por meio de ${meioPagamentoStr}.`;
    } else if (percentualNum > 0 && Math.abs(entryVal - (totalVal * percentualNum / 100)) < 10) {
      clausulaPagamentoStr = `O CONTRATANTE pagará ${percentualExtenso} do valor total do contrato no ato da assinatura, correspondente a ${fmt(entryVal)} (${numberToWordsBRL(entryVal).toLowerCase()}), ficando o saldo remanescente de ${fmt(remainingVal)} (${numberToWordsBRL(remainingVal).toLowerCase()}) para pagamento até a data limite de ${finalPaymentDateStr} (7 dias antes da realização do evento), por meio de ${meioPagamentoStr}.`;
    } else {
      clausulaPagamentoStr = `O CONTRATANTE efetuará o pagamento de ${fmt(entryVal)} (${numberToWordsBRL(entryVal).toLowerCase()}) no ato da assinatura do contrato, permanecendo o saldo remanescente de ${fmt(remainingVal)} (${numberToWordsBRL(remainingVal).toLowerCase()}), que deverá ser quitado até a data limite de ${finalPaymentDateStr} (7 dias antes da realização do evento), por meio de ${meioPagamentoStr}.`;
    }

    const paymentMethodText = formaPagamentoDesc;

    // Monta o dicionário completo de variáveis
    const variables: Record<string, string> = {
      // 🥂 Evento
      "evento.nome": evento.event_name || evento.client_name || "Evento GOAT Bar",
      "evento.tipo": evento.event_type || "Evento Social",
      "evento.data": evento.date ? new Date(evento.date + "T00:00:00").toLocaleDateString("pt-BR") : "A definir",
      "evento.hora_inicio": horaInicioStr,
      "evento.hora_fim": horaFimStr,
      "evento.duracao_horas": `${durationHours} horas`,
      "evento.periodo_evento": periodoEventoStr,
      "evento.local": venueName,
      "evento.endereco_local": venueAddress,
      "evento.cidade": venueCity,
      "evento.cep_local": venueCep,
      "evento.complemento_local": venueComplement,
      "evento.convidados": String(evento.guests || 0),
      "evento.valor_por_pessoa": fmt(valPerPerson),
      "evento.valor_por_pessoa_extenso": numberToWordsBRL(valPerPerson),

      // 👤 Cliente (Preenchido pelo Contratante no Link - Fonte Principal)
      "cliente.nome": clientData?.client_name || evento.client_name || "Não informado",
      "cliente.documento": formattedDocument || "Não informado",
      "cliente.documento_com_rotulo": documentWithType || "Não informado",
      "cliente.tipo_documento": documentType,
      "cliente.rg": rgClient,
      "cliente.telefone": clientData?.phone || evento.phone || "Não informado",
      "cliente.whatsapp": whatsappClient,
      "cliente.email": clientData?.email || evento.email || "Não informado",
      "cliente.endereco": clientData?.address || evento.event_location || "Não informado",
      "cliente.cep": cepClient,
      "cliente.cidade": cityClient,
      "cliente.estado": stateClient,

      // 💰 Financeiro (Cálculos Automáticos em Número, por Extenso e Cláusula Completa)
      "financeiro.valor_total": fmt(totalVal),
      "financeiro.valor_total_extenso": numberToWordsBRL(totalVal),
      "financeiro.valor_entrada": fmt(entryVal),
      "financeiro.valor_entrada_extenso": numberToWordsBRL(entryVal),
      "financeiro.valor_restante": fmt(remainingVal),
      "financeiro.valor_restante_extenso": numberToWordsBRL(remainingVal),
      "financeiro.saldo_restante": fmt(remainingVal),
      "financeiro.saldo_restante_extenso": numberToWordsBRL(remainingVal),
      "financeiro.percentual_entrada": percentualText,
      "financeiro.meio_pagamento": meioPagamentoStr,
      "financeiro.forma_pagamento": formaPagamentoDesc,
      "financeiro.clausula_pagamento": clausulaPagamentoStr,
      "financeiro.data_pagamento_final": finalPaymentDateStr,
      "financeiro.data_vencimento": finalPaymentDateStr,

      // 🏢 Empresa / GOAT Bar
      "empresa.nome": "GOAT BAR EVENTOS LTDA",
      "empresa.cnpj": "42.123.456/0001-99",
      "empresa.endereco": "Av. Brigadeiro Faria Lima, 2000 - São Paulo/SP",
      "empresa.responsavel": signer?.name || "Representante GOAT Bar",
      "empresa.cpf_responsavel": formatBrazilianDocument(signer?.cpf || ""),
      "empresa.cargo_responsavel": signer?.role || "Sócio Diretor",
      "empresa.endereco_responsavel": signer?.address || "",

      // 🍹 Cardápio & Utensílios
      "cardapio.drinks": drinksArray.length > 0 ? drinksArray.join(", ") : "Conforme cardápio selecionado",
      "cardapio.descricao": descricaoBebidas || "Serviço de bar de coquetéis artesanais",
      "cardapio.tabela_reposicao": tabelaReposicaoLines,

      // 🗓️ Geral
      "geral.data_emissao": new Date().toLocaleDateString("pt-BR"),

      // Aliases em Underscore
      cliente_nome: clientData?.client_name || evento.client_name || "Não informado",
      cliente_documento: formattedDocument || "Não informado",
      cliente_documento_com_rotulo: documentWithType || "Não informado",
      cliente_tipo_documento: documentType,
      cliente_endereco: clientData?.address || evento.event_location || "Não informado",
      cliente_email: clientData?.email || evento.email || "Não informado",
      cliente_telefone: clientData?.phone || evento.phone || "Não informado",
      evento_nome: evento.event_name || evento.client_name || "Evento GOAT Bar",
      evento_tipo: evento.event_type || "Evento Social",
      evento_data: evento.date ? new Date(evento.date + "T00:00:00").toLocaleDateString("pt-BR") : "A definir",
      evento_hora_inicio: horaInicioStr,
      evento_hora_fim: horaFimStr,
      evento_periodo_evento: periodoEventoStr,
      evento_local: venueName,
      evento_cidade: venueCity,
      evento_convidados: String(evento.guests || 0),
      evento_valor_por_pessoa: fmt(valPerPerson),
      evento_valor_total: fmt(totalVal),
      financeiro_valor_total: fmt(totalVal),
      financeiro_valor_entrada: fmt(entryVal),
      financeiro_valor_restante: fmt(remainingVal),
      financeiro_data_pagamento_final: finalPaymentDateStr,
      financeiro_forma_pagamento: formaPagamentoDesc,
      evento_forma_pagamento: paymentMethodText,
      forma_pagamento: paymentMethodText,
      drinks_lista: drinksArray.length > 0 ? drinksArray.join(", ") : "Conforme cardápio selecionado",
      bebidas_descricao: descricaoBebidas || "Serviço de bar de coquetéis artesanais",
      tabela_reposicao: tabelaReposicaoLines,
      socio_nome: signer?.name || "Representante GOAT Bar",
      socio_cpf: signer?.cpf || "",
      socio_cargo: signer?.role || "Sócio Diretor",
      socio_endereco: signer?.address || "",
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
