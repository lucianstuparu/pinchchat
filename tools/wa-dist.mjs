// wa-dist.mjs — after `VITE_APP=wa VITE_BASE=/wa/ vite build`: make dist/ the WhatsApp app (Relay).
// Its manifest, icons and service worker (public/wa/) replace OpenClaw's at the root of dist (which
// is served at the base path), the other apps' folders go, and the page head changes.
// Run from the fork root: node tools/wa-dist.mjs
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const base = process.env.VITE_BASE || '/';
for (const f of readdirSync('dist/wa')) cpSync(`dist/wa/${f}`, `dist/${f}`);
cpSync('dist/logo-512.png', 'dist/logo.png');
for (const d of ['wa', 'artlia', 'shop', 'shortcuts']) rmSync(`dist/${d}`, { recursive: true, force: true });
for (const f of ['og-card.png', 'screenshot.png', 'vite.svg']) rmSync(`dist/${f}`, { force: true });
const version = `${Date.now()}`;
writeFileSync('dist/sw.js', readFileSync('dist/sw.js', 'utf8').replace(/__SW_VERSION__/g, version));
let html = readFileSync('dist/index.html', 'utf8')
  .replace(/<html lang="[^"]*"/, '<html lang="en"')
  .replace(/<title>[^<]*<\/title>/, '<title>Relay</title>')
  .replace(/<meta name="theme-color" content="[^"]*"/, '<meta name="theme-color" content="#052e16"');
// Head links that point at the root (manifest, icons) point at the app's own copies.
html = html.replace(/(href|content)="\/(manifest\.json|favicon-16\.png|favicon-32\.png|apple-touch-icon\.png|logo-192\.png|logo\.png)"/g, `$1="${base}$2"`);
if (!/name="app-logo"/.test(html)) html = html.replace('</head>', `  <meta name="app-logo" content="${base}logo-192.png" />\n  </head>`);
writeFileSync('dist/index.html', html);
console.log(`dist/ is Relay (base ${base}, sw ${version})`);
