const fs = require('fs');

function edit(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(path, after, 'utf8');
    console.log(`updated ${path}`);
  } else {
    console.log(`no-op ${path}`);
  }
}

edit('src/components/InternalProposalPreviewModal.tsx', (s) =>
  s.replace('from "@/components/ui/button-custom"', 'from "@/components/ui-bits"')
);

edit('src/lib/proposal-field-resolver.ts', (s) => {
  s = s.replace(
    'historicalContext.event.client_name?.trim()',
    '(typeof historicalContext.event.client_name === "string" ? historicalContext.event.client_name.trim() : "")'
  );
  s = s.replace(
    'historicalContext.event.event_name?.trim()',
    '(typeof historicalContext.event.event_name === "string" ? historicalContext.event.event_name.trim() : "")'
  );
  s = s.replace(
    'tipoEvento: eventType,',
    'tipoEvento: typeof eventType === "string" ? eventType : String(eventType ?? ""),'
  );
  s = s.replace(
    'horarioEvento: eventTime,',
    'horarioEvento: typeof eventTime === "string" ? eventTime : null,'
  );
  return s;
});

edit('src/routes/contratos.tsx', (s) => {
  if (!s.includes('type ContractSigner')) {
    s = s.replace(
      /type ContractTemplate,\s*\n}/,
      'type ContractTemplate,\n  type ContractSigner,\n  type Glassware,\n}'
    );
  }
  return s;
});

edit('src/routes/controladoria.tsx', (s) => s);

edit('src/lib/mock-data.ts', (s) => {
  const eventoStart = s.indexOf('export interface Evento {');
  if (eventoStart >= 0) {
    const tail = s.slice(eventoStart);
    if (!/^\s*evento_nome\?: string;/m.test(tail.slice(0, 500))) {
      s = s.slice(0, eventoStart) + tail.replace(/(export interface Evento \{\r?\n\s*id: string;\r?\n\s*nome: string;)/, '$1\n  evento_nome?: string;');
    }
  }
  return s;
});

edit('src/services/event-budget-service.ts', (s) => {
  if (!/payment_method\?: string;/.test(s.slice(0, 1800))) {
    s = s.replace(/(payment_due_date\?: string;\r?\n)/, '$1  payment_method?: string;\n');
  }
  s = s.replace(
    /\.from\("event_closings"\)\s*\n\s*\.insert\(payload\)/g,
    '.from("event_closings")\n        .insert({ ...payload, event_id: payload.event_id! } as any)'
  );
  s = s.replace(
    /supabase\.from\("events"\)\.insert\(payload\)/g,
    'supabase.from("events").insert(payload as any)'
  );
  return s;
});

edit('src/services/financial-service.ts', (s) => {
  s = s.replace(
    /async createExpense\(payload: Partial<FinancialExpense> & Pick<FinancialExpense, [^\n]+> & \{ items\?: FinancialExpenseItem\[\] \}\)/,
    'async createExpense(payload: Partial<FinancialExpense> & { items?: FinancialExpenseItem[] })'
  );
  return s;
});

edit('src/routes/eventos.$eventoId.tsx', (s) => {
  if (!s.includes('type ContractSigner')) {
    s = s.replace(
      /type ContractTemplate,\s*\n}/,
      'type ContractTemplate,\n  type ContractSigner,\n}'
    );
  }
  s = s.replace('getSignatureProvider(contract.provider)', 'getSignatureProvider(contract.provider ?? undefined)');
  return s;
});

console.log('v3 fixes complete');
