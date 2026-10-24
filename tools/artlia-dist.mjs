// artlia-dist.mjs — after `VITE_APP=artlia vite build`: make dist/ the Casa Artlia app
// (artlia.stuparu.eu). Its manifest and icons (public/artlia/) replace OpenClaw's at the root, the
// other apps' folders go, and the page title and language change.
// Run from the fork root: node tools/artlia-dist.mjs
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

for (const f of readdirSync('dist/artlia')) cpSync(`dist/artlia/${f}`, `dist/${f}`);
cpSync('dist/logo-512.png', 'dist/logo.png');   // the login screen's picture
for (const d of ['artlia', 'shop', 'shortcuts']) rmSync(`dist/${d}`, { recursive: true, force: true });
const html = readFileSync('dist/index.html', 'utf8')
  .replace(/<html lang="[^"]*"/, '<html lang="ro"')
  .replace(/<title>[^<]*<\/title>/, '<title>Casa Artlia</title>')
  .replace(/<meta name="theme-color" content="[^"]*"/, '<meta name="theme-color" content="#ffffff"');
writeFileSync('dist/index.html', html);
console.log('dist/ is the Casa Artlia app');
