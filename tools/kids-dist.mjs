// kids-dist.mjs — after `VITE_APP=kids vite build`: make dist/ the kids app
// (kids.stuparu.eu). Its manifest and icons (public/kids/) replace OpenClaw's at the root, the
// other apps' folders go, and the page title and language change.
// Run from the fork root: node tools/kids-dist.mjs
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

for (const f of readdirSync('dist/kids')) cpSync(`dist/kids/${f}`, `dist/${f}`);
cpSync('dist/logo-512.png', 'dist/logo.png');   // the login screen's picture
for (const d of ['kids', 'artlia', 'shop', 'shortcuts']) rmSync(`dist/${d}`, { recursive: true, force: true });
const html = readFileSync('dist/index.html', 'utf8')
  .replace(/<html lang="[^"]*"/, '<html lang="ro"')
  .replace(/<title>[^<]*<\/title>/, '<title>Kids</title>')
  .replace(/<meta name="theme-color" content="[^"]*"/, '<meta name="theme-color" content="#ffffff"');
writeFileSync('dist/index.html', html);
console.log('dist/ is the kids app');
