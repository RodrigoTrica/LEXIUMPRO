const sharp = require('sharp');
sharp('assets/logo-lexium.png')
    .resize(256, 256)
    .toFile('assets/logo-lexium.ico')
    .then(() => console.log('Icon creation successful'))
    .catch(err => console.error('Error creating icon:', err));
