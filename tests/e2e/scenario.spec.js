// Scénario complet SPEC §9 : 2 téléphones (Galaxy + iPhone) = 2 joueurs, en mode démo (aucun réseau).
// La « base » démo est recopiée d'un téléphone à l'autre (syncDb) comme le ferait le serveur.
import { test, expect, devices } from '@playwright/test';
import { watchPage, syncDb, session, DB_KEY, openInvite } from './helpers.js';

const CUSTOM = 'Quel super-pouvoir aimerais-tu partager avec {autre} ?';

/** Répond à un round : `self` / `guess` = index de l'option (ou note, ou texte). */
async function answer(page, roundId, { self, guess }) {
  await page.goto(`./?demo=1#/round/${roundId}`);
  await expect(page.locator(`[data-view="round"][data-round="${roundId}"]`)).toBeVisible();
  await expect(page.getByTestId('step')).toHaveText(/Étape 1\/2/);
  const choose = async (v) => {
    const opts = page.locator('[data-view="round"] .option');
    if (await opts.count()) await opts.nth(v % (await opts.count())).click();
    else await page.locator('[data-view="round"] textarea').fill(`Réponse ${v}`);
  };
  await choose(self);
  await page.getByTestId('next').click();
  await choose(guess);
  await page.getByTestId('send').click();
  await expect(page.locator('[data-view="round"]')).toHaveAttribute('data-status', /waiting|revealed|to_judge/);
}

async function todayIds(page) {
  await page.goto('./?demo=1#/today');
  const cards = page.locator('[data-testid="today-rounds"] .round-card');
  await expect(cards).toHaveCount(3);
  return cards.evaluateAll((els) => els.map((e) => e.dataset.round));
}

async function reportSnapshot(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?demo=1#/report?p=all');
  await expect(page.getByTestId('report-title')).not.toBeEmpty();
  return {
    title: await page.getByTestId('report-title').textContent(),
    p1: await page.getByTestId('report-points-1').textContent(),
    p2: await page.getByTestId('report-points-2').textContent(),
    acc1: await page.getByTestId('report-accuracy-1').textContent(),
    acc2: await page.getByTestId('report-accuracy-2').textContent(),
  };
}

test('scénario 2 joueurs : créer, rejoindre, question perso, jouer, révélation, bilan identique, love report', async ({ page: a, browser }, info) => {
  test.setTimeout(90_000);
  const otherDevice = info.project.name === 'iPhone' ? devices['Galaxy S9+'] : devices['iPhone 14'];
  const b = await (await browser.newContext(otherDevice)).newPage();
  const wa = watchPage(a);
  const wb = watchPage(b);

  // 1. Lucas crée la partie, Léa la rejoint
  await a.goto('./?demo=1');
  await a.fill('#create-name', 'Lucas');
  await a.click('#create-form button[type="submit"]');
  const code = (await a.getByTestId('invite-code').textContent()).trim();
  await b.goto('./?demo=1#/setup');
  await syncDb(a, b);
  await openInvite(b, code);
  await b.fill('#join-name', 'Léa');
  await b.click('#join-form button[type="submit"]');
  await expect(b.locator('[data-view="install"]')).toBeVisible();

  // 2. Léa glisse une question perso (texte libre) avant le tirage du jour
  await b.goto('./?demo=1#/add');
  await b.locator('input[name="q-kind"][value="text"]').check();
  await b.fill('#q-text', 'quel super-pouvoir aimerais-tu partager avec ');
  await b.getByTestId('insert-other').click();
  await b.getByTestId('submit').click();
  await expect(b.getByTestId('pending-count')).toHaveText('1 question surprise en réserve 🤫');

  // 3. Tirage : la question de Léa est parmi les 3 de Lucas, rendue comme les autres
  await syncDb(b, a);
  const ids = await todayIds(a);
  const texts = await a.locator('.round-card-text').allTextContents();
  expect(texts).toContain(CUSTOM.replace('{autre}', 'Léa'));
  await expect(a.locator('[data-view="today"]')).not.toContainText(/question perso|banque|Léa a écrit|question surprise|écrite par/i);
  const shapes = await a.locator('.round-card').evaluateAll((els) => els.map((e) => [...e.attributes].map((x) => x.name).sort().join()));
  expect(new Set(shapes).size).toBe(1);

  // 4. Lucas joue tout : il attend Léa
  for (const id of ids) {
    await answer(a, id, { self: 0, guess: 0 });
    await expect(a.getByTestId('waiting')).toHaveText('Léa n’a pas encore répondu 🤫');
  }

  // 5. Léa voit les mêmes questions (même ordre), joue : révélation immédiate
  await syncDb(a, b);
  expect(await todayIds(b)).toEqual(ids);
  await expect(b.locator('.round-card-text').filter({ hasText: CUSTOM.replace('{autre}', 'Lucas') })).toHaveCount(1);
  for (const id of ids) {
    await answer(b, id, { self: 0, guess: 1 });
    await expect(b.getByTestId('reveal-card')).toHaveCount(4);
    await expect(b.locator('.flip.is-flipped')).toHaveCount(4);
    if (await b.getByTestId('judge').count()) {
      await b.getByTestId('judge-yes').click(); // Lucas a bien deviné le texte de Léa
      await expect(b.getByTestId('judge')).toHaveCount(0);
    }
  }

  // 6. Lucas voit la révélation et valide les textes de Léa
  await syncDb(b, a);
  for (const id of ids) {
    await a.goto(`./?demo=1#/round/${id}`);
    await expect(a.locator(`[data-view="round"][data-round="${id}"]`)).toBeVisible();
    await expect(a.getByTestId('reveal-card')).toHaveCount(4);
    if (await a.getByTestId('judge').count()) {
      await a.getByTestId('judge-no').click();
      await expect(a.getByTestId('judge')).toHaveCount(0);
    }
    await expect(a.locator('[data-view="round"]')).toHaveAttribute('data-status', 'revealed');
  }
  await syncDb(a, b);

  // 7. Scores : Lucas a deviné juste partout (mêmes choix/notes, textes validés), Léa jamais (sauf hasard des notes)
  await a.emulateMedia({ reducedMotion: 'reduce' });
  await a.goto('./?demo=1#/today');
  await expect(a.getByTestId('all-done')).toBeVisible();
  await expect(a.getByTestId('score-me')).toHaveText('3');
  await b.emulateMedia({ reducedMotion: 'reduce' });
  await b.goto('./?demo=1#/today');
  await expect(b.getByTestId('score-them')).toHaveText('3');

  // 8. Bilan strictement identique sur les deux téléphones
  const ra = await reportSnapshot(a);
  const rb = await reportSnapshot(b);
  expect(ra).toEqual(rb);
  expect(ra.title).toBe('Lucas connaît Léa par cœur 👑');
  expect(ra.p1).toBe('3');
  expect(ra.acc1).toBe('100 %');

  // 9. Love report avec un rapport IA factice injecté
  await a.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key));
    db.analyses.push({
      id: 'ia-1', room_id: db.rooms[0].id, period_start: '2026-10-26', period_end: '2026-11-01', compatibility: 83,
      created_at: '2026-11-01T21:00:00Z',
      content: { summary: 'Vous vous connaissez déjà très bien !', compatibility: 83, players: { 1: { aime: ['Les défis'] }, 2: { aime: ['Les surprises'] } }, a_faire_ensemble: ['Un pique-nique'] },
    });
    localStorage.setItem(key, JSON.stringify(db));
  }, DB_KEY);
  await syncDb(a, b);
  for (const p of [a, b]) {
    await p.goto('./?demo=1#/love');
    await expect(p.locator('.gauge')).toHaveAttribute('aria-valuenow', '83');
    await expect(p.locator('.gauge-value span')).toHaveText('Âmes sœurs');
    await expect(p.getByTestId('ai-summary')).toContainText('très bien');
    await expect(p.getByTestId('ai-player-2')).toContainText('Les surprises');
    await expect(p.getByTestId('locked')).toContainText('Encore 2 questions');
  }

  // 10. Historique : aucune trace de l'origine de la question perso
  await a.goto('./?demo=1#/history');
  await expect(a.locator('.history-item')).toHaveCount(3);
  await expect(a.locator('[data-view="history"]')).not.toContainText(/question perso|banque|question surprise|écrite par/i);

  expect(await session(a)).toMatchObject({ player: 1 });
  expect(await session(b)).toMatchObject({ player: 2 });
  expect([...wa.errors, ...wb.errors]).toEqual([]);
  expect([...wa.external, ...wb.external]).toEqual([]);
});
