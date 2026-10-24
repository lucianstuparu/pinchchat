// stamp-icons.mjs — after the build (and the shop/artlia dist step): give every file whose name
// never changes (the manifest, the icons) a fingerprint in its address, `?v=<hash of the file>`.
// Cloudflare's edge and the phones cache those files by address; without this a new icon kept
// showing the old one for days (chat.stuparu.eu still served the PinchChat lobster, 2026-10-24).
// Also writes <meta name="app-logo"> for the screens that show the app's own icon.
// Run from the fork root: node tools/stamp-icons.mjs
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// VITE_BASE: the path the app is served under (the WhatsApp app at /wa/ for now); relative paths stay relative.
const base = process.env.VITE_BASE || '/';
const v = (file) => createHash('sha256').update(readFileSync(`dist/${file}`)).digest('hex').slice(0, 10);
const stamp = (path) => {
  const rel = !path.startsWith('/');
  const file = (path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '')).replace(/\?.*$/, '');
  return existsSync(`dist/${file}`) ? `${rel ? '' : base}${file}?v=${v(file)}` : path;
};
const esc = base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
for (const icon of manifest.icons ?? []) icon.src = stamp(icon.src);
for (const s of manifest.shortcuts ?? []) for (const icon of s.icons ?? []) icon.src = stamp(icon.src);
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

let html = readFileSync('dist/index.html', 'utf8');
html = html.replace(new RegExp(`(href|src)="(${esc}(?:manifest\\.json|favicon-\\d+\\.png|apple-touch-icon\\.png|logo[^"]*\\.png))"`, 'g'), (_, attr, path) => `${attr}="${stamp(path)}"`);
const logo = stamp(`${base}logo-192.png`);
html = html.replace(/<meta name="app-logo"[^>]*>\s*/g, '').replace('</head>', `  <meta name="app-logo" content="${logo}" />\n  </head>`);
writeFileSync('dist/index.html', html);
console.log(`icons stamped (manifest ${v('manifest.json')}, logo ${logo})`);
