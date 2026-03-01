const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const regex = /<img src="data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAANwAAAA8[^>]*>/g;

if (regex.test(html)) {
    html = html.replace(regex, '<img src="assets/logo-lexium.png" alt="LEXIUM" style="width:48px; height:48px; border-radius:12px;">');
    fs.writeFileSync('index.html', html);
    console.log('Fixed successfully');
} else {
    console.log('Not found');
}
