// Post-build (openclaw-pwa fork): give dist/sw.js a cache name derived from
// the build. The built index.html names every hashed asset, so its hash
// changes exactly when the shipped code changes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync('dist/index.html', 'utf8');
const version = createHash('sha256').update(html).digest('hex').slice(0, 10);
const sw = readFileSync('dist/sw.js', 'utf8');
if (!sw.includes('__BUILD_VERSION__')) throw new Error('dist/sw.js has no __BUILD_VERSION__ placeholder');
writeFileSync('dist/sw.js', sw.replaceAll('__BUILD_VERSION__', version));
console.log(`sw.js cache: pinchchat-${version}`);
