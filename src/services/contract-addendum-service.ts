import { supabase } from "@/integrations/supabase/client";
import {
  compareContractVersions,
  ContractAddendumComparison,
  BudgetVersionData,
} from "@/lib/contract-addendum-comparator";
import {
  eventContractsService,
  getTemplateContent,
  getTemplateMapping,
  renderContractPreview,
  renderContractTemplate,
  type ContractTemplate,
} from "@/services/contract-service";
import { calculateFinalPaymentDate } from "@/lib/date-utils";

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
  status: "draft" | "sent" | "signed" | "rejected" | "cancelled";
  template_id?: string | null;
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

const fmtBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatDateLongPtBR = (value: Date) => {
  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${value.getDate()} de ${months[value.getMonth()]} de ${value.getFullYear()}`;
};

function isAddendumTemplate(template: ContractTemplate): boolean {
  const schema = template.variables_schema as any;
  return Boolean(
    schema &&
      typeof schema === "object" &&
      !Array.isArray(schema) &&
      (schema.template_kind === "addendum" ||
        schema.model_key === "goatbar-official-addendum-v1"),
  );
}

async function getOfficialAddendumTemplate(): Promise<ContractTemplate> {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const template = ((data || []) as ContractTemplate[]).find(isAddendumTemplate);
  if (!template) throw new Error("ADDENDUM_TEMPLATE_NOT_CONFIGURED");
  return template;
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
      .select("id, event_id, budget_version_id, created_at, generated_at")
      .eq("id", contractId)
      .single();

    if (!contract) throw new Error("Contrato não encontrado.");

    // Alguns contratos legados receberam, posteriormente, o budget_version_id da
    // proposta que estava vigente no momento da migração/upload. Isso pode apontar
    // para uma proposta criada DEPOIS do próprio contrato, o que é impossível como
    // origem contratual. Nesses casos, corrige a proveniência pela última versão que
    // já existia quando o contrato foi gerado/criado.
    if (contract.budget_version_id) {
      const { data: linkedBudget } = await supabase
        .from("event_budget_versions")
        .select("id, created_at")
        .eq("id", contract.budget_version_id)
        .maybeSingle();

      const contractAnchor = contract.generated_at || contract.created_at;
      const linkedCreatedAt = linkedBudget?.created_at;

      if (
        contractAnchor &&
        linkedCreatedAt &&
        new Date(linkedCreatedAt).getTime() > new Date(contractAnchor).getTime()
      ) {
        const { data: historicalVersions } = await supabase
          .from("event_budget_versions")
          .select("id, version_number, final_budget_value, created_at")
          .eq("event_id", contract.event_id)
          .lte("created_at", contractAnchor)
          .order("created_at", { ascending: false })
          .limit(1);

        const historical = historicalVersions?.[0];
        if (historical?.id) {
          const { error: repairError } = await supabase
            .from("event_contracts")
            .update({ budget_version_id: historical.id, updated_at: new Date().toISOString() })
            .eq("id", contractId);
          if (repairError) throw repairError;

          return { budgetVersionId: historical.id, autoResolved: true };
        }

        const err = new Error("LEGACY_CONTRACT_REQUIRES_MANUAL_SELECTION") as any;
        err.versions = [];
        throw err;
      }

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
    // 1. Valida contrato e resolve a data jurídica do documento assinado.
    const { data: contract } = await (supabase as any)
      .from("event_contracts")
      .select("*, contract_signers(*)")
      .eq("id", contractId)
      .single();

    if (!contract) throw new Error("Contrato não encontrado.");
    if (contract.status !== "signed") {
      throw new Error("CONTRACT_NOT_FULLY_SIGNED");
    }

    const { data: signedDocument } = await (supabase as any)
      .from("contract_documents")
      .select("signed_at, manual_signature_date, document_type, created_at")
      .eq("contract_id", contractId)
      .in("document_type", ["signed_contract", "manual_signed_contract"])
      .eq("is_signed", true)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const originalContractDate =
      signedDocument?.manual_signature_date ||
      signedDocument?.signed_at ||
      contract.fully_signed_at;

    if (!originalContractDate) {
      throw new Error("PENDING_ORIGINAL_SIGNATURE_DATE");
    }

    // 2. Resolve a versão contratual vigente (último aditivo assinado ou contrato original).
    const effective = await this.getEffectiveBudgetVersion(contractId, eventId);
    const baseVersion: BudgetVersionData = effective.budgetVersion;

    // 3. Busca a proposta atual.
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

    // 4. Hidrata os IDs dos drinks com os nomes canônicos do catálogo e compara
    // exatamente a carta de drinks salva em selected_drinks. O campo beverages
    // representa bebidas/insumos-base e não deve ser confundido com os coquetéis.
    const collectDrinkIds = (version: BudgetVersionData): string[] => {
      const raw = version.selected_drinks as any;
      if (Array.isArray(raw)) {
        return raw.filter((value): value is string => typeof value === "string");
      }
      if (raw && typeof raw === "object") {
        if (Array.isArray(raw.ids)) {
          return raw.ids.filter((value: unknown): value is string => typeof value === "string");
        }
        if (Array.isArray(raw.items)) {
          return raw.items
            .map((item: any) => item?.drink_id || item?.id)
            .filter((value: unknown): value is string => typeof value === "string");
        }
      }
      return [];
    };

    const drinkIds = Array.from(
      new Set([...collectDrinkIds(baseVersion), ...collectDrinkIds(updatedVersion)]),
    );
    let drinkNameById: Record<string, string> = {};
    if (drinkIds.length > 0) {
      const { data: drinkRows, error: drinksError } = await supabase
        .from("drinks")
        .select("id, nome")
        .in("id", drinkIds);

      if (drinksError) {
        console.warn("Não foi possível hidratar nomes de drinks para o aditivo:", drinksError);
      } else {
        drinkNameById = Object.fromEntries(
          (drinkRows || [])
            .filter((drink: any) => drink?.id && drink?.nome)
            .map((drink: any) => [drink.id, drink.nome]),
        );
      }
    }

    const comparison = compareContractVersions(
      baseVersion,
      updatedVersion,
      drinkNameById,
    );

    const [{ data: clientData }, { data: evento }] = await Promise.all([
      supabase
        .from("event_contract_client_data")
        .select("*")
        .eq("event_id", eventId)
        .maybeSingle(),
      (supabase as any)
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single(),
    ]);

    // Valor pago é monetário e histórico. Prioriza o valor canônico do evento,
    // que não é recalculado quando o valor total da proposta muda.
    const canonicalPaidAmount =
      evento?.paid_amount_received !== null && evento?.paid_amount_received !== undefined
        ? Number(evento.paid_amount_received)
        : comparison.financial.paidAmount;

    comparison.financial.paidAmount = canonicalPaidAmount;
    comparison.valor_ja_pago = canonicalPaidAmount;
    comparison.financial.remainingBalance =
      canonicalPaidAmount === null ? null : Math.max(comparison.totalValue.current - canonicalPaidAmount, 0);
    comparison.novo_saldo_restante = comparison.financial.remainingBalance;
    comparison.financial.previousBalance =
      canonicalPaidAmount === null ? null : Math.max(comparison.totalValue.previous - canonicalPaidAmount, 0);
    comparison.saldo_anterior = comparison.financial.previousBalance;
    comparison.financial.creditAmount =
      canonicalPaidAmount === null ? 0 : Math.max(canonicalPaidAmount - comparison.totalValue.current, 0);
    comparison.financial.hasExcessPaymentCredit = comparison.financial.creditAmount > 0;
    comparison.credito_cliente =
      canonicalPaidAmount === null ? null : comparison.financial.creditAmount;

    // 5. Partes: snapshot jurídico do contrato original é a fonte prioritária.
    // Para contratos legados sem snapshot, recompila as variáveis do contrato e sinaliza a origem.
    const legalSnapshot = (contract.legal_snapshot || null) as any;
    let historicalSource: "legal_snapshot" | "legacy_contract_variables" = "legal_snapshot";
    let contractVariables: Record<string, string> | null = null;

    if (!legalSnapshot) {
      historicalSource = "legacy_contract_variables";
      contractVariables = await eventContractsService.compileContractVariables(
        eventId,
        contract.signer_id || undefined,
      );
    }

    // A data final de pagamento do saldo do aditivo é SEMPRE a mesma
    // prevista no contrato original. Não é uma condição renegociável do aditivo.
    // Prioriza o snapshot jurídico imutável; para contratos legados, usa as
    // variáveis recompiladas e, por último, a regra canônica de 7 dias antes do evento.
    const originalFinalPaymentDate =
      String(
        legalSnapshot?.financeiro?.data_vencimento ||
          contractVariables?.["financeiro.data_vencimento"] ||
          calculateFinalPaymentDate(evento?.date) ||
          "",
      ).trim();

    comparison.financial.dueDate = originalFinalPaymentDate;
    comparison.financial.dueDates = originalFinalPaymentDate
      ? [originalFinalPaymentDate]
      : [];
    comparison.datas_vencimento = comparison.financial.dueDates;

    const contratanteNome =
      legalSnapshot?.cliente?.nome ||
      contractVariables?.["cliente.nome"] ||
      clientData?.client_name ||
      evento?.client_name ||
      "";
    const contratanteDoc =
      legalSnapshot?.cliente?.documento ||
      contractVariables?.["cliente.documento"] ||
      clientData?.cpf_cnpj ||
      (clientData?.notes as any)?.cpf_cnpj ||
      "";
    const contratadaNome =
      legalSnapshot?.empresa?.nome ||
      contractVariables?.["empresa.nome"] ||
      "";
    const contratadaDoc =
      legalSnapshot?.empresa?.cnpj ||
      contractVariables?.["empresa.cnpj"] ||
      "";

    if (!contratanteNome || !contratanteDoc || !contratadaNome || !contratadaDoc) {
      throw new Error("ADDENDUM_LEGAL_PARTIES_INCOMPLETE");
    }

    const signedAt = new Date(originalContractDate);
    const now = new Date();
    const templateVars: Record<string, string> = {
      "cliente.nome": contratanteNome,
      "cliente.documento": contratanteDoc,
      "empresa.nome": contratadaNome,
      "empresa.cnpj": contratadaDoc,
      "contrato.data_assinatura_original": signedAt.toLocaleDateString("pt-BR"),
      "aditivo.drinks_atuais": comparison.drinks.finalListText,
      "aditivo.valor_total_novo": comparison.totalValue.currentFormatted,
      "aditivo.valor_total_novo_extenso": comparison.totalValue.currentWords,
      "aditivo.valor_ja_pago":
        canonicalPaidAmount === null ? "" : fmtBRL(canonicalPaidAmount),
      "aditivo.novo_saldo_restante":
        comparison.financial.remainingBalance === null
          ? ""
          : fmtBRL(comparison.financial.remainingBalance),
      "aditivo.forma_pagamento_saldo": comparison.financial.paymentCondition || "",
      "aditivo.meio_pagamento_saldo": comparison.financial.paymentMethod || "",
      "aditivo.datas_vencimento": comparison.financial.dueDate,
      "aditivo.valor_convidado_excedente": comparison.extraGuestValue.currentFormatted,
      "aditivo.valor_convidado_excedente_extenso": comparison.extraGuestValue.currentWords,
      "aditivo.data_extenso": formatDateLongPtBR(now),

      // aliases preservados para compatibilidade com registros antigos.
      contratante_nome: contratanteNome,
      contratante_documento: contratanteDoc,
      contratada_nome: contratadaNome,
      contratada_documento: contratadaDoc,
      data_contrato_original: signedAt.toLocaleDateString("pt-BR"),
      drinks_atuais: comparison.drinks.finalListText,
      novo_valor_total: comparison.totalValue.currentFormatted,
      novo_valor_total_extenso: comparison.totalValue.currentWords,
      valor_ja_pago: canonicalPaidAmount === null ? "" : fmtBRL(canonicalPaidAmount),
      saldo_restante:
        comparison.financial.remainingBalance === null
          ? ""
          : fmtBRL(comparison.financial.remainingBalance),
      forma_pagamento_saldo: comparison.financial.paymentCondition || "",
      meio_pagamento_saldo: comparison.financial.paymentMethod || "",
      datas_vencimento: comparison.financial.dueDate,
      valor_convidado_excedente: comparison.extraGuestValue.currentFormatted,
      valor_convidado_excedente_extenso: comparison.extraGuestValue.currentWords,
    };

    const addendumTemplate = await getOfficialAddendumTemplate();
    const templateContent = getTemplateContent(addendumTemplate);
    const mapping = getTemplateMapping(addendumTemplate);
    const compiledHtml = renderContractPreview(templateContent, templateVars, mapping);

    return {
      contract,
      baseVersion,
      updatedVersion,
      comparison,
      templateVars,
      compiledHtml,
      template: addendumTemplate,
      historicalSource,
      originalContractDate,
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
    const hasRemainingBalance = (data.comparison.novo_saldo_restante || 0) > 0;
    const condition = hasRemainingBalance
      ? params.paymentCondition || data.comparison.forma_pagamento_saldo
      : "Não se aplica";
    const method = hasRemainingBalance
      ? params.paymentMethod || data.comparison.meio_pagamento_saldo
      : "Não se aplica";
    // A data de vencimento final não pode ser alterada pelo aditivo:
    // deve permanecer exatamente a mesma do contrato original.
    const dueDates = hasRemainingBalance
      ? data.comparison.datas_vencimento.filter(Boolean)
      : ["Não se aplica"];
    if (hasRemainingBalance && (!condition || !method || !dueDates.length))
      throw new Error("PENDING_BALANCE_PAYMENT_TERMS");
    data.templateVars["aditivo.forma_pagamento_saldo"] = condition || "";
    data.templateVars["aditivo.meio_pagamento_saldo"] = method || "";
    data.templateVars["aditivo.datas_vencimento"] = dueDates.join(" e ");
    data.templateVars.forma_pagamento_saldo = condition || "";
    data.templateVars.meio_pagamento_saldo = method || "";
    data.templateVars.datas_vencimento = dueDates.join(" e ");

    const finalHtml = renderContractTemplate(
      getTemplateContent(data.template),
      data.templateVars,
      getTemplateMapping(data.template),
    );

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
        template_id: data.template.id,
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
      } as any)
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
        documentKind: "addendum",
        addendumId: addendum.id,
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
