const fs = require('fs');

function edit(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  fs.writeFileSync(path, after, 'utf8');
  console.log(`updated ${path}`);
}

const legacy = /\s*\/\/ @ts-expect-error Erro legado pré-existente fora do escopo \(Tipagem de BD desatualizada\)\r?\n/g;

edit('src/services/event-budget-service.ts', (s) => {
  s = s.replace(legacy, '\n');
  s = s.replace('.from("budget_versions")', '.from("event_budget_versions")');
  s = s.replace('.insert(payload)\n        .select()\n        .single();', '.insert({ ...payload, event_id: payload.event_id })\n        .select()\n        .single();');
  return s;
});

edit('src/routes/contratos.tsx', (s) => s.replace(legacy, '\n'));
edit('src/services/contract-service.ts', (s) => s.replace(legacy, '\n'));
edit('src/services/financial-service.ts', (s) => s.replace(legacy, '\n'));
edit('src/routes/eventos.$eventoId.tsx', (s) => s.replace(legacy, '\n'));
edit('src/lib/mock-data.ts', (s) => {
  if (!s.includes('evento_nome?: string;')) {
    s = s.replace('  nome: string;\n  cliente: string;', '  nome: string;\n  evento_nome?: string;\n  cliente: string;');
  }
  return s;
});
