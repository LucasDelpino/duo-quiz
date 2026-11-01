import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo, playAllToday } from './helpers.js';

test('bilan de la période, sélecteur, partage, historique filtrable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const w = watchPage(page);
  await page.emulateMedia({ reducedMotion: 'reduce' }); // compteurs instantanés
  await startSoloDemo(page, 'Lucas');
  await playAllToday(page);

  await page.locator('#tabs [data-tab="report"]').click();
  await expect(page.locator('[data-view="report"]')).toBeVisible();
  await expect(page.locator('.segment.is-active')).toHaveAttribute('data-period', 'current');
  await expect(page.getByTestId('report-title')).not.toBeEmpty();
  const p1 = Number(await page.getByTestId('report-points-1').textContent());
  const p2 = Number(await page.getByTestId('report-points-2').textContent());
  await expect(page.getByTestId('report-player-1')).toContainText('Lucas (toi)');
  await expect(page.getByTestId('report-player-2')).toContainText('Alex');
  // le titre désigne le gagnant ou l'égalité
  const title = await page.getByTestId('report-title').textContent();
  if (p1 > p2) expect(title).toBe('Lucas connaît Alex par cœur 👑');
  else if (p2 > p1) expect(title).toBe('Alex connaît Lucas par cœur 👑');
  else expect(title).toMatch(/Égalité/);

  await page.locator('[data-period="previous"]').click();
  await expect(page.locator('.segment.is-active')).toHaveAttribute('data-period', 'previous');
  await expect(page.getByTestId('report-title')).toHaveText(/Pas encore/);
  await page.locator('[data-period="all"]').click();
  await expect(page.getByTestId('report-points-1')).toHaveText(String(p1));
  await page.locator('[data-period="custom"]').click();
  await expect(page.locator('#from')).toBeVisible();
  // pas de débordement horizontal (sinon le mobile dézoome la page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByTestId('share-report').click();
  await expect(page.locator('.toast').last()).toHaveText(/Copié|Copie impossible/);

  await page.goto('./?demo=1#/history');
  const items = page.locator('.history-item');
  await expect(items).toHaveCount(3);
  await expect(page.locator('#tabs [aria-current="page"]')).toHaveAttribute('data-tab', 'more');
  const firstCat = page.locator('.chip-filter .chip').nth(1);
  const cat = await firstCat.getAttribute('data-cat');
  await firstCat.click();
  await expect(page).toHaveURL(new RegExp(`cat=${cat}`));
  const n = await items.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(3);
  await expect(page.locator('[data-view="history"]')).not.toContainText(/perso|banque/i);
  expect(w.errors).toEqual([]);
});
