import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo, session } from './helpers.js';

test('réglages : prénoms, questions par jour, sons, appareil, quitter', async ({ page }) => {
  const w = watchPage(page);
  await startSoloDemo(page, 'Lucas');
  await page.locator('#tabs [data-tab="more"]').click();
  await expect(page.locator('[data-view="settings"]')).toBeVisible();
  await expect(page.locator('#p1_name')).toHaveValue('Lucas');
  await expect(page.locator('#p2_name')).toHaveValue('Alex');
  await expect(page.getByTestId('invite')).toHaveCount(0);

  await page.fill('#p2_name', 'Alexis');
  await page.fill('#report_period_days', '91');
  await page.getByTestId('save-settings').click();
  await expect(page.locator('#settings-form .form-error')).toHaveText(/entre 1 et 90/);
  await page.fill('#report_period_days', '7');
  await expect(page.locator('#questions_per_day option')).toHaveCount(11);
  await expect(page.locator('#questions_per_day option').first()).toHaveText(/Illimité/);
  await page.selectOption('#questions_per_day', '5');
  await page.getByTestId('save-settings').click();
  await expect(page.locator('.toast').last()).toHaveText(/enregistrés/);
  expect((await session(page)).names[2]).toBe('Alexis');

  // Sons : désactivés par défaut, mémorisés
  await expect(page.getByTestId('sounds')).not.toBeChecked();
  await page.getByTestId('sounds').check();
  await page.reload();
  await expect(page.getByTestId('sounds')).toBeChecked();

  // Le quota passe à 5 questions aujourd'hui
  await page.locator('#tabs [data-tab="today"]').click();
  await expect(page.locator('[data-testid="today-rounds"] .round-card')).toHaveCount(5);
  await expect(page.getByTestId('score-banner')).toContainText('Alexis');

  // Autre appareil : code de 8 caractères
  await page.goto('./?demo=1#/settings');
  await page.getByTestId('make-link').click();
  await expect(page.getByTestId('link-code')).toHaveText(/^[0-9A-F]{8}$/);
  await expect(page.getByTestId('device-link')).toContainText('sera alors déconnecté');
  await page.getByTestId('to-history').click();
  await expect(page.locator('[data-view="history"]')).toBeVisible();

  // Quitter (double confirmation)
  await page.goto('./?demo=1#/settings');
  await page.getByTestId('leave').click();
  await expect(page.getByTestId('leave')).toHaveText(/Confirmer/);
  await page.getByTestId('leave').click();
  await expect(page).toHaveURL(/#\/setup$/);
  expect(await session(page)).toBeNull();
  expect(w.errors).toEqual([]);
});

test('réglages : invitation visible tant que le partenaire n’a pas rejoint', async ({ page }) => {
  await page.goto('./?demo=1');
  await page.fill('#create-name', 'Lucas');
  await page.click('#create-form button[type="submit"]');
  const code = (await page.getByTestId('invite-code').textContent()).trim();
  await page.goto('./?demo=1#/settings');
  await expect(page.getByTestId('invite')).toContainText(code);
  await expect(page.getByTestId('invite')).toContainText('Invitation en attente');
  await expect(page.locator('#p2_name')).toHaveCount(0);
  await expect(page.getByTestId('exit-demo')).toHaveAttribute('href', './');
});
