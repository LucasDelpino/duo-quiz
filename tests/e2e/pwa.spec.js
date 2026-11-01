import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo } from './helpers.js';

test('PWA : manifest, icônes, service worker et fonctionnement hors ligne', async ({ page, context }) => {
  const w = watchPage(page);
  await startSoloDemo(page, 'Lucas');
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  expect(manifest.display).toBe('standalone');
  const iconOk = await page.evaluate(async () => (await fetch('assets/apple-touch-icon.png')).ok);
  expect(iconOk).toBe(true);

  // Service worker actif, puis rechargement hors ligne
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.locator('#offline-banner')).toBeHidden();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-view="today"]')).toBeVisible();
  await expect(page.locator('[data-testid="today-rounds"] .round-card')).toHaveCount(3);
  await expect(page.locator('#offline-banner')).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator('#offline-banner')).toBeHidden();
  expect(w.external).toEqual([]);
});

test('accessibilité : focus à chaque écran, onglets étiquetés, états vides, champs libellés', async ({ page }) => {
  await page.goto('./?demo=1');
  await page.fill('#create-name', 'Lucas');
  await page.click('#create-form button[type="submit"]');
  await expect(page.getByTestId('invite-code')).toBeVisible();
  await page.goto('./?demo=1#/history');
  await expect(page.locator('.empty')).toContainText('Rien à afficher');
  await page.locator('#tabs [data-tab="today"]').click();
  await expect(page.locator('[data-view="today"]')).toBeVisible();
  await expect(page.locator('#app')).toBeFocused(); // le lecteur d'écran repart du début de l'écran
  await expect(page).toHaveTitle('Aujourd’hui · Duo Quiz');
  await expect(page.locator('#tabs')).toHaveAttribute('aria-label', 'Navigation principale');
  for (const tab of await page.locator('#tabs .tab').all()) expect((await tab.innerText()).trim().length).toBeGreaterThan(0);
  // tous les champs ont un libellé
  await page.goto('./?demo=1#/add');
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll('input, textarea, select')]
    .filter((el) => el.type !== 'radio' && !el.labels?.length && !el.getAttribute('aria-label')).map((el) => el.id || el.name));
  expect(unlabeled).toEqual([]);
});
