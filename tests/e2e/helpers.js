// Garde-fous communs : aucune requête externe, aucune erreur console.
export function watchPage(page) {
  const errors = [];
  const external = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  page.context().route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:') return route.continue();
    external.push(url.href);
    return route.abort();
  });
  return { errors, external };
}

export const DB_KEY = 'duo-quiz:demo-db';

/**
 * En démo, la « base » vit dans le localStorage : deux téléphones (2 contextes) la partagent
 * en recopiant la clé de l'un vers l'autre, comme le ferait le serveur.
 */
export async function syncDb(from, to) {
  const db = await from.evaluate((k) => localStorage.getItem(k), DB_KEY);
  await to.evaluate(([k, v]) => { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); }, [DB_KEY, db]);
}

/** Démarre une partie solo (partenaire simulé) et arrive sur « Aujourd'hui ». */
export async function startSoloDemo(page, name = 'Lucas') {
  await page.goto('./?demo=1#/setup');
  await page.fill('#demo-name', name);
  await page.click('#demo-form button[type="submit"]');
  await page.waitForURL(/#\/today$/);
}

export async function session(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('duo-quiz:session') || 'null'));
}
