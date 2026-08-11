const fs = require('fs');
const fpath = 'src/lib/mock-data.ts';
let text = fs.readFileSync(fpath, 'utf8');

// Detect and report what's broken
const brokenIdx = text.indexOf('desatualizexport function');
const garbageIdx = text.indexOf('}inksPorPessoa;');

console.log('Broken line found at char index:', brokenIdx);
console.log('Garbage found at char index:', garbageIdx);

if (brokenIdx < 0) {
  console.log('No broken line found - file may already be fixed');
  process.exit(0);
}

// Show context around broken area
console.log('Context (broken):', JSON.stringify(text.substring(brokenIdx - 30, brokenIdx + 120)));

// Find start of line with the broken content
const lineStart = text.lastIndexOf('\n', brokenIdx) + 1;
const lineEnd = text.indexOf('\n', brokenIdx);

console.log('Line range:', lineStart, 'to', lineEnd);
const brokenLine = text.substring(lineStart, lineEnd);
console.log('Broken line:', JSON.stringify(brokenLine));

// The broken line merges the comment with the function declaration
// We need to:
// 1. Replace broken line with proper comment + close the p11 object + close the array
// 2. The function 'export function calcularOrcamentoEvento...' declaration is missing from the file;
//    the function body follows immediately after

// Replacement: proper closing of the parametros array entry
const properReplacement = `    // @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)
    groupo: "Precificação",
  },
];

export function calcularOrcamentoEvento(evento: Evento, drinksList: Drink[] = drinks) {`;

// The broken line already has everything up to the }; of the p11 entry merged in.
// We need to see what comes right after the broken line in the function body
// Right after it should be 'if (!evento) return null;'

text = text.substring(0, lineStart) + properReplacement + text.substring(lineEnd);
console.log('Fix 1 applied');

// Fix 2: Remove garbage duplicate function body starting at '}inksPorPessoa;'
// The garbage section is: '}inksPorPessoa;\n  const qtdDrinksSelecionados...' all the way
// to the old closing '}' before 'export function vendasResumo'
const garbageStart = text.indexOf('}inksPorPessoa;');
if (garbageStart >= 0) {
  // Find where the garbage section ends: it's a duplicate function body that ends with '}'
  // right before 'export function vendasResumo'
  const vendasIdx = text.indexOf('\nexport function vendasResumo');
  // Find the last '}' before vendasResumo that closes the garbage function
  const garbageEnd = text.lastIndexOf('}', vendasIdx - 1);
  console.log('Garbage section: chars', garbageStart, 'to', garbageEnd);
  
  // Remove: from the start of '}inksPorPessoa;' line to the closing '}'
  // But we need to keep the newline before vendasResumo
  const garbageLineStart = text.lastIndexOf('\n', garbageStart);
  text = text.substring(0, garbageLineStart) + '\n' + text.substring(garbageEnd + 1);
  console.log('Fix 2 applied: removed garbage duplicate');
}

fs.writeFileSync(fpath, text, 'utf8');
console.log('File written successfully');
console.log('New length:', text.length);

// Verify
const lines = text.split('\n');
let ok = true;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('desatualizexport')) { console.log('ERROR: still broken at line', i+1); ok = false; }
  if (lines[i].includes('}inksPorPessoa')) { console.log('ERROR: still has garbage at line', i+1); ok = false; }
}
if (ok) console.log('Verification PASSED - file is clean');
