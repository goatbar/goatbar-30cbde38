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

/** Modelo Oficial do Termo Aditivo ao Contrato */
export function buildAddendumTemplateHtml(vars: Record<string, string>): string {
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

<h3 style="font-size: 14px; font-weight: bold; margin-top: 16px; margin-bottom: 6px;">
  CLÁUSULA PRIMEIRA — DOS DRINKS E BEBIDAS
</h3>
<p style="text-align: justify; margin-bottom: 12px;">
  1.1. As partes acordam que os drinks e bebidas que serão servidos no evento passam a vigorar com a seguinte redação final:<br />
  <em>“${vars.drinks_atuais || ""}”</em>
</p>

<h3 style="font-size: 14px; font-weight: bold; margin-top: 16px; margin-bottom: 6px;">
  CLÁUSULA SEGUNDA — DO VALOR E FORMA DE PAGAMENTO
</h3>
<p style="text-align: justify; margin-bottom: 8px;">
  2.1. O valor total do contrato passa a ser de <strong>${vars.novo_valor_total || ""}</strong> (${vars.novo_valor_total_extenso || ""}).
</p>

<p style="text-align: justify; margin-bottom: 8px;">
  2.2. O CONTRATANTE já efetuou o pagamento do montante de <strong>${vars.valor_ja_pago || "R$ 0,00"}</strong>, restando o saldo remanescente de <strong>${vars.saldo_restante || "R$ 0,00"}</strong>.
</p>

<p style="text-align: justify; margin-bottom: 12px;">
  2.3. O pagamento do saldo remanescente será efetuado da seguinte forma: <strong>${vars.forma_pagamento_saldo || ""}</strong>, com vencimento em <strong>${vars.datas_vencimento || ""}</strong>.
</p>

<h3 style="font-size: 14px; font-weight: bold; margin-top: 16px; margin-bottom: 6px;">
  CLÁUSULA TERCEIRA — DO CONVIDADO EXCEDENTE
</h3>
<p style="text-align: justify; margin-bottom: 12px;">
  3.1. O valor por convidado excedente passa a ser de <strong>${vars.valor_convidado_excedente || ""}</strong> (${vars.valor_convidado_excedente_extenso || ""}).
</p>

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
        comparison.financial.paidAmount,
      ),
      saldo_restante: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(comparison.financial.remainingBalance),
      forma_pagamento_saldo: comparison.financial.paymentMethod,
      datas_vencimento: comparison.financial.dueDate,
      valor_convidado_excedente: comparison.extraGuestValue.currentFormatted,
      valor_convidado_excedente_extenso: comparison.extraGuestValue.currentWords,
      cidade_assinatura: evento?.city || "São Paulo/SP",
      data_aditivo: new Date().toLocaleDateString("pt-BR"),
    };

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
    overridePaymentMethod?: string;
    overrideDueDate?: string;
  }): Promise<ContractAddendumRow> {
    const { active, activeAddendum } = await this.hasActiveAddendum(params.contractId);
    if (active && activeAddendum) {
      throw new Error(
        `Já existe o Aditivo nº ${activeAddendum.addendum_number} pendente de assinatura (${activeAddendum.status}). Conclua ou cancele o aditivo existente antes de gerar um novo.`,
      );
    }

    const data = await this.prepareAddendumData(params.contractId, params.eventId);

    if (data.comparison.financial.hasExcessPaymentCredit) {
      throw new Error(
        `O novo valor contratual (${data.comparison.totalValue.currentFormatted}) é inferior ao valor já pago (${new Intl.NumberFormat(
          "pt-BR",
          { style: "currency", currency: "BRL" },
        ).format(
          data.comparison.financial.paidAmount,
        )}). É necessária definição da regra de crédito/devolução antes da geração do aditivo.`,
      );
    }

    if (!data.comparison.requiresAddendum) {
      throw new Error(
        "A versão atual da proposta não possui alterações contratuais relevantes para gerar um Termo Aditivo.",
      );
    }

    // Aplica overrides de pagamento se informados na UI
    if (params.overridePaymentMethod) {
      data.templateVars.forma_pagamento_saldo = params.overridePaymentMethod;
    }
    if (params.overrideDueDate) {
      data.templateVars.datas_vencimento = params.overrideDueDate;
    }

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
      payment_method: data.templateVars.forma_pagamento_saldo,
      due_dates: data.templateVars.datas_vencimento,
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
