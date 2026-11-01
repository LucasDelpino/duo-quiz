import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

test.describe('Design system', () => {
  test('styleguide : polices auto-hébergées, composants, sans erreur', async ({ page }) => {
    const w = watchPage(page);
    await page.goto('./?demo=1#/styleguide');
    await expect(page.locator('[data-view="styleguide"]')).toBeVisible();
    await expect(page.locator('#tabs')).toBeHidden();
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => [document.fonts.check('700 20px Fredoka'), document.fonts.check('400 16px Nunito')]);
    expect(fonts).toEqual([true, true]);

    await page.getByTestId('flip').click();
    await expect(page.locator('.flip')).toHaveClass(/is-flipped/);
    await page.getByTestId('plus').click();
    await expect(page.getByTestId('score')).toHaveText('1');
    await page.getByTestId('gauge').click();
    await expect(page.locator('.gauge')).toHaveAttribute('aria-valuenow', '78');
    await page.getByTestId('toast').click();
    await expect(page.locator('.toast')).toContainText('Bien vu');

    const fontSize = await page.locator('#sg-name').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
    const btn = await page.locator('.btn').first().boundingBox();
    expect(btn.height).toBeGreaterThanOrEqual(48);
    expect(w.errors).toEqual([]);
    expect(w.external).toEqual([]);
  });

  test('prefers-reduced-motion : pas de confettis', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./?demo=1#/styleguide');
    await page.getByTestId('plus').click();
    await expect(page.getByTestId('score')).toHaveText('1');
    await expect(page.locator('.confetti-canvas')).toHaveCount(0);
  });
});
