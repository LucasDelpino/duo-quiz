import { test, expect, devices } from '@playwright/test';
import { watchPage, syncDb, session } from './helpers.js';

test('invitation : lien personnalisé + QR, une touche sur Android, installation d’abord sur iPhone, coller l’invitation', async ({ page: a, browser }) => {
  test.setTimeout(60_000);
  const wa = watchPage(a);
  await a.goto('./?demo=1');
  await a.fill('#create-name', 'Lucas');
  await a.click('#create-form button[type="submit"]');
  const code = (await a.getByTestId('invite-code').textContent()).trim();
  await a.fill('#invite-partner', 'Léa');
  await expect(a.getByTestId('invite-link')).toHaveText(new RegExp(`#/join/${code}\\?de=Lucas&n=L%C3%A9a$`));
  const link = (await a.getByTestId('invite-link').textContent()).trim();
  await a.locator('.invite-qr-box summary').click();
  await expect(a.locator('[data-testid="invite-qr"] svg')).toBeVisible();
  const hash = link.slice(link.indexOf('#'));

  // iPhone dans Safari : parcours « installer d'abord », manifeste pointé sur l'invitation
  const ios = await (await browser.newContext(devices['iPhone 14'])).newPage();
  await ios.goto('./?demo=1#/setup');
  await syncDb(a, ios);
  await ios.goto(`./?demo=1${hash}`);
  await expect(ios.locator('[data-view="join"]')).toHaveAttribute('data-flow', 'ios-install');
  await expect(ios.getByTestId('join-title')).toHaveText('Lucas t’invite à jouer !');
  await expect(ios.getByTestId('copy-invite')).toBeVisible();
  await expect(ios.getByTestId('ios-steps')).toBeVisible();
  await expect.poll(() => ios.evaluate(() => document.querySelector('link[rel="manifest"]').href)).toMatch(/^blob:/);
  const manifest = await ios.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  expect(manifest.start_url).toContain(`#/join/${code}?de=Lucas&n=L%C3%A9a`);

  // Android : une touche (prénom déjà rempli)
  const android = await (await browser.newContext({ ...devices['Galaxy S9+'], permissions: ['clipboard-read', 'clipboard-write'] })).newPage();
  const wb = watchPage(android);
  await android.goto('./?demo=1#/setup');
  await syncDb(a, android);
  await android.goto(`./?demo=1${hash}`);
  await expect(android.locator('[data-view="join"]')).toHaveAttribute('data-flow', 'one-tap');
  await expect(android.locator('#join-name')).toHaveValue('Léa');
  await android.getByTestId('join-submit').click();
  await expect(android.locator('[data-view="install"]')).toBeVisible();
  expect(await session(android)).toMatchObject({ player: 2, names: { 2: 'Léa' } });

  // App installée sans session : « Coller mon invitation » lit le presse-papiers et ouvre l'invitation
  const fresh = await (await browser.newContext({ ...devices['Galaxy S9+'], permissions: ['clipboard-read', 'clipboard-write'] })).newPage();
  await fresh.goto('./?demo=1#/setup');
  await fresh.evaluate((t) => navigator.clipboard.writeText(t), `Lucas t’invite 💞\n${link}`);
  await fresh.getByTestId('paste-invite').click();
  await expect(fresh.locator('[data-view="join"]')).toBeVisible();
  await expect(fresh.getByTestId('join-title')).toHaveText('Lucas t’invite à jouer !');
  await expect(fresh.locator('#join-name')).toHaveValue('Léa');
  // presse-papiers sans invitation : message clair
  await fresh.goto('./?demo=1#/setup');
  await fresh.evaluate(() => navigator.clipboard.writeText('rien à voir'));
  await fresh.getByTestId('paste-invite').click();
  await expect(fresh.locator('.toast').last()).toContainText('Aucune invitation trouvée');

  expect([...wa.errors, ...wb.errors]).toEqual([]);
  expect([...wa.external, ...wb.external]).toEqual([]);
});
