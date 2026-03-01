const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Añadir canvas al login-screen (haciéndolo relative/hidden) y asegurar z-indices
html = html.replace('<div id="login-screen">', '<div id="login-screen" style="position:relative; overflow:hidden;">\\n            <canvas id="particles-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;"></canvas>');

html = html.replace('<div class="login-left">', '<div class="login-left" style="position:relative; z-index:1;">');

// 2. Agregar el script al final del body
const bodyEnd = '</body>';
const replacement = '    <script src="js/login-particles.js"></script>\\n</body>';
if (html.includes(bodyEnd) && !html.includes('login-particles.js')) {
    html = html.replace(bodyEnd, replacement);
}

fs.writeFileSync('index.html', html);
console.log('Injected successfully');
