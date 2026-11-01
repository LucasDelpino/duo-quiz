// Point d'entrée : routeur hash + barre d'onglets.
import { parseHash, resolve, TABS } from './router.js';
import { hasSession } from './store.js';
import { apiMode } from './api/index.js';
import { h, clear } from './ui/dom.js';

// Chargement paresseux des écrans : chaque vue exporte render(ctx) → Node (ou Promise<Node>).
const VIEWS = {};

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
  if (!parseHash(location.hash)) history.replaceState(null, '', '#' + match.route.path);

  const showTabs = match.route.tabs !== false;
  nav.hidden = !showTabs;
  if (showTabs) renderTabs(nav, match.route.tab);
  document.title = `${match.route.title} · Duo Quiz`;

  const mod = await loadView(match.route.name);
  const node = await mod.render({ route: match.route, params: match.params, mode: apiMode() });
  if (token !== renderToken) return; // une navigation plus récente a eu lieu
  clear(main).append(node);
  main.focus({ preventScroll: true });
}

function start() {
  document.documentElement.dataset.mode = apiMode();
  document.getElementById('demo-badge').hidden = apiMode() !== 'memory';
  window.addEventListener('hashchange', render);
  render();
}

start();
