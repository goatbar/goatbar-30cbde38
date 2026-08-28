const fs = require('fs');

const path = 'src/routes/eventos.$eventoId.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = s;

s = s.replace(
  'const provider = getSignatureProvider(contract.signature_provider || contract.provider);',
  'const provider = getSignatureProvider(contract.provider || undefined);'
);

s = s.replace(
  '      await eventBudgetService.updateEvent(evento.id, {',
  '      if (!evento) throw new Error("Evento não carregado.");\n      await eventBudgetService.updateEvent(evento.id, {'
);

s = s.replace(/value=\{draft\.evento_nome\}/g, 'value={draft.evento_nome || ""}');

s = s.replace(
  'eventName={evento.event_name || evento.client_name || "Evento"}',
  'eventName={evento?.event_name || evento?.client_name || "Evento"}'
);

s = s.replace(
  /new Blob\(\[pdfBytes\], \{ type: "application\/pdf" \}\)/g,
  'new Blob([new Uint8Array(pdfBytes).buffer], { type: "application/pdf" })'
);

if (s === before) {
  console.log(`no-op ${path}`);
} else {
  fs.writeFileSync(path, s, 'utf8');
  console.log(`updated ${path}`);
}

console.log('v5 fixes complete');
