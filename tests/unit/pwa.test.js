import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const sw = readFileSync('sw.js', 'utf8');
const assets = JSON.parse(`[${sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].replace(/'/g, '"').replace(/,\s*$/, '')}]`);

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Dimensions d'un PNG (en-tête IHDR). */
function pngSize(path) {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('PWA', () => {
  it('le service worker précache tous les fichiers de l’app, et seulement des fichiers existants', () => {
    const runtime = [...files('js'), ...files('css'), ...files('data'), ...files('assets')];
    for (const f of runtime) expect(assets, f).toContain(f);
    for (const a of assets.filter((x) => x !== './')) expect(existsSync(a), a).toBe(true);
    expect(assets).toContain('index.html');
    expect(assets).toContain('manifest.webmanifest');
  });

  it('ne met jamais Supabase en cache', () => {
    expect(sw).not.toMatch(/supabase\.co/);
    expect(sw).toMatch(/if \(!sameOrigin && !request\.url\.startsWith\(CDN\)\) return;/);
  });

  it('manifest installable (Android + iOS)', () => {
    const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
    expect(m).toMatchObject({ name: 'Duo Quiz', lang: 'fr', display: 'standalone', scope: './' });
    expect(m.start_url.startsWith('./')).toBe(true);
    const sizes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '192x192:maskable', '512x512:maskable']));
    for (const i of m.icons) expect(pngSize(i.src).join('x')).toBe(i.sizes);
  });

  it('apple-touch-icon PNG 180×180 et métas iOS', () => {
    expect(pngSize('assets/apple-touch-icon.png')).toEqual([180, 180]);
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">');
    expect(html).toContain('<link rel="manifest" href="manifest.webmanifest">');
    expect(html).not.toMatch(/(href|src)="\//); // chemins relatifs (sous-dossier GitHub Pages)
  });

  it('pas de 100vh seul, safe-areas présentes', () => {
    const css = readFileSync('css/app.css', 'utf8');
    expect(css).not.toMatch(/100vh/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
