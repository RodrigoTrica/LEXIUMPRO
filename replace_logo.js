const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// The specific regex for the double-white-lines logo
const regex = /<img[^>]*src="data:image\/png;base64,iVBORw0KGgo[^>]*>/g;

if (regex.test(html)) {
    html = html.replace(regex, '<img src="assets/logo-lexium.png" alt="LEXIUM" style="width:48px; height:48px; border-radius:12px;">');
    fs.writeFileSync('index.html', html);
    console.log('Replaced successfully');
} else {
    console.log('No remaining base64 logos found');
}
