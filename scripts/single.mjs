// Baut eine Einzeldatei (HTML mit eingebettetem CSS/JS) nach demo/samichlaus-hotline.html,
// zum Testen auf dem Handy oder ohne Server. Vorher: npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const dist = 'dist/';
let html = readFileSync(dist + 'index.html', 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+)"[^>]*>/g, (_, f) => `<style>${readFileSync(dist + f, 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"[^>]*><\/script>/g, (_, f) => `<script type="module">${readFileSync(dist + f, 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`);
mkdirSync('demo', { recursive: true });
writeFileSync('demo/samichlaus-hotline.html', html);
console.log(`demo/samichlaus-hotline.html (${Math.round(html.length / 1024)} KB)`);
