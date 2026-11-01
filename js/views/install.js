// « Installer l'app » adapté à l'appareil : Android (invite native) / iPhone (tuto Partager → écran d'accueil).
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { errorBox, busy } from '../ui/form.js';
import { copy } from '../ui/share.js';
import { messageFor } from '../api/errors.js';
import { detectPlatform, isStandalone, canPromptInstall, onInstallAvailability, promptInstall } from '../ui/platform.js';
import { getApi, currentSession, appBaseUrl, go } from '../context.js';

const NS = 'http://www.w3.org/2000/svg';
function icon(paths) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'step-icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}
// Icônes iOS dessinées à la main : « Partager » (carré + flèche) et « Ajouter » (carré +).
const SHARE_ICON = ['M12 3v12', 'M8 7l4-4 4 4', 'M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1'];
const ADD_ICON = ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M12 8v8', 'M8 12h8'];

const step = (n, text, ico) => h('li', { class: 'step' }, h('span', { class: 'step-n', 'aria-hidden': 'true' }, String(n)), h('span', {}, text), ico || null);

export function iosTutorial() {
  return h('ol', { class: 'steps', 'data-testid': 'ios-steps' },
    step(1, 'Ouvre ce lien dans Safari.'),
    step(2, 'Touche le bouton Partager, en bas de l’écran.', icon(SHARE_ICON)),
    step(3, 'Fais défiler et choisis « Sur l’écran d’accueil ».', icon(ADD_ICON)),
    step(4, 'Touche « Ajouter », puis ouvre Duo Quiz depuis l’écran d’accueil.'));
}

export function androidTutorial() {
  return h('ol', { class: 'steps', 'data-testid': 'android-steps' },
    step(1, 'Ouvre ce lien dans Chrome.'),
    step(2, 'Touche le menu ⋮ en haut à droite.'),
    step(3, 'Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).'),
    step(4, 'Ouvre Duo Quiz depuis l’écran d’accueil.'));
}

function androidCard() {
  const btn = button('Installer Duo Quiz', { size: 'lg', block: true, 'data-testid': 'install-btn', hidden: !canPromptInstall() });
  btn.addEventListener('click', async () => {
    if ((await promptInstall()) === 'accepted') btn.hidden = true;
  });
  onInstallAvailability((available) => { btn.hidden = !available; });
  return card([h('h2', {}, 'Sur ton Android'), btn, androidTutorial()], { 'data-testid': 'install-android' });
}

/** iPhone : l'app installée a son propre stockage → on prépare un code de connexion. */
function iosLinkCard() {
  const err = errorBox();
  const out = h('div', { 'data-testid': 'device-link', hidden: true });
  const btn = button('Générer un code pour l’app installée', { variant: 'teal', block: true, 'data-testid': 'make-link' });
  btn.addEventListener('click', async () => {
    err.show(null);
    try {
      const code = await busy(btn, async () => (await getApi()).createDeviceLink());
      const url = `${appBaseUrl()}#/link/${code}`;
      out.replaceChildren(
        h('p', { class: 'code', 'data-testid': 'link-code' }, code),
        h('p', { class: 'small muted' }, 'Valable 15 minutes. Dans l’app installée : « Retrouver notre partie sur ce téléphone » → saisis ce code. Safari sera alors déconnecté, c’est normal.'),
        button('Copier le lien', { variant: 'ghost', onClick: () => copy(url) }));
      out.hidden = false;
    } catch (error) {
      err.show(messageFor(error));
    }
  });
  return card([
    h('h2', {}, 'Important sur iPhone'),
    h('p', { class: 'small' }, 'L’app installée ne partage pas la mémoire de Safari : elle s’ouvrira sans ta partie. Génère un code ici avant de l’ouvrir.'),
    btn, err, out,
  ], { 'data-testid': 'install-ios-link' });
}

export function render() {
  const platform = detectPlatform();
  const session = currentSession();
  const next = session ? '#/today' : '#/setup';
  const root = h('section', { class: 'view stack', 'data-view': 'install', 'data-platform': platform },
    h('div', { class: 'hero center' }, h('p', { class: 'hero-emoji', 'aria-hidden': 'true' }, '📱'), h('h1', {}, 'Installer l’app'),
      h('p', { class: 'muted' }, 'Duo Quiz s’installe comme une vraie app, sans passer par un store.')));

  if (isStandalone()) {
    root.append(card([h('p', { class: 'title' }, 'C’est installé ✅'), h('p', { class: 'muted' }, 'Tu utilises déjà l’app depuis ton écran d’accueil.')]));
  } else if (platform === 'ios') {
    root.append(card([h('h2', {}, 'Sur ton iPhone'), iosTutorial()], { 'data-testid': 'install-ios' }));
    if (session) root.append(iosLinkCard());
  } else {
    root.append(androidCard());
  }

  root.append(
    h('details', { class: 'card' }, h('summary', {}, platform === 'ios' ? 'Et sur Android ?' : 'Et sur iPhone ?'),
      platform === 'ios' ? androidTutorial() : iosTutorial()),
    button(session ? 'C’est parti !' : 'Retour', { size: 'lg', block: true, 'data-testid': 'install-done', onClick: () => go(next) }));
  return root;
}
