const fs = require('fs');
const window = {}; // mock window
const code = fs.readFileSync('js/23b-prospectos-pdf.js', 'utf8');
eval(code);

console.log('typeof window.pdfHTMLPropuesta:', typeof window.pdfHTMLPropuesta);
console.log('typeof window.pdfHTMLInforme:', typeof window.pdfHTMLInforme);

if (typeof window.pdfHTMLPropuesta !== 'function' || typeof window.pdfHTMLInforme !== 'function') {
    process.exit(1);
}
