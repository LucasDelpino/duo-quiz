import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

test('question perso : formulaire normalisé, réserve, puis indiscernable parmi celles du jour', async ({ page }) => {
  const w = watchPage(page);
  await page.goto('./?demo=1');
  await page.fill('#create-name', 'Lucas');
  await page.click('#create-form button[type="submit"]');
  await expect(page.getByTestId('invite-code')).toBeVisible();
  await page.goto('./?demo=1#/add');
  await expect(page.getByTestId('pending-count')).toHaveText('Aucune question surprise en réserve');

  // QCM par défaut : 2 choix minimum
  await page.fill('#q-text', '  plutôt film ou série ce soir');
  await page.getByTestId('submit').click();
  await expect(page.locator('#add-form .form-error')).toHaveText(/entre 2 et 6/);
  const opts = page.locator('[data-testid="options-editor"] input');
  await opts.nth(0).fill('film');
  await opts.nth(1).fill(' série ');
  await expect(page.getByTestId('preview').locator('.q-text')).toHaveText('Plutôt film ou série ce soir ?');
  await page.getByTestId('submit').click();
  await expect(page.locator('.toast')).toContainText('en secret');
  await expect(page.getByTestId('pending-count')).toHaveText('1 question surprise en réserve 🤫');

  // Échelle avec libellés et {autre}
  await page.locator('input[name="q-kind"][value="scale"]').check();
  await page.fill('#q-text', 'à quel point aimes-tu cuisiner pour ');
  await page.getByTestId('insert-other').click();
  await expect(page.getByTestId('scale-labels')).toBeVisible();
  await expect(page.getByTestId('options-editor')).toBeHidden();
  await page.fill('#q-high', 'à fond');
  await expect(page.getByTestId('preview').locator('.q-text')).toHaveText('À quel point aimes-tu cuisiner pour ton/ta partenaire (1 = pas du tout, 5 = à fond) ?');
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('pending-count')).toHaveText('2 questions surprises en réserve 🤫');

  // Tirage : au plus 1 question perso sur 3, rendue exactement comme les autres
  await page.goto('./?demo=1#/today');
  const cards = page.locator('[data-testid="today-rounds"] .round-card');
  await expect(cards).toHaveCount(3);
  const shapes = await cards.evaluateAll((els) => els.map((el) => ({
    attrs: [...el.attributes].map((a) => a.name).sort().join(','),
    cls: el.className,
    chips: [...el.querySelectorAll('.chip')].map((c) => c.className).join('|'),
  })));
  expect(new Set(shapes.map((s) => JSON.stringify(s))).size).toBe(1);
  const texts = await cards.locator('.round-card-text').allTextContents();
  expect(texts.filter((t) => t === 'Plutôt film ou série ce soir ?')).toHaveLength(1);
  await page.goto('./?demo=1#/add');
  await expect(page.getByTestId('pending-count')).toHaveText('1 question surprise en réserve 🤫');
  expect(w.errors).toEqual([]);
});
