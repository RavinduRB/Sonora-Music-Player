const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'www');
const files = ['index.html', 'styles.css', 'app.js', 'icon.svg'];

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(webDir, file));
}
