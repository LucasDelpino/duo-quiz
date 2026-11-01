import { test, expect } from '@playwright/test';
import { watchPage, startSoloDemo, playRound } from './helpers.js';

test('pop-up « Qui a joué ? » à l’ouverture + bandeau de progression', async ({ page }) => {
  const { errors, external } = watchPage(page);
  await page.addInitScript(() => localStorage.setItem('duo-quiz:force-popup', '1'));
  await startSoloDemo(page, 'Lucas');

  const pop = page.getByTestId('progress-popup');
  await expect(pop).toBeVisible();
  await expect(pop).toContainText('Personne n’a encore joué');
  await expect(page.getByTestId('popup-me')).toContainText('0/3');
  await expect(page.getByTestId('progress-banner')).toBeVisible();

  // « Jouer » mène à une question du jour.
  await page.getByTestId('progress-play').click();
  await expect(page).toHaveURL(/#\/round\//);
  await playRound(page);

  // Retour sur l'accueil : pas de nouvelle pop-up avant 30 min, bandeau à jour (le partenaire simulé a répondu aussi).
  await page.goto('./?demo=1#/today');
  await expect(page.getByTestId('progress-banner')).toBeVisible();
  await expect(page.getByTestId('progress-me')).toContainText('1/3');
  await expect(page.getByTestId('progress-them')).toContainText('1/3');
  await expect(page.getByTestId('progress-popup')).toHaveCount(0);

  // 30 min plus tard (on efface l'horodatage) : la pop-up revient avec le bon message, et se ferme.
  await page.evaluate(() => localStorage.removeItem('duo-quiz:progress-popup-at'));
  await page.reload();
  await expect(page.getByTestId('progress-popup')).toContainText('a commencé');
  await expect(page.getByTestId('progress-popup')).toContainText('1/3');
  await page.getByTestId('progress-close').click();
  await expect(page.getByTestId('progress-popup')).toHaveCount(0);

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
