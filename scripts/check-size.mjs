import fs from 'fs';
const stats = fs.statSync('Proposta limpa/Cópia de Proposta Comercial - Sidney & Lúcia.pdf');
console.log('Size:', (stats.size / 1024).toFixed(1), 'KB');
