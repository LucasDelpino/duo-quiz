// Rythme commun : retard > 10 → pop-up pour le joueur en retard ; avance de 15 → l'autre est bloqué.
import { test, expect, devices } from '@playwright/test';
import { watchPage, syncDb, DB_KEY } from './helpers.js';

test('écart de réponses : alerte du joueur en retard, blocage du joueur en avance', async ({ page: a, browser }, info) => {
  test.setTimeout(60_000);
  const otherDevice = info.project.name === 'iPhone' ? devices['Galaxy S9+'] : devices['iPhone 14'];
  const b = await (await browser.newContext(otherDevice)).newPage();
  const wa = watchPage(a);
  const wb = watchPage(b);
  await b.addInitScript(() => localStorage.setItem('duo-quiz:force-popup', '1'));

  await a.goto('./?demo=1');
  await a.fill('#create-name', 'Lucas');
  await a.click('#create-form button[type="submit"]');
  const code = (await a.getByTestId('invite-code').textContent()).trim();
  await b.goto('./?demo=1#/setup');
  await syncDb(a, b);
  await b.goto(`./?demo=1#/join/${code}`);
  await b.fill('#join-name', 'Léa');
  await b.click('#join-form button[type="submit"]');
  await expect(b.locator('[data-view="install"]')).toBeVisible();
  await syncDb(b, a);

  // Lucas a déjà répondu à 15 questions d'hier, Léa à aucune (base démo modifiée comme le ferait le serveur).
  await a.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key));
    const room = db.rooms[0];
    const d = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
    for (let i = 0; i < 15; i += 1) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      db.rounds.push({ id, room_id: room.id, play_date: d, source: 'bank', bank_id: `zz${i}`, author: null, text: `Question d’hier ${i} ?`, kind: 'text', options: null, category: 'gouts:aime', created_at: new Date().toISOString() });
      db.answers.push({ round_id: id, room_id: room.id, player: 1, self_answer: 'a', guess_other: 'b', created_at: new Date().toISOString() });
    }
    localStorage.setItem(key, JSON.stringify(db));
  }, DB_KEY);
  await syncDb(a, b);

  // Lucas : bloqué (bandeau + écran de réponse verrouillé)
  await a.goto('./?demo=1#/today');
  await expect(a.getByTestId('pace-banner')).toHaveAttribute('data-state', 'blocked');
  await expect(a.getByTestId('pace-banner')).toContainText('15 réponses d’avance');
  await a.locator('[data-testid="today-rounds"] .round-card[data-status="todo"]').first().click();
  await expect(a.getByTestId('pace-blocked')).toBeVisible();
  await expect(a.getByTestId('step')).toHaveCount(0);

  // Léa : pop-up « Tu es en retard ! »
  await b.goto('./?demo=1#/today');
  await expect(b.getByTestId('pace-popup')).toContainText('Tu es en retard');
  await expect(b.getByTestId('pace-popup')).toContainText('15 réponses d’avance');
  await b.getByTestId('progress-close').click();
  await expect(b.getByTestId('pace-banner')).toHaveCount(0);

  // Léa rattrape 5 réponses → Lucas débloqué (avance 10 : plus de bandeau)
  for (let i = 0; i < 5; i += 1) {
    await b.goto(`./?demo=1#/round/00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    await b.locator('[data-view="round"] textarea').fill('Ma réponse');
    await b.getByTestId('next').click();
    await b.locator('[data-view="round"] textarea').fill('Ta réponse');
    await b.getByTestId('send').click();
    await expect(b.locator('[data-view="round"]')).toHaveAttribute('data-status', /revealed|to_judge/);
  }
  await syncDb(b, a);
  await a.goto('./?demo=1#/today');
  await expect(a.locator('[data-view="today"]')).toBeVisible();
  await expect(a.getByTestId('pace-banner')).toHaveCount(0);
  await a.locator('[data-testid="today-rounds"] .round-card[data-status="todo"]').first().click();
  await expect(a.getByTestId('step')).toHaveText(/Étape 1\/2/);

  // Bilan : la ligne d'intégrité indique les questions en attente
  await a.goto('./?demo=1#/report?p=all');
  await expect(a.getByTestId('report-pending')).toContainText('du côté de Léa');

  for (const w of [wa, wb]) { expect(w.errors).toEqual([]); expect(w.external).toEqual([]); }
});
