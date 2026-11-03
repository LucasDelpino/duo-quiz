// Lien d'invitation #/join/CODE?de=Lucas&n=Léa.
// Android / ordinateur / app déjà installée : une touche pour rejoindre (prénom pré-rempli).
// iPhone dans Safari : on installe d'abord (l'app installée ne partage pas la mémoire de Safari) ;
// l'app installée s'ouvre sur l'invitation (manifeste pointé dessus) et le lien est copié en secours.
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { field, errorBox, busy } from '../ui/form.js';
import { copy } from '../ui/share.js';
import { messageFor } from '../api/errors.js';
import { go, currentSession, appBaseUrl } from '../context.js';
import { joinGame, cleanCode } from './onboarding.js';
import { iosInviteSteps } from './install.js';
import { detectPlatform, isStandalone } from '../ui/platform.js';
import { pointManifestTo } from '../ui/manifest.js';
import { buildInviteUrl, hashQuery } from '../logic/invite.js';

function joinForm(code, to) {
  const err = errorBox();
  const f = h('form', { id: 'join-form', class: 'stack', novalidate: true },
    h('input', { type: 'hidden', id: 'join-code', name: 'join-code', value: code }),
    field({ id: 'join-name', label: 'Ton prénom', value: to, autocomplete: 'given-name', maxlength: 30, required: true, enterkeyhint: 'go', autocapitalize: 'words' }),
    err,
    button('Rejoindre la partie 💞', { type: 'submit', block: true, size: 'lg', 'data-testid': 'join-submit' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.show(null);
    const data = new FormData(f);
    try {
      await busy(f.querySelector('[type="submit"]'), () => joinGame(cleanCode(data.get('join-code')), String(data.get('join-name') || '')));
      go('#/install');
    } catch (error) {
      err.show(messageFor(error));
    }
  });
  return f;
}

export function render({ params }) {
  const code = cleanCode(params.code);
  const q = hashQuery(location.hash);
  const from = q.get('de') || '';
  const to = q.get('n') || '';
  const inviteUrl = buildInviteUrl(appBaseUrl(), code, { from, to });
  const iosFirst = detectPlatform() === 'ios' && !isStandalone() && !q.has('safari');

  const root = h('section', { class: 'view stack', 'data-view': 'join', 'data-flow': iosFirst ? 'ios-install' : 'one-tap' },
    h('div', { class: 'hero center' }, h('p', { class: 'hero-emoji', 'aria-hidden': 'true' }, '💌'),
      h('h1', { 'data-testid': 'join-title' }, from ? `${from} t’invite à jouer !` : 'On t’attend !'),
      h('p', { class: 'muted' }, 'Duo Quiz : chaque jour, répondez aux mêmes questions et devinez la réponse de l’autre.')),
    currentSession() ? h('p', { class: 'notice' }, 'Ce téléphone est déjà connecté à une partie : rejoindre celle-ci la remplacera.') : null);

  if (!iosFirst) {
    root.append(card([joinForm(code, to)], { variant: 'gold' }));
    return root;
  }

  // iPhone dans Safari : l'app installée doit s'ouvrir directement sur cette invitation.
  pointManifestTo(inviteUrl);
  const copyBtn = button('Copier mon invitation 📋', { variant: 'teal', block: true, 'data-testid': 'copy-invite', onClick: () => copy(inviteUrl) });
  const inBrowser = h('details', { class: 'card', 'data-testid': 'join-in-browser' },
    h('summary', {}, 'Jouer dans Safari sans installer'),
    h('p', { class: 'small muted' }, 'Possible, mais pas de notifications, et il faudra te reconnecter si tu installes l’app plus tard.'),
    joinForm(code, to));
  root.append(
    card([
      h('h2', {}, 'Sur iPhone, installe d’abord l’app 📱'),
      h('p', { class: 'small' }, 'Tu recevras les notifications, et ta partie sera dans l’app.'),
      iosInviteSteps(copyBtn),
    ], { variant: 'gold', 'data-testid': 'join-ios' }),
    inBrowser);
  return root;
}
