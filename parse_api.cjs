const fs = require('fs');
let rawData = fs.readFileSync('api-1.json', 'utf8');
if (rawData.charCodeAt(0) === 0xFEFF) {
  rawData = rawData.slice(1);
}
const doc = JSON.parse(rawData);

let output = '';
for (const [path, methods] of Object.entries(doc.paths)) {
  for (const [method, details] of Object.entries(methods)) {
    output += `=== ${method.toUpperCase()} ${path} ===\n`;
    output += `Summary: ${details.summary || 'N/A'}\n`;
    output += `Description: ${details.description || 'N/A'}\n`;
    
    if (details.parameters && details.parameters.length > 0) {
      output += `Params: ${details.parameters.map(p => p.name || (p.$ref ? p.$ref.split('/').pop() : 'unnamed')).join(', ')}\n`;
    }

    if (details.requestBody && details.requestBody.content) {
      output += `Request Body:\n`;
      for (const [contentType, content] of Object.entries(details.requestBody.content)) {
        if (content.schema && content.schema.$ref) {
            output += `  - ${contentType} (Ref: ${content.schema.$ref})\n`;
        } else {
            output += `  - ${contentType}\n`;
        }
      }
    }
    
    if (details.responses) {
        output += `Responses:\n`;
        for (const [statusCode, res] of Object.entries(details.responses)) {
            if (res.$ref) {
                output += `  - ${statusCode} (Ref: ${res.$ref})\n`;
            } else if (res.content && res.content['application/json']) {
                const schema = res.content['application/json'].schema;
                if (schema && schema.$ref) {
                    output += `  - ${statusCode} JSON (Ref: ${schema.$ref})\n`;
                } else {
                    output += `  - ${statusCode} JSON (Inline)\n`;
                }
            } else {
                output += `  - ${statusCode}\n`;
            }
        }
    }

    output += '\n';
  }
}

fs.writeFileSync('api-summary.txt', output);
