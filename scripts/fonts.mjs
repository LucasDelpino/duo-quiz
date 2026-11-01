// Copie les polices woff2 (sous-ensemble latin) depuis les paquets @fontsource vers assets/fonts/.
// Les fichiers copiés sont commités : aucune police n'est chargée depuis un CDN.
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const out = fileURLToPath(new URL('assets/fonts/', root));
const FONTS = {
  fredoka: [500, 600, 700],
  nunito: [400, 600, 700, 800],
};

await mkdir(out, { recursive: true });
for (const [family, weights] of Object.entries(FONTS)) {
  for (const w of weights) {
    const name = `${family}-latin-${w}-normal.woff2`;
    const src = fileURLToPath(new URL(`node_modules/@fontsource/${family}/files/${name}`, root));
    await copyFile(src, out + name);
    console.log('✔', name);
  }
}
