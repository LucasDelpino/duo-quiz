import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

test.describe('Socle', () => {
  test("l'app charge en mode démo sans erreur ni réseau externe", async ({ page }) => {
    const w = watchPage(page);
    await page.goto('./?demo=1');
    await expect(page).toHaveURL(/#\/setup$/);
    await expect(page.locator('[data-view="setup"]')).toBeVisible();
    await expect(page.locator('#demo-badge')).toBeVisible();
    await expect(page.locator('#tabs')).toBeHidden();
    expect(w.errors).toEqual([]);
    expect(w.external).toEqual([]);
  });

  test("la barre d'onglets navigue entre les écrans", async ({ page }) => {
    const w = watchPage(page);
    await page.goto('./?demo=1#/today');
    const tabs = page.locator('#tabs .tab');
    await expect(tabs).toHaveCount(5);
    await expect(page.locator('#tabs [aria-current="page"]')).toHaveAttribute('data-tab', 'today');
    for (const [tab, view] of [['add', 'add'], ['report', 'report'], ['love', 'love'], ['more', 'settings'], ['today', 'today']]) {
      await page.locator(`#tabs [data-tab="${tab}"]`).click();
      await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
      await expect(page.locator('#tabs [aria-current="page"]')).toHaveAttribute('data-tab', tab);
    }
    const box = await tabs.first().boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(w.errors).toEqual([]);
    expect(w.external).toEqual([]);
  });

  test('une route inconnue redirige vers le setup', async ({ page }) => {
    await page.goto('./?demo=1#/nimporte/quoi');
    await expect(page).toHaveURL(/#\/setup$/);
  });

  test('métas iOS/Android présentes', async ({ page }) => {
    await page.goto('./?demo=1');
    const meta = (name) => page.locator(`meta[name="${name}"]`).getAttribute('content');
    expect(await meta('viewport')).toContain('viewport-fit=cover');
    expect(await meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(await meta('apple-mobile-web-app-status-bar-style')).toBe('black-translucent');
    expect(await meta('theme-color')).toBeTruthy();
  });
});
