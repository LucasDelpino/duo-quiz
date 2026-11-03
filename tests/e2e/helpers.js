import { expect } from '@playwright/test';

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
  return page.evaluate(() => JSON.parse(localStorage.getItem('duo-quiz:demo-session') || 'null'));
}

/** Répond à l'étape courante quel que soit le type de question. */
export async function pick(page, scope, text = 'Une réponse sincère') {
  const opt = page.locator(`${scope} .option`).first();
  if (await opt.count()) await opt.click();
  else await page.locator(`${scope} textarea`).fill(text);
}

export async function playRound(page) {
  await expect(page.getByTestId('step')).toHaveText(/Étape 1\/2/);
  await pick(page, '[data-view="round"]');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('step')).toHaveText(/Étape 2\/2 · Et /);
  await pick(page, '[data-view="round"]', 'Je parie sur ça');
  await page.getByTestId('send').click();
}

/** Joue (et valide si besoin) toutes les questions « à jouer » du jour en démo solo. */
export async function playAllToday(page) {
  for (;;) {
    await page.goto('./?demo=1#/today');
    const todo = page.locator('[data-testid="today-rounds"] .round-card[data-status="todo"]');
    await expect(page.locator('[data-testid="today-rounds"] .round-card').first()).toBeVisible();
    if (!(await todo.count())) break;
    await todo.first().click();
    await playRound(page);
    await expect(page.getByTestId('points')).toBeVisible();
    if (await page.getByTestId('judge').count()) {
      await page.getByTestId('judge-no').click();
      await expect(page.getByTestId('judge')).toHaveCount(0);
    }
  }
}

/** Ouvre un lien d'invitation et affiche le formulaire (sur iPhone dans Safari : « Jouer dans Safari sans installer »). */
export async function openInvite(page, code, query = '') {
  await page.goto(`./?demo=1#/join/${code}${query}`);
  const view = page.locator('[data-view="join"]');
  await expect(view).toBeVisible();
  if ((await view.getAttribute('data-flow')) === 'ios-install') await page.getByTestId('join-in-browser').locator('summary').click();
}
