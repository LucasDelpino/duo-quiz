// Service worker Duo Quiz : app utilisable hors ligne (coquille + banque en cache).
// Stratégie : réseau d'abord (toujours la dernière version en ligne), cache en repli hors ligne.
// Les appels Supabase ne sont JAMAIS mis en cache (données privées, toujours fraîches).
const VERSION = 'duo-quiz-v8';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'data/questions.json',
  'assets/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon.svg',
  'assets/icons/maskable-192.png',
  'assets/icons/maskable-512.png',
  'assets/fonts/fredoka-latin-500-normal.woff2',
  'assets/fonts/fredoka-latin-600-normal.woff2',
  'assets/fonts/fredoka-latin-700-normal.woff2',
  'assets/fonts/nunito-latin-400-normal.woff2',
  'assets/fonts/nunito-latin-600-normal.woff2',
  'assets/fonts/nunito-latin-700-normal.woff2',
  'assets/fonts/nunito-latin-800-normal.woff2',
  'js/app.js',
  'js/config.js',
  'js/context.js',
  'js/game.js',
  'js/router.js',
  'js/store.js',
  'js/vendor.js',
  'js/api/demo-data.js',
  'js/api/errors.js',
  'js/api/index.js',
  'js/api/memory.js',
  'js/api/supabase.js',
  'js/logic/analysis.js',
  'js/logic/category.js',
  'js/logic/compat.js',
  'js/logic/progress.js',
  'js/logic/pace.js',
  'js/logic/home.js',
  'js/push.js',
  'js/logic/invite.js',
  'js/ui/qr.js',
  'js/ui/manifest.js',
  'js/vendor/qrcode.js',
  'js/logic/custom.js',
  'js/logic/dates.js',
  'js/logic/draw.js',
  'js/logic/normalize.js',
  'js/logic/report.js',
  'js/logic/scoring.js',
  'js/ui/buttons.js',
  'js/ui/card.js',
  'js/ui/confetti.js',
  'js/ui/counter.js',
  'js/ui/dom.js',
  'js/ui/form.js',
  'js/ui/gauge.js',
  'js/ui/motion.js',
  'js/ui/platform.js',
  'js/ui/share.js',
  'js/ui/sound.js',
  'js/ui/status.js',
  'js/ui/toast.js',
  'js/views/add.js',
  'js/views/history.js',
  'js/views/install.js',
  'js/views/join.js',
  'js/views/link.js',
  'js/views/love.js',
  'js/views/onboarding.js',
  'js/views/report.js',
  'js/views/round.js',
  'js/views/settings.js',
  'js/views/setup.js',
  'js/views/styleguide.js',
  'js/views/today.js',
];

// supabase-js (CDN) : mis en cache pour que l'app démarre hors ligne.
const CDN = 'https://esm.sh/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !request.url.startsWith(CDN)) return; // Supabase & co : réseau direct, jamais de cache
  event.respondWith(networkFirst(request));
});

// ---------- Notifications push (envoyées par l'Edge Function « notify-partner ») ----------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Duo Quiz 💞';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Ton/ta partenaire a joué. À toi !',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    tag: data.tag || 'duo-quiz',
    renotify: true,
    data: { url: data.url || './#/today' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#/today', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        if ('navigate' in w) await w.navigate(target).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
