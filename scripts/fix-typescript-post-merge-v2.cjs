const fs = require('fs');

function replace(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(path, after, 'utf8');
    console.log(`updated ${path}`);
  } else {
    console.log(`no-op ${path}`);
  }
}

const legacy = /\s*\/\/ @ts-expect-error Erro legado pré-existente fora do escopo \(Tipagem de BD desatualizada\)\r?\n/g;

replace('src/routes/contratos.tsx', (s) => {
  s = s.replace(legacy, '\n');
  s = s.replace(
    '  type ContractTemplate,\n} from "@/services/contract-service";',
    '  type ContractTemplate,\n  type ContractSigner,\n  type Glassware,\n} from "@/services/contract-service";'
  );
  return s;
});

replace('src/lib/mock-data.ts', (s) => {
  if (!s.includes('  evento_nome?: string;')) {
    s = s.replace('  nome: string;\n  cliente: string;', '  nome: string;\n  evento_nome?: string;\n  cliente: string;');
  }
  s = s.replace(
    '  | "NOVO";',
    '  | "NOVO"\n  | "em_assinatura"\n  | "dados_solicitados";'
  );
  return s;
});

replace('src/services/contract-service.ts', (s) => {
  s = s.replace(legacy, '\n');
  s = s.replace(/\n\s*formatBrazilianDocumentWithLabel,/, '');
  s = s.replace(
    'const entryVal = currentBudget?.paid_value || currentBudget?.deposit_value || totalVal * 0.5;',
    'const entryVal = currentBudget?.paid_value || totalVal * 0.5;'
  );
  s = s.replace(
    'const rawDocument = clientData?.cpf_cnpj || clientNotes?.cpf_cnpj || evento.client_cpf_cnpj;',
    'const rawDocument = clientData?.cpf_cnpj || clientNotes?.cpf_cnpj || "";'
  );
  s = s.replace('const rgClient = clientData?.rg || clientNotes?.rg || "";', 'const rgClient = clientNotes?.rg || "";');
  s = s.replace('const whatsappClient = clientData?.whatsapp || clientData?.phone || evento.phone || "";', 'const whatsappClient = clientNotes?.whatsapp || clientData?.phone || evento.phone || "";');
  s = s.replace('const cepClient = clientData?.cep || clientNotes?.cep || "";', 'const cepClient = clientNotes?.cep || "";');
  s = s.replace('const cityClient = clientData?.city || clientNotes?.city || evento.city || "";', 'const cityClient = clientNotes?.city || evento.city || "";');
  s = s.replace('const stateClient = clientData?.state || clientNotes?.state || "";', 'const stateClient = clientNotes?.state || "";');
  s = s.replace('const meioPagamentoStr = currentBudget?.payment_channel || clientNotes?.payment_channel || "";', 'const meioPagamentoStr = currentBudget?.payment_method || clientNotes?.payment_channel || "";');
  return s;
});

replace('src/services/event-budget-service.ts', (s) => {
  s = s.replace(legacy, '\n');
  s = s.replace('.from("budget_versions")', '.from("event_budget_versions")');
  s = s.replace(
    '  payment_due_date?: string;\n  payment_percent_received?: number;',
    '  payment_due_date?: string;\n  payment_method?: string;\n  payment_percent_received?: number;'
  );
  s = s.replace(
    '.from("event_closings")\n        .insert(payload)',
    '.from("event_closings")\n        .insert({ ...payload, event_id: payload.event_id })'
  );
  s = s.replace(
    '  async createEvent(payload: Partial<Event>) {',
    '  async createEvent(payload: Partial<Event> & Pick<Event, "client_name" | "date" | "event_type" | "guests">) {'
  );
  s = s.replace(
    '.update({ ...payload, updated_at: new Date().toISOString() })',
    '.update({ ...payload, updated_at: new Date().toISOString() } as any)'
  );
  s = s.replace('(data[0] as BudgetVersion)', '(data[0] as unknown as BudgetVersion)');
  s = s.replace(/return data as BudgetVersion\[\];/g, 'return data as unknown as BudgetVersion[];');
  s = s.replace(/return data as BudgetVersion;/g, 'return data as unknown as BudgetVersion;');
  s = s.replace('.insert(budgetPayload)', '.insert(budgetPayload as any)');
  return s;
});

replace('src/services/financial-service.ts', (s) => {
  s = s.replace(legacy, '\n');
  s = s.replace(
    '  async createExpense(payload: Partial<FinancialExpense> & { items?: FinancialExpenseItem[] }) {',
    '  async createExpense(payload: Partial<FinancialExpense> & Pick<FinancialExpense, "category" | "description" | "date" | "modality" | "responsible" | "payment_method" | "status" | "classification"> & { items?: FinancialExpenseItem[] }) {'
  );
  s = s.replace('.insert(expensePayload)', '.insert(expensePayload as any)');
  s = s.replace('.update({ ...payload, updated_at: new Date().toISOString() })', '.update({ ...payload, updated_at: new Date().toISOString() } as any)');
  s = s.replace('matched.product.default_unit || unit', 'matched.product.unit || unit');
  return s;
});

replace('src/routes/eventos.$eventoId.tsx', (s) => {
  s = s.replace(legacy, '\n');
  s = s.replace(
    '  type ContractTemplate,\n} from "@/services/contract-service";',
    '  type ContractTemplate,\n  type ContractSigner,\n} from "@/services/contract-service";'
  );
  s = s.replace('contract.signature_provider || contract.provider', 'contract.provider');
  s = s.replace(/await eventBudgetService\.updateEvent\(evento\.id,/g, 'if (!evento) throw new Error("Evento não carregado.");\n      await eventBudgetService.updateEvent(evento.id,');
  s = s.replace(/eventName=\{evento\.event_name \|\| evento\.client_name \|\| "Evento"\}/g, 'eventName={evento?.event_name || evento?.client_name || "Evento"}');
  s = s.replace(/new Blob\(\[pdfBytes\], \{ type: "application\/pdf" \}\)/g, 'new Blob([new Uint8Array(pdfBytes).buffer], { type: "application/pdf" })');
  return s;
});
