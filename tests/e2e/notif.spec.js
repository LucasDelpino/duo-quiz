import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo } from './helpers.js';

test('notifications : invitation sur l’accueil, carte dans les réglages', async ({ page }) => {
  const w = watchPage(page);
  // Le navigateur de test refuse les notifications d'office : on simule « pas encore demandé ».
  await page.addInitScript(() => {
    if (globalThis.Notification) Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
  });
  await startSoloDemo(page, 'Lucas');

  const prompt = page.getByTestId('push-prompt');
  await expect(prompt).toContainText('Alex a répondu à 3 questions');
  await prompt.getByRole('button', { name: 'Plus tard' }).click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('push-prompt')).toHaveCount(0); // ne revient pas

  await page.goto('./?demo=1#/settings');
  await expect(page.getByTestId('notif-card')).toBeVisible();
  // Lien de l'app à partager : adresse propre, sans ?demo ni #route
  await expect(page.getByTestId('app-link')).toHaveValue(/^http:\/\/127\.0\.0\.1:\d+\/duo-quiz\/$/);
  await expect(page.getByTestId('copy-app-link')).toBeVisible();
  await expect(page.getByTestId('notif-status')).toContainText('Désactivées');
  await expect(page.getByTestId('notif-toggle')).toHaveText('Activer les notifications 🔔');
  expect(w.errors).toEqual([]);
  expect(w.external).toEqual([]);
});
