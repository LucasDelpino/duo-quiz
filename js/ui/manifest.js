// iPhone : l'app installée s'ouvre sur le start_url du manifeste, pas sur la page courante.
// Sur l'écran d'invitation, on remplace le manifeste par une copie dont le start_url est le lien
// d'invitation : l'app ajoutée à l'écran d'accueil s'ouvre directement sur l'invitation.
export async function pointManifestTo(url, doc = globalThis.document, fetcher = globalThis.fetch) {
  try {
    const link = doc.querySelector('link[rel="manifest"]');
    if (!link) return false;
    const base = new URL(link.getAttribute('href'), doc.baseURI);
    const m = await (await fetcher(base.href)).json();
    const abs = (u) => new URL(u, base).href;
    const patched = {
      ...m,
      start_url: url,
      scope: abs(m.scope || './'),
      id: abs(m.id || './'),
      icons: (m.icons || []).map((i) => ({ ...i, src: abs(i.src) })),
    };
    const blob = new Blob([JSON.stringify(patched)], { type: 'application/manifest+json' });
    link.setAttribute('href', URL.createObjectURL(blob));
    return true;
  } catch {
    return false;
  }
}
