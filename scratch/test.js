const fs = require('fs');

const cx = 100;
const cy = 100;
const radius = 50;
const startDeg = 160;
const endDeg = 20;

const startRad = (startDeg * Math.PI) / 180;
const endRad = (endDeg * Math.PI) / 180;

const x1 = cx + radius * Math.cos(startRad);
const y1 = cy + radius * Math.sin(startRad);
const x2 = cx + radius * Math.cos(endRad);
const y2 = cy + radius * Math.sin(endRad);

const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
const sweep = 0; // counter-clockwise

const svg = `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <path id="arc" d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}" fill="none" stroke="black" />
  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="red" stroke-dasharray="4 4" />
  <text>
    <textPath href="#arc" startOffset="50%" textAnchor="middle">Data do Evento</textPath>
  </text>
</svg>
`;

fs.writeFileSync('test.svg', svg);
console.log('SVG generated');
