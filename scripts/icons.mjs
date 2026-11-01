// Génère les icônes PNG (iOS ignore le SVG) depuis assets/icons/icon.svg.
// Usage ponctuel : `npm run icons` (nécessite `sharp`, installé globalement ou en local). Les PNG sont commités.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = require(`${execSync('npm root -g').toString().trim()}/sharp`);
}

const root = new URL('..', import.meta.url);
const svg = readFileSync(new URL('assets/icons/icon.svg', root));
const out = (name) => new URL(`assets/${name}`, root).pathname;

async function png(size, name, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const img = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#160a2b' } })
    .composite([{ input: img, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(out(name));
  console.log('✔', name);
}

await png(180, 'apple-touch-icon.png');
await png(192, 'icons/icon-192.png');
await png(512, 'icons/icon-512.png');
// Maskable : contenu dans la zone sûre (80 %) pour les masques ronds d'Android.
await png(192, 'icons/maskable-192.png', { padding: 0.1 });
await png(512, 'icons/maskable-512.png', { padding: 0.1 });
await png(32, 'icons/favicon-32.png');
