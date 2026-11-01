// Routeur hash : fonctions pures (testées) utilisées par app.js.

export const ROUTES = [
  { name: 'setup', path: '/setup', title: 'Bienvenue', tabs: false, public: true },
  { name: 'join', path: '/join/:code', title: 'Rejoindre', tabs: false, public: true },
  { name: 'link', path: '/link/:code', title: 'Connecter cet appareil', tabs: false, public: true },
  { name: 'install', path: '/install', title: 'Installer l’app', tabs: false, public: true },
  { name: 'today', path: '/today', title: "Aujourd'hui", tab: 'today' },
  { name: 'round', path: '/round/:id', title: 'Question', tab: 'today' },
  { name: 'add', path: '/add', title: 'Ajouter', tab: 'add' },
  { name: 'report', path: '/report', title: 'Bilan', tab: 'report' },
  { name: 'love', path: '/love', title: 'Love report', tab: 'love' },
  { name: 'history', path: '/history', title: 'Historique', tab: 'more' },
  { name: 'settings', path: '/settings', title: 'Réglages', tab: 'more' },
  { name: 'styleguide', path: '/styleguide', title: 'Styleguide', tabs: false, public: true },
];

export const TABS = [
  { id: 'today', label: "Aujourd'hui", icon: '🎯', href: '#/today' },
  { id: 'add', label: 'Ajouter', icon: '✍️', href: '#/add' },
  { id: 'report', label: 'Bilan', icon: '🏆', href: '#/report' },
  { id: 'love', label: 'Love', icon: '💞', href: '#/love' },
  { id: 'more', label: 'Plus', icon: '☰', href: '#/settings' },
];

function matchPath(pattern, path) {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      try {
        params[a[i].slice(1)] = decodeURIComponent(b[i]);
      } catch {
        return null;
      }
    } else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** '#/join/ABC?x=1' → { route, params } ; null si aucune route ne correspond. */
export function parseHash(hash = '') {
  const path = hash.replace(/^#/, '').split('?')[0] || '/';
  for (const route of ROUTES) {
    const params = matchPath(route.path, path);
    if (params) return { route, params };
  }
  return null;
}

/** Route par défaut : setup tant que l'appareil n'a pas de session. */
export function defaultHash(hasSession) {
  return hasSession ? '#/today' : '#/setup';
}

/**
 * Résout le hash courant : routes inconnues → défaut, écrans de jeu → setup sans session,
 * setup → aujourd'hui avec session. `redirected` indique qu'il faut corriger l'URL.
 */
export function resolve(hash, hasSession) {
  const match = parseHash(hash);
  const ok = match && (match.route.public || hasSession) && !(hasSession && match.route.name === 'setup');
  if (ok) return { ...match, redirected: false };
  return { ...parseHash(defaultHash(hasSession)), redirected: true };
}

/** Hash canonique d'une route résolue. */
export function hrefOf(match) {
  return '#' + match.route.path.replace(/:(\w+)/g, (_, k) => encodeURIComponent(match.params[k] ?? ''));
}
