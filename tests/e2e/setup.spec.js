import { test, expect, devices } from '@playwright/test';
import { watchPage, syncDb, session } from './helpers.js';

const IPHONE = devices['iPhone 14'];
const GALAXY = devices['Galaxy S9+'];

test.describe('Setup et installation', () => {
  // A = téléphone du projet en cours, B = l'autre modèle : les deux sens sont couverts.
  test('créer, rejoindre sur l’autre téléphone, tuto adapté, reconnexion de l’app installée', async ({ page: a, browser }, info) => {
    const aIsIos = info.project.name === 'iPhone';
    const other = aIsIos ? GALAXY : IPHONE;
    const b = await (await browser.newContext(other)).newPage();
    const wa = watchPage(a);
    const wb = watchPage(b);

    // Lucas crée la partie sur son Samsung
    await a.goto('./?demo=1');
    await a.fill('#create-name', 'Lucas');
    await a.click('#create-form button[type="submit"]');
    const code = (await a.getByTestId('invite-code').textContent()).trim();
    expect(code).toMatch(/^[0-9A-F]{8}$/);
    await expect(a.getByTestId('invite-link')).toContainText(`#/join/${code}`);
    await a.getByTestId('continue').click();
    await expect(a.locator('[data-view="install"]')).toHaveAttribute('data-platform', aIsIos ? 'ios' : 'android');
    await expect(a.getByTestId(aIsIos ? 'install-ios' : 'install-android')).toBeVisible();
    await expect(a.getByTestId(aIsIos ? 'install-android' : 'install-ios')).toHaveCount(0);
    await a.getByTestId('install-done').click();
    await expect(a).toHaveURL(/#\/today$/);

    // Léa ouvre le lien sur son iPhone
    await b.goto('./?demo=1#/setup');
    await syncDb(a, b);
    await b.goto(`./?demo=1#/join/${code}`);
    await expect(b.locator('#join-code')).toHaveValue(code);
    await b.fill('#join-name', 'Léa');
    await b.click('#join-form button[type="submit"]');
    await expect(b.locator('[data-view="install"]')).toHaveAttribute('data-platform', aIsIos ? 'android' : 'ios');
    expect(await session(b)).toMatchObject({ player: 2, names: { 1: 'Lucas', 2: 'Léa' } });
    // L'iPhone (A ou B) génère un code pour l'app installée
    const ios = aIsIos ? a : b;
    if (aIsIos) await a.goto('./?demo=1#/install');
    await expect(ios.getByTestId('ios-steps')).toBeVisible();
    await expect(ios.locator('.step-icon').first()).toBeVisible();

    // Le code d'invitation ne marche qu'une fois
    await syncDb(b, a);
    const c = await (await browser.newContext(GALAXY)).newPage();
    await c.goto('./?demo=1#/setup');
    await syncDb(b, c);
    await c.goto(`./?demo=1#/join/${code}`);
    await c.fill('#join-name', 'Intrus');
    await c.click('#join-form button[type="submit"]');
    await expect(c.locator('.form-error')).toHaveText(/invalide ou a déjà été utilisé/);

    // iPhone : code de connexion pour l'app installée (stockage séparé de Safari)
    await syncDb(b, ios);
    await ios.getByTestId('make-link').click();
    const linkCode = (await ios.getByTestId('link-code').textContent()).trim();
    expect(linkCode).toMatch(/^[0-9A-F]{8}$/);
    const installed = await (await browser.newContext(IPHONE)).newPage();
    await installed.goto('./?demo=1#/setup');
    await syncDb(ios, installed);
    await installed.goto('./?demo=1#/setup');
    await installed.locator('details summary').first().click();
    await installed.fill('#link-code', linkCode.toLowerCase());
    await installed.click('#link-form button[type="submit"]');
    await expect(installed).toHaveURL(/#\/today$/);
    expect(await session(installed)).toMatchObject({ player: aIsIos ? 1 : 2, names: { 1: 'Lucas', 2: 'Léa' } });

    // Le code est à usage unique
    const again = await (await browser.newContext(IPHONE)).newPage();
    await again.goto('./?demo=1#/setup');
    await syncDb(installed, again);
    await again.goto(`./?demo=1#/link/${linkCode}`);
    await again.getByTestId('claim').click();
    await expect(again.locator('.form-error')).toHaveText(/invalide ou a expiré/);

    expect([...wa.errors, ...wb.errors]).toEqual([]);
    expect([...wa.external, ...wb.external]).toEqual([]);
  });
});

test('erreurs en français et démo solo', async ({ page }) => {
  const w = watchPage(page);
  await page.goto('./?demo=1');
  await page.click('#create-form button[type="submit"]');
  await expect(page.locator('#create-form .form-error')).toHaveText(/prénom/);
  await page.fill('#join-code', 'ZZZZ0000');
  await page.fill('#join-name', 'Léa');
  await page.click('#join-form button[type="submit"]');
  await expect(page.locator('#join-form .form-error')).toHaveText(/invitation est invalide/);
  const size = await page.locator('#join-code').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  await page.fill('#demo-name', 'Lucas');
  await page.click('#demo-form button[type="submit"]');
  await expect(page).toHaveURL(/#\/today$/);
  expect(await session(page)).toMatchObject({ player: 1, names: { 1: 'Lucas', 2: 'Alex' } });
  expect(w.errors).toEqual([]);
});
