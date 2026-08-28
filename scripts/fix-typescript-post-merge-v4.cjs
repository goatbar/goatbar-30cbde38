const fs = require('fs');

const path = 'src/routes/eventos.$eventoId.tsx';
const marker = '// @ts-expect-error Erro legado pré-existente fora do escopo (Tipagem de BD desatualizada)';

const before = fs.readFileSync(path, 'utf8');
const count = before.split(marker).length - 1;
const after = before.split(marker).join('');

if (count === 0) {
  console.log('no obsolete suppressions found');
} else {
  fs.writeFileSync(path, after, 'utf8');
  console.log(`removed ${count} obsolete @ts-expect-error directives from ${path}`);
}

console.log('v4 fixes complete');
