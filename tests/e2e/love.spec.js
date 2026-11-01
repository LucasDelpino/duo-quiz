import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo, playAllToday, DB_KEY } from './helpers.js';

test('love report : rapport IA factice, score direct verrouillé puis portraits, courbe, affichage défensif', async ({ page }) => {
  const w = watchPage(page);
  await startSoloDemo(page, 'Lucas');
  await page.locator('#tabs [data-tab="love"]').click();
  await expect(page.locator('[data-view="love"]')).toBeVisible();
  // rapport IA factice de la démo : 78 %
  await expect(page.locator('.gauge')).toHaveAttribute('aria-valuenow', '78');
  await expect(page.locator('.gauge-value span')).toHaveText('Très complices');
  await expect(page.getByTestId('ai-summary')).toContainText('complicité');
  await expect(page.getByTestId('ai-player-1')).toContainText('Lucas selon l’analyse');
  await expect(page.getByTestId('ai-todo')).toBeVisible();
  await expect(page.getByTestId('locked')).toContainText('Encore 5 questions');
  await expect(page.getByTestId('curve')).toHaveCount(0);
  await expect(page.locator('.disclaimer')).toHaveText(/pas une vérité scientifique/);

  // Après avoir joué : portraits partiels, toujours verrouillé (< 5)
  await playAllToday(page);
  await page.goto('./?demo=1#/love');
  await expect(page.getByTestId('locked')).toContainText('Encore 2 questions');
  await expect(page.getByTestId('portrait-1')).toBeVisible();

  // Second rapport (contenu bancal) : courbe + aucune casse
  await page.evaluate((key) => {
    const db = JSON.parse(localStorage.getItem(key));
    const room = db.rooms[0].id;
    db.analyses.push({ id: 'x2', room_id: room, period_start: '2099-01-01', period_end: '2099-01-07', compatibility: 64,
      content: { summary: 42, players: 'oups', points_communs: 'Le rire', differences: [null, {}], evolution: 'En hausse' } });
    localStorage.setItem(key, JSON.stringify(db));
  }, DB_KEY);
  await page.reload();
  await expect(page.locator('.gauge')).toHaveAttribute('aria-valuenow', '64');
  await expect(page.locator('.gauge-value span')).toHaveText('Très complices');
  await expect(page.getByTestId('curve')).toBeVisible();
  await expect(page.locator('.curve')).toHaveAttribute('aria-label', 'Évolution : 78 %, 64 %');
  await expect(page.getByTestId('ai-summary')).toHaveCount(0);
  await expect(page.getByTestId('ai-common')).toContainText('Le rire');
  await expect(page.getByTestId('ai-diff')).toHaveCount(0);
  await expect(page.getByTestId('ai-evolution')).toContainText('En hausse');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(w.errors).toEqual([]);
});
