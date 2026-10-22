// shop-dist.mjs — after `VITE_APP=shop vite build`: make dist/ the Shopping app (shop.stuparu.eu).
// Its manifest and icons (public/shop/) replace OpenClaw's at the root, and the page title changes.
// Run from the fork root: node tools/shop-dist.mjs
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

for (const f of readdirSync('dist/shop')) cpSync(`dist/shop/${f}`, `dist/${f}`);
rmSync('dist/shop', { recursive: true });
const html = readFileSync('dist/index.html', 'utf8')
  .replace(/<title>[^<]*<\/title>/, '<title>Shopping</title>')
  .replace(/<meta name="theme-color" content="[^"]*"/, '<meta name="theme-color" content="#ffffff"');
writeFileSync('dist/index.html', html);
console.log('dist/ is the Shopping app');
