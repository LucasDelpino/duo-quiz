import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// iPhone émulé sur Chromium (viewport, UA, tactile) : WebKit n'est pas installé dans l'environnement.
const iphone = { ...devices['iPhone 14'], browserName: 'chromium', defaultBrowserType: 'chromium' };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/duo-quiz/`,
    trace: 'off',
  },
  webServer: {
    command: `node scripts/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/duo-quiz/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },
  projects: [
    { name: 'Galaxy S', use: { ...devices['Galaxy S9+'] } },
    { name: 'iPhone', use: iphone },
  ],
});
