// Point d'entrée : routeur hash + barre d'onglets.
import { resolve, hrefOf, TABS } from './router.js';
import { hasSession } from './store.js';
import { apiMode } from './api/index.js';
import { h, clear } from './ui/dom.js';
import { captureInstallPrompt } from './ui/platform.js';

// Chargement paresseux des écrans : chaque vue exporte render(ctx) → Node (ou Promise<Node>).
const VIEWS = {
  setup: () => import('./views/setup.js'),
  join: () => import('./views/join.js'),
  link: () => import('./views/link.js'),
  install: () => import('./views/install.js'),
  today: () => import('./views/today.js'),
  round: () => import('./views/round.js'),
  add: () => import('./views/add.js'),
  report: () => import('./views/report.js'),
  history: () => import('./views/history.js'),
  love: () => import('./views/love.js'),
  settings: () => import('./views/settings.js'),
  styleguide: () => import('./views/styleguide.js'),
};

async function loadView(name) {
  const loader = VIEWS[name];
  if (!loader) throw new Error(`Écran inconnu : ${name}`);
  return loader();
}

function renderTabs(nav, activeTab) {
  clear(nav);
  for (const tab of TABS) {
    const active = tab.id === activeTab;
    nav.append(h('a', {
      class: 'tab' + (active ? ' is-active' : ''),
      href: tab.href,
      'data-tab': tab.id,
      'aria-current': active ? 'page' : false,
    }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, tab.icon), h('span', { class: 'tab-label' }, tab.label)));
  }
}

let renderToken = 0;
let lastRender = 0;
let currentRoute = null;
// Écrans rafraîchis au retour au premier plan / en tirant vers le bas (pas un round en cours de saisie).
const REFRESHABLE = new Set(['today', 'report', 'love', 'history']);

async function render() {
  const token = ++renderToken;
  const main = document.getElementById('app');
  const nav = document.getElementById('tabs');
  const match = resolve(location.hash, hasSession());
  currentRoute = match.route.name;
  lastRender = Date.now();
  if (match.redirected) history.replaceState(null, '', hrefOf(match));

  const showTabs = match.route.tabs !== false;
  nav.hidden = !showTabs;
  if (showTabs) renderTabs(nav, match.route.tab);
  document.title = `${match.route.title} · Duo Quiz`;

  let node;
  try {
    const mod = await loadView(match.route.name);
    node = await mod.render({ route: match.route, params: match.params, mode: apiMode() });
  } catch (error) {
    console.warn('Écran indisponible', error?.code || error?.name);
    node = h('section', { class: 'view stack', 'data-view': 'error' },
      h('h1', {}, 'Oups 😅'), h('p', {}, 'Cet écran n’a pas pu s’afficher.'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => location.reload() }, 'Réessayer'));
  }
  if (token !== renderToken) return; // une navigation plus récente a eu lieu
  clear(main).append(node);
  main.focus({ preventScroll: true });
}

function refreshIfStale(minAgeMs) {
  if (REFRESHABLE.has(currentRoute) && Date.now() - lastRender > minAgeMs) render();
}

function pullToRefresh() {
  let startY = null;
  window.addEventListener('touchstart', (e) => { startY = window.scrollY <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (startY !== null && e.changedTouches[0].clientY - startY > 90) refreshIfStale(0);
    startY = null;
  }, { passive: true });
}

function watchConnectivity() {
  const banner = document.getElementById('offline-banner');
  const update = () => { banner.hidden = navigator.onLine !== false; };
  window.addEventListener('online', () => { update(); refreshIfStale(0); });
  window.addEventListener('offline', update);
  update();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Nouvelle version installée → l'app se recharge une fois (seulement si une version précédente tournait déjà).
  // Uniquement si une NOUVELLE version a été trouvée pendant que cette page tournait (jamais au 1er install).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let updateFound = false;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || !updateFound || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.addEventListener('updatefound', () => { if (hadController) updateFound = true; });
        reg.update().catch(() => {});
        // Vérifie aussi les mises à jour à chaque retour au premier plan.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => { /* hors ligne non disponible : pas bloquant */ });
  });
}

function start() {
  watchConnectivity();
  registerServiceWorker();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshIfStale(3000);
  });
  pullToRefresh();
  captureInstallPrompt(window);
  document.documentElement.dataset.mode = apiMode();
  document.getElementById('demo-badge').hidden = apiMode() !== 'memory';
  window.addEventListener('hashchange', render);
  render();
}

start();
