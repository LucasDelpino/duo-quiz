import { test, expect, devices } from '@playwright/test';
import { watchPage, startSoloDemo, syncDb, playRound, openInvite } from './helpers.js';

test('démo solo : jouer les questions du jour, révélation, validation', async ({ page }) => {
  const w = watchPage(page);
  await startSoloDemo(page, 'Lucas');
  await expect(page.locator('.today-date')).not.toBeEmpty();
  const cards = page.locator('[data-testid="today-rounds"] .round-card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByTestId('score-me')).toHaveText('0');
  // aucune trace de l'origine des questions
  await expect(page.locator('[data-view="today"]')).not.toContainText(/question perso|banque|Alex a écrit|écrite par/i);

  for (let i = 0; i < 3; i++) {
    await page.locator('[data-testid="today-rounds"] .round-card[data-status="todo"]').first().click();
    await playRound(page);
    await expect(page.locator('[data-view="round"]')).toHaveAttribute('data-status', /revealed|to_judge/);
    await expect(page.getByTestId('reveal-card')).toHaveCount(4);
    await expect(page.locator('.flip.is-flipped')).toHaveCount(4);
    await expect(page.getByTestId('points')).toBeVisible();
    if (await page.getByTestId('judge').count()) {
      await page.getByTestId('judge-yes').click();
      await expect(page.getByTestId('judge')).toHaveCount(0);
      await expect(page.locator('[data-view="round"]')).toHaveAttribute('data-status', 'revealed');
    }
    await page.goto('./?demo=1#/today');
  }
  await expect(page.getByTestId('all-done')).toBeVisible();
  await expect(page.locator('.round-card[data-status="revealed"]')).toHaveCount(3);
  // revenir sur un round déjà révélé : pas de nouvelle saisie possible
  await cards.first().click();
  await expect(page.getByTestId('next')).toHaveCount(0);
  await expect(page.locator('.flip.is-flipped')).toHaveCount(4);
  expect(w.errors).toEqual([]);
  expect(w.external).toEqual([]);
});

test('deux téléphones : attente, anti-triche, révélation identique', async ({ page: a, browser }, info) => {
  const other = info.project.name === 'iPhone' ? devices['Galaxy S9+'] : devices['iPhone 14'];
  const b = await (await browser.newContext(other)).newPage();
  const w = watchPage(a);
  await a.goto('./?demo=1');
  await a.fill('#create-name', 'Lucas');
  await a.click('#create-form button[type="submit"]');
  const code = (await a.getByTestId('invite-code').textContent()).trim();
  await b.goto('./?demo=1#/setup');
  await syncDb(a, b);
  await openInvite(b, code);
  await b.fill('#join-name', 'Léa');
  await b.click('#join-form button[type="submit"]');
  await b.getByTestId('install-done').click();
  await expect(b.locator('[data-testid="today-rounds"] .round-card')).toHaveCount(3);

  // Léa répond à la première question : elle attend Lucas
  const first = b.locator('[data-testid="today-rounds"] .round-card').first();
  const roundId = await first.getAttribute('data-round');
  await first.click();
  await playRound(b);
  await expect(b.getByTestId('waiting')).toHaveText('Lucas n’a pas encore répondu 🤫');

  // Lucas voit la même question, sans la réponse de Léa
  await syncDb(b, a);
  await a.goto(`./?demo=1#/round/${roundId}`);
  await expect(a.locator('[data-view="round"]')).toHaveAttribute('data-status', 'todo');
  await expect(a.getByTestId('reveal-card')).toHaveCount(0);
  await playRound(a);
  await expect(a.getByTestId('reveal-card')).toHaveCount(4);
  const aTexts = await a.locator('.reveal-value').allTextContents();

  // Retour chez Léa : révélation
  await syncDb(a, b);
  await b.reload();
  await expect(b.getByTestId('reveal-card')).toHaveCount(4);
  const bTexts = await b.locator('.reveal-value').allTextContents();
  // mêmes 4 valeurs, vues de chaque côté (ma réponse ↔ sa réponse)
  expect([...bTexts].sort()).toEqual([...aTexts].sort());
  expect(w.errors).toEqual([]);
});
