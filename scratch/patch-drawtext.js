const fs = require('fs');
const path = 'c:/Goatbar-system/src/services/proposal-service.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace all instances of something.drawText(TEXT, {
// With something.drawText(sanitizeText(String(TEXT)), {
// Using regex

let updated = code.replace(/(\w+)\.drawText\(([^,]+),\s*\{/g, (match, pageVar, textArg) => {
    // If it's already sanitized, don't wrap again
    if (textArg.includes('sanitizeText')) {
        return match;
    }
    return `${pageVar}.drawText(sanitizeText(String(${textArg})), {`;
});

fs.writeFileSync(path, updated);
console.log('Patched drawText occurrences.');
