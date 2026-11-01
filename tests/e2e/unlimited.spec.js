import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo, playAllToday } from './helpers.js';

test('mode illimité : réglage « Illimité », puis « Encore des questions » après avoir tout joué', async ({ page }) => {
  const { errors, external } = watchPage(page);
  await startSoloDemo(page, 'Lucas');

  // Mode normal : pas de bouton
  await expect(page.getByTestId('draw-more')).toHaveCount(0);

  await page.goto('./?demo=1#/settings');
  await page.selectOption('#questions_per_day', '0');
  await page.getByTestId('save-settings').click();
  await expect(page.locator('.toast').last()).toHaveText(/enregistrés/);

  await page.goto('./?demo=1#/today');
  const cards = page.locator('[data-testid="today-rounds"] .round-card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByTestId('draw-more')).toHaveCount(0); // il faut d'abord tout jouer

  await playAllToday(page);
  await page.goto('./?demo=1#/today');
  await expect(page.getByTestId('all-done')).toHaveText(/pour l’instant/);
  await page.getByTestId('draw-more').click();
  await expect(cards).toHaveCount(6);
  await expect(page.locator('[data-testid="today-rounds"] .round-card[data-status="todo"]')).toHaveCount(3);
  await expect(page.getByTestId('draw-more')).toHaveCount(0);

  // Le réglage est conservé et affiché
  await page.goto('./?demo=1#/settings');
  await expect(page.locator('#questions_per_day')).toHaveValue('0');

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
