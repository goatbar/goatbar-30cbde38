import { supabase } from "@/integrations/supabase/client";
import {
  compareContractVersions,
  ContractAddendumComparison,
  BudgetVersionData,
} from "@/lib/contract-addendum-comparator";

export interface ContractAddendumRow {
  id: string;
  event_id: string;
  contract_id: string;
  addendum_number: number;
  base_budget_version_id: string | null;
  updated_budget_version_id: string | null;
  contractant_snapshot: Record<string, any>;
  contracted_snapshot: Record<string, any>;
  previous_snapshot: Record<string, any>;
  current_snapshot: Record<string, any>;
  financial_snapshot: Record<string, any>;
  comparison_snapshot: Record<string, any>;
  balance_payment_condition: string | null;
  balance_payment_method: string | null;
  balance_due_dates: string[];
  original_contract_date: string;
  addendum_date: string;
  generated_html: string | null;
  generated_file_url: string | null;
  signed_file_url: string | null;
  status: "draft" | "sent" | "signed" | "cancelled";
  external_document_id?: string | null;
  external_assignment_id?: string | null;
  sent_for_signature_at?: string | null;
  fully_signed_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EffectiveBudgetVersionResult {
  budgetVersion: any;
  budgetVersionId: string;
  source: "signed_addendum" | "original_contract";
  addendumNumber?: number;
}

export function assertAddendumReadyForSignature(addendum: Pick<ContractAddendumRow, "generated_html" | "original_contract_date" | "financial_snapshot">) {
  const html=addendum.generated_html||"";
  if (!addendum.original_contract_date) throw new Error("PENDING_ORIGINAL_SIGNATURE_DATE");
  if (addendum.financial_snapshot?.paid_amount === null || addendum.financial_snapshot?.paid_amount === undefined) throw new Error("PENDING_PAID_AMOUNT");
  if (/Não informado|A definir|\{\{|\[[A-Z0-9_]+\]/i.test(html)) throw new Error("ADDENDUM_HAS_UNRESOLVED_PLACEHOLDERS");
}

/** Modelo Oficial do Termo Aditivo ao Contrato */
export function buildAddendumTemplateHtml(vars: Record<string, string>): string {
  const clauses: string[] = [];
  if (vars.clausula_drinks) clauses.push(`<h3>CLÁUSULA — DOS DRINKS E BEBIDAS</h3><p>${vars.clausula_drinks}</p>`);
  if (vars.clausula_valor) clauses.push(`<h3>CLÁUSULA — DO VALOR E PAGAMENTO</h3><p>${vars.clausula_valor}</p>`);
  if (vars.clausula_convidados) clauses.push(`<h3>CLÁUSULA — DOS CONVIDADOS</h3><p>${vars.clausula_convidados}</p>`);
  if (vars.clausula_demais) clauses.push(`<h3>CLÁUSULA — DAS DEMAIS ALTERAÇÕES</h3><p>${vars.clausula_demais}</p>`);
  return `
<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 16px; text-transform: uppercase;">
  TERMO ADITIVO AO CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BAR PARA EVENTOS
</h1>

<p style="text-align: justify; margin-bottom: 12px;">
  Pelo presente instrumento particular de Termo Aditivo ao Contrato de Prestação de Serviços de Bar para Eventos, de um lado:
</p>

<p style="text-align: justify; margin-bottom: 8px;">
  <strong>CONTRATANTE:</strong> ${vars.contratante_nome || ""}${vars.contratante_documento ? `, inscrita(o) no CPF/CNPJ sob o nº ${vars.contratante_documento}` : ""}.
</p>

<p style="text-align: justify; margin-bottom: 12px;">
  E, de outro lado, <strong>CONTRATADA:</strong> ${vars.contratada_nome || "GOAT BAR EVENTOS LTDA"}${vars.contratada_documento ? `, inscrita no CNPJ sob o nº ${vars.contratada_documento}` : ""}.
</p>

<p style="text-align: justify; margin-bottom: 16px;">
  As partes acima qualificadas têm entre si justo e acertado o presente <strong>TERMO ADITIVO</strong> ao Contrato de Prestação de Serviços de Bar para Eventos firmado em <strong>${vars.data_contrato_original || ""}</strong>, mediante as seguintes cláusulas:
</p>

${clauses.join("\n")}

<h3 style="font-size: 14px; font-weight: bold; margin-top: 16px; margin-bottom: 6px;">
  CLÁUSULA QUARTA — DA RATIFICAÇÃO
</h3>
<p style="text-align: justify; margin-bottom: 24px;">
  4.1. Permanecem inalteradas e ratificadas todas as demais cláusulas e condições do Contrato de Prestação de Serviços de Bar para Eventos original que não tenham sido expressamente modificadas por este Termo Aditivo.
</p>

<p style="text-align: right; margin-bottom: 32px;">
  ${vars.cidade_assinatura || "São Paulo/SP"}, ${vars.data_aditivo || new Date().toLocaleDateString("pt-BR")}.
</p>

<div class="signature-block" style="margin-top: 40px; page-break-inside: avoid;">
  <table style="width: 100%; border: none;">
    <tr>
      <td style="width: 48%; border: none; text-align: center; vertical-align: top;">
        _____________________________________<br />
        <strong>CONTRATANTE: ${vars.contratante_nome || ""}</strong>
      </td>
      <td style="width: 4%;"></td>
      <td style="width: 48%; border: none; text-align: center; vertical-align: top;">
        _____________________________________<br />
        <strong>CONTRATADA: ${vars.contratada_nome || "GOAT BAR EVENTOS LTDA"}</strong>
      </td>
    </tr>
  </table>
</div>
`.trim();
}

export const contractAddendumService = {
  /**
   * Resolve a versão de proposta contratual vigente.
   * Regra estrita:
   *  1. Último Aditivo com status = 'signed' -> updated_budget_version_id
   *  2. Caso contrário: event_contracts.budget_version_id
   */
  async getEffectiveBudgetVersion(
    contractId: string,
    eventId: string,
  ): Promise<EffectiveBudgetVersionResult> {
    // 1. Busca o último aditivo assinado
    const { data: addendums } = await supabase
      .from("contract_addendums")
      .select("*, updated_budget_version_id")
      .eq("contract_id", contractId)
      .eq("status", "signed")
      .order("addendum_number", { ascending: false })
      .limit(1);

    if (addendums && addendums.length > 0 && addendums[0].updated_budget_version_id) {
      const { data: budget } = await supabase
        .from("event_budget_versions")
        .select("*")
        .eq("id", addendums[0].updated_budget_version_id)
        .single();

      if (budget) {
        return {
          budgetVersion: budget,
          budgetVersionId: budget.id,
          source: "signed_addendum",
          addendumNumber: addendums[0].addendum_number,
        };
      }
    }

    // 2. Fallback para o contrato original
    const { data: contract } = await supabase
      .from("event_contracts")
      .select("budget_version_id")
      .eq("id", contractId)
      .single();

    if (!contract || !contract.budget_version_id) {
      throw new Error("CONTRACT_MISSING_BUDGET_VERSION");
    }

    const { data: origBudget } = await supabase
      .from("event_budget_versions")
      .select("*")
      .eq("id", contract.budget_version_id)
      .single();

    if (!origBudget) {
      throw new Error("PROPOSAL_VERSION_NOT_FOUND");
    }

    return {
      budgetVersion: origBudget,
      budgetVersionId: origBudget.id,
      source: "original_contract",
    };
  },

  /**
   * Trata a resolução determinística para contratos legados sem budget_version_id.
   * - Se 1 única proposta no evento: associa automaticamente.
   * - Se múltiplas propostas e selectedBudgetId informado: associa manualmente.
   * - Se múltiplas e selectedBudgetId ausente: lança erro com a lista de propostas disponíveis.
   */
  async resolveLegacyContractBudgetVersion(
    contractId: string,
    selectedBudgetId?: string,
  ): Promise<{ budgetVersionId: string; autoResolved: boolean }> {
    const { data: contract } = await supabase
      .from("event_contracts")
      .select("id, event_id, budget_version_id")
      .eq("id", contractId)
      .single();

    if (!contract) throw new Error("Contrato não encontrado.");

    if (contract.budget_version_id) {
      return { budgetVersionId: contract.budget_version_id, autoResolved: true };
    }

    // Busca todas as versões do evento
    const { data: versions } = await supabase
      .from("event_budget_versions")
      .select("id, version_number, final_budget_value, created_at")
      .eq("event_id", contract.event_id)
      .order("version_number", { ascending: true });

    if (!versions || versions.length === 0) {
      throw new Error("Nenhuma proposta comercial foi encontrada para este evento.");
    }

    if (versions.length === 1) {
      // Exatamente 1 versão: backfill determinístico
      await supabase
        .from("event_contracts")
        .update({ budget_version_id: versions[0].id })
        .eq("id", contractId);
      return { budgetVersionId: versions[0].id, autoResolved: true };
    }

    if (selectedBudgetId) {
      const match = versions.find((v: any) => v.id === selectedBudgetId);
      if (!match) throw new Error("A versão selecionada não pertence a este evento.");
      await supabase
        .from("event_contracts")
        .update({ budget_version_id: selectedBudgetId })
        .eq("id", contractId);
      return { budgetVersionId: selectedBudgetId, autoResolved: false };
    }

    const err = new Error("LEGACY_CONTRACT_REQUIRES_MANUAL_SELECTION") as any;
    err.versions = versions;
    throw err;
  },

  /**
   * Verifica se já existe um aditivo ativo (status draft ou sent).
   * Impede a criação de um segundo aditivo concorrente.
   */
  async hasActiveAddendum(
    contractId: string,
  ): Promise<{ active: boolean; activeAddendum?: ContractAddendumRow }> {
    const { data } = await supabase
      .from("contract_addendums")
      .select("*")
      .eq("contract_id", contractId)
      .in("status", ["draft", "sent"])
      .maybeSingle();

    return {
      active: !!data,
      activeAddendum: (data as ContractAddendumRow) || undefined,
    };
  },

  /**
   * Lista todos os aditivos de um contrato em ordem cronológica
   */
  async listAddendumsByContract(contractId: string): Promise<ContractAddendumRow[]> {
    const { data, error } = await supabase
      .from("contract_addendums")
      .select("*")
      .eq("contract_id", contractId)
      .order("addendum_number", { ascending: true });

    if (error) throw error;
    return (data as ContractAddendumRow[]) || [];
  },

  /**
   * Prepara o payload completo para revisão prévia do Aditivo.
   */
  async prepareAddendumData(contractId: string, eventId: string) {
    // 1. Valida contrato e data de assinatura oficial
    const { data: contract } = await supabase
      .from("event_contracts")
      .select("*, contract_signers(*)")
      .eq("id", contractId)
      .single();

    if (!contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "signed" || !contract.fully_signed_at) {
      throw new Error("CONTRACT_NOT_FULLY_SIGNED");
    }

    // 2. Resolve a versão contratual vigente (base)
    const effective = await this.getEffectiveBudgetVersion(contractId, eventId);
    const baseVersion: BudgetVersionData = effective.budgetVersion;

    // 3. Busca a proposta atual aprovada (is_current = true)
    const { data: updatedVersionRaw } = await supabase
      .from("event_budget_versions")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_current", true)
      .maybeSingle();

    if (!updatedVersionRaw) throw new Error("Não existe proposta comercial atual para este evento.");
    const updatedVersion: BudgetVersionData = updatedVersionRaw;

    if (updatedVersion.id === baseVersion.id) {
      throw new Error("NO_PROPOSAL_CHANGES_DETECTED");
    }

    // 4. Executa o comparador determinístico
    const comparison = compareContractVersions(baseVersion, updatedVersion);

    // 5. Dados do Contratante e da Empresa
    const { data: clientData } = await supabase
      .from("event_contract_client_data")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    const { data: evento } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    const contratanteNome = clientData?.client_name || evento?.client_name || "";
    const contratanteDoc = clientData?.cpf_cnpj || (clientData?.notes as any)?.cpf_cnpj || "";
    const contratadaNome = "GOAT BAR EVENTOS LTDA";
    const contratadaDoc = "42.123.456/0001-99";
    const dataContratoOriginal = new Date(contract.fully_signed_at).toLocaleDateString("pt-BR");

    const templateVars: Record<string, string> = {
      contratante_nome: contratanteNome,
      contratante_documento: contratanteDoc,
      contratada_nome: contratadaNome,
      contratada_documento: contratadaDoc,
      data_contrato_original: dataContratoOriginal,
      drinks_atuais: comparison.drinks.finalListText,
      novo_valor_total: comparison.totalValue.currentFormatted,
      novo_valor_total_extenso: comparison.totalValue.currentWords,
      valor_ja_pago: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        comparison.financial.paidAmount || 0,
      ),
      saldo_restante: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(comparison.financial.remainingBalance || 0),
      forma_pagamento_saldo: comparison.financial.paymentCondition || "",
      meio_pagamento_saldo: comparison.financial.paymentMethod || "",
      datas_vencimento: comparison.financial.dueDate,
      valor_convidado_excedente: comparison.extraGuestValue.currentFormatted,
      valor_convidado_excedente_extenso: comparison.extraGuestValue.currentWords,
      cidade_assinatura: evento?.city || "São Paulo/SP",
      data_aditivo: new Date().toLocaleDateString("pt-BR"),
      resumo_alteracoes: comparison.resumo_alteracoes,
    };
    if (comparison.drinks.changed) templateVars.clausula_drinks = `Os drinks e bebidas passam a ser: <em>“${comparison.drinks.finalListText}”</em>.`;
    if (comparison.totalValue.changed) templateVars.clausula_valor = "As condições financeiras serão detalhadas após a confirmação das condições do saldo.";
    if (comparison.guestCount.changed || comparison.extraGuestValue.changed) templateVars.clausula_convidados = `${comparison.guestCount.changed ? `A quantidade de convidados passa de ${comparison.guestCount.previous} para ${comparison.guestCount.current}. ` : ""}${comparison.extraGuestValue.changed ? `O valor por convidado excedente passa a ser ${comparison.extraGuestValue.currentFormatted} (${comparison.extraGuestValue.currentWords}).` : ""}`;
    const otherChanges=comparison.changes.filter((c)=>!["drinks","total_value","guest_count","extra_guest_value"].includes(c.key));
    if (otherChanges.length) templateVars.clausula_demais=otherChanges.map((c)=>`${c.label}: de ${JSON.stringify(c.previous)} para ${JSON.stringify(c.current)}.`).join(" ");

    const compiledHtml = buildAddendumTemplateHtml(templateVars);

    return {
      contract,
      baseVersion,
      updatedVersion,
      comparison,
      templateVars,
      compiledHtml,
      originalContractDate: contract.fully_signed_at,
    };
  },

  /**
   * Cria um novo registro de Aditivo com snapshots imutáveis.
   */
  async createAddendum(params: {
    contractId: string;
    eventId: string;
    paymentCondition?: string;
    paymentMethod?: string;
    dueDates?: string[];
  }): Promise<ContractAddendumRow> {
    const { active, activeAddendum } = await this.hasActiveAddendum(params.contractId);
    if (active && activeAddendum) {
      throw new Error(
        `Já existe o Aditivo nº ${activeAddendum.addendum_number} pendente de assinatura (${activeAddendum.status}). Conclua ou cancele o aditivo existente antes de gerar um novo.`,
      );
    }

    const data = await this.prepareAddendumData(params.contractId, params.eventId);

    if (!data.comparison.requiresAddendum) {
      throw new Error(
        "A versão atual da proposta não possui alterações contratuais relevantes para gerar um Termo Aditivo.",
      );
    }

    if (data.comparison.valor_ja_pago === null) throw new Error("PENDING_PAID_AMOUNT");
    const condition=params.paymentCondition||data.comparison.forma_pagamento_saldo;
    const method=params.paymentMethod||data.comparison.meio_pagamento_saldo;
    const dueDates=params.dueDates?.filter(Boolean).length?params.dueDates:data.comparison.datas_vencimento;
    if (data.comparison.novo_saldo_restante! > 0 && (!condition || !method || !dueDates.length)) throw new Error("PENDING_BALANCE_PAYMENT_TERMS");
    data.templateVars.forma_pagamento_saldo=condition||""; data.templateVars.meio_pagamento_saldo=method||""; data.templateVars.datas_vencimento=dueDates.join(" e ");
    if (data.comparison.totalValue.changed) data.templateVars.clausula_valor=`O valor total passa a ser de <strong>${data.templateVars.novo_valor_total}</strong> (${data.templateVars.novo_valor_total_extenso}). O CONTRATANTE já pagou <strong>${data.templateVars.valor_ja_pago}</strong>, restando <strong>${data.templateVars.saldo_restante}</strong>, que será pago ${condition?.toLowerCase()}, via ${method}, com vencimento em ${dueDates.join(" e ")}.`;

    const finalHtml = buildAddendumTemplateHtml(data.templateVars);

    // Calcula próximo addendum_number
    const { data: existing } = await supabase
      .from("contract_addendums")
      .select("addendum_number")
      .eq("contract_id", params.contractId)
      .order("addendum_number", { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0 ? existing[0].addendum_number + 1 : 1;

    // Snapshots imutáveis
    const financialSnapshot = {
      previous_total: data.comparison.totalValue.previous,
      current_total: data.comparison.totalValue.current,
      addendum_difference: data.comparison.totalValue.difference,
      paid_amount: data.comparison.financial.paidAmount,
      remaining_balance: data.comparison.financial.remainingBalance,
      payment_condition: condition, payment_method: method, due_dates: dueDates,
      previous_extra_guest_value: data.comparison.extraGuestValue.previous,
      current_extra_guest_value: data.comparison.extraGuestValue.current,
    };

    const previousSnapshot = {
      drinks: data.comparison.drinks.previousDrinks,
      total_value: data.comparison.totalValue.previous,
      extra_guest_value: data.comparison.extraGuestValue.previous,
    };

    const currentSnapshot = {
      drinks: data.comparison.drinks.currentDrinks,
      total_value: data.comparison.totalValue.current,
      extra_guest_value: data.comparison.extraGuestValue.current,
    };

    const { data: newAddendum, error } = await supabase
      .from("contract_addendums")
      .insert({
        event_id: params.eventId,
        contract_id: params.contractId,
        addendum_number: nextNumber,
        base_budget_version_id: data.baseVersion.id,
        updated_budget_version_id: data.updatedVersion.id,
        contractant_snapshot: {
          nome: data.templateVars.contratante_nome,
          documento: data.templateVars.contratante_documento,
        },
        contracted_snapshot: {
          nome: data.templateVars.contratada_nome,
          documento: data.templateVars.contratada_documento,
        },
        previous_snapshot: previousSnapshot,
        current_snapshot: currentSnapshot,
        financial_snapshot: financialSnapshot,
        comparison_snapshot: data.comparison as any,
        balance_payment_condition: condition,
        balance_payment_method: method,
        balance_due_dates: dueDates,
        original_contract_date: data.originalContractDate,
        generated_html: finalHtml,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;
    return newAddendum as ContractAddendumRow;
  },

  /**
   * Dispara o Termo Aditivo para assinatura na Assinafy com título legível.
   */
  async dispatchAddendumToAssinafy(
    addendumId: string,
    convertPdfFn: (html: string, title: string) => Promise<{ base64: string; hash: string }>,
  ): Promise<{ success: boolean; externalDocumentId?: string; message?: string }> {
    const { data: addendum } = await supabase
      .from("contract_addendums")
      .select("*, events(*)")
      .eq("id", addendumId)
      .single();

    if (!addendum || !addendum.generated_html) {
      throw new Error("Aditivo não encontrado ou sem minuta gerada.");
    }
    assertAddendumReadyForSignature(addendum as ContractAddendumRow);

    const eventName = (addendum.events as any)?.event_name || (addendum.events as any)?.client_name || "Evento";
    const rawDate = ((addendum.events as any)?.date || "").slice(0, 10);
    const formattedDate = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      ? `${rawDate.slice(8, 10)}-${rawDate.slice(5, 7)}-${rawDate.slice(0, 4)}`
      : "";

    const docTitle = `Termo Aditivo ${addendum.addendum_number} Goat Bar - ${eventName}${formattedDate ? ` - ${formattedDate}` : ""}`;

    // 1. Converte o HTML do aditivo em PDF imutável
    const pdf = await convertPdfFn(addendum.generated_html, docTitle);

    // 2. Invoca Edge Function assinafy-create-doc
    const { data: res, error } = await supabase.functions.invoke("assinafy-create-doc", {
      body: {
        contractId: addendum.contract_id,
        pdfBase64: pdf.base64,
        pdfHash: pdf.hash,
        documentTitle: docTitle,
      },
    });

    if (error || !res?.success) {
      throw new Error(
        res?.message || error?.message || "Falha ao enviar Termo Aditivo para Assinafy.",
      );
    }

    // 3. Persiste dados do despacho no aditivo
    await supabase
      .from("contract_addendums")
      .update({
        status: "sent",
        external_document_id: res.externalDocumentId || null,
        external_assignment_id: res.externalAssignmentId || null,
        sent_for_signature_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", addendumId);

    return {
      success: true,
      externalDocumentId: res.externalDocumentId,
      message: res.message,
    };
  },

  /**
   * Sincroniza o status de assinatura do aditivo com a Assinafy.
   */
  async syncAddendumStatus(addendumId: string): Promise<{ status: string; fullySigned: boolean }> {
    const { data: addendum } = await supabase
      .from("contract_addendums")
      .select("id, status, external_document_id, contract_id")
      .eq("id", addendumId)
      .single();

    if (!addendum) throw new Error("Aditivo não encontrado.");

    if (addendum.status === "signed") {
      return { status: "signed", fullySigned: true };
    }

    if (!addendum.external_document_id) {
      return { status: addendum.status, fullySigned: false };
    }

    // Verifica na contract_signature_requests se a Assinafy concluiu o documento
    const { data: sigReq } = await supabase
      .from("contract_signature_requests")
      .select("dispatch_status, internal_status, signed_file_path")
      .eq("external_document_id", addendum.external_document_id)
      .maybeSingle();

    if (
      sigReq &&
      (sigReq.dispatch_status === "completed" ||
        sigReq.dispatch_status === "signed" ||
        sigReq.internal_status === "signed")
    ) {
      await supabase
        .from("contract_addendums")
        .update({
          status: "signed",
          fully_signed_at: new Date().toISOString(),
          signed_file_url: sigReq.signed_file_path || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", addendumId);

      return { status: "signed", fullySigned: true };
    }

    return { status: addendum.status, fullySigned: false };
  },

  /**
   * Cancela um aditivo em rascunho ou enviado
   */
  async cancelAddendum(addendumId: string): Promise<void> {
    const { error } = await supabase
      .from("contract_addendums")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", addendumId);

    if (error) throw error;
  },
};
