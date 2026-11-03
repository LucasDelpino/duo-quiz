import { describe, it, expect } from 'vitest';
import { buildInviteUrl, parseInvite, hashQuery } from '../../js/logic/invite.js';
import { qrSvg } from '../../js/ui/qr.js';
import { pointManifestTo } from '../../js/ui/manifest.js';

const BASE = 'https://lucasdelpino.github.io/duo-quiz/';

describe('invitations', () => {
  it('lien avec prénoms facultatifs, relu à l’identique', () => {
    const url = buildInviteUrl(BASE, 'ab12cd34', { from: 'Lucas', to: ' Léa ' });
    expect(url).toBe(`${BASE}#/join/AB12CD34?de=Lucas&n=L%C3%A9a`);
    expect(parseInvite(url)).toEqual({ code: 'AB12CD34', from: 'Lucas', to: 'Léa' });
    expect(buildInviteUrl(BASE, 'AB12CD34')).toBe(`${BASE}#/join/AB12CD34`);
    expect(hashQuery('#/join/AB12CD34?de=Lucas&n=L%C3%A9a').get('n')).toBe('Léa');
  });
  it('accepte un code seul, un texte de partage, et refuse le reste', () => {
    expect(parseInvite(' ab12 cd34 ')).toEqual({ code: 'AB12CD34', from: '', to: '' });
    expect(parseInvite(`Lucas t’invite à jouer 💞\n${BASE}#/join/AB12CD34?de=Lucas`)).toMatchObject({ code: 'AB12CD34', from: 'Lucas' });
    expect(parseInvite('bonjour')).toBeNull();
    expect(parseInvite('')).toBeNull();
    expect(parseInvite(`${BASE}#/join/ZZZZZZZZ`)).toBeNull();
  });
  it('QR code SVG généré pour le lien', () => {
    const svg = qrSvg(buildInviteUrl(BASE, 'AB12CD34', { from: 'Lucas', to: 'Léa' }));
    expect(svg).toMatch(/^<svg[^>]*viewBox/);
    expect(svg.length).toBeGreaterThan(1000);
  });
  it('manifeste pointé sur l’invitation (iPhone) : start_url absolu, icônes absolues', async () => {
    let href = 'manifest.webmanifest';
    const link = { getAttribute: () => href, setAttribute: (_, v) => { href = v; } };
    const doc = { querySelector: () => link, baseURI: BASE };
    const fetcher = async () => ({ json: async () => ({ name: 'Duo Quiz', start_url: './#/today', scope: './', id: './', icons: [{ src: 'assets/icons/icon-192.png' }] }) });
    let parts;
    const origUrl = URL.createObjectURL;
    const OrigBlob = globalThis.Blob;
    globalThis.Blob = class { constructor(p) { parts = p; } };
    URL.createObjectURL = () => 'blob:test';
    try {
      expect(await pointManifestTo(`${BASE}#/join/AB12CD34`, doc, fetcher)).toBe(true);
    } finally { URL.createObjectURL = origUrl; globalThis.Blob = OrigBlob; }
    expect(href).toBe('blob:test');
    const m = JSON.parse(parts.join(''));
    expect(m).toMatchObject({ start_url: `${BASE}#/join/AB12CD34`, scope: BASE, id: BASE, icons: [{ src: `${BASE}assets/icons/icon-192.png` }] });
  });
});
