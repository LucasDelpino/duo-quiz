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
  styleguide: () => import('./views/styleguide.js'),
};

async function loadView(name) {
  const loader = VIEWS[name];
  return loader ? loader() : import('./views/placeholder.js');
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

async function render() {
  const token = ++renderToken;
  const main = document.getElementById('app');
  const nav = document.getElementById('tabs');
  const match = resolve(location.hash, hasSession());
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

function start() {
  captureInstallPrompt(window);
  document.documentElement.dataset.mode = apiMode();
  document.getElementById('demo-badge').hidden = apiMode() !== 'memory';
  window.addEventListener('hashchange', render);
  render();
}

start();
