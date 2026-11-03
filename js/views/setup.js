// Écran d'accueil : créer une partie, rejoindre, retrouver sa partie, ou démo solo.
import { h, clear } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { field, errorBox, busy } from '../ui/form.js';
import { share, copy } from '../ui/share.js';
import { messageFor } from '../api/errors.js';
import { appBaseUrl, go, currentSession } from '../context.js';
import { buildInviteUrl, parseInvite } from '../logic/invite.js';
import { qrElement } from '../ui/qr.js';
import { toast } from '../ui/toast.js';
import { isStandalone } from '../ui/platform.js';
import { createGame, joinGame, claimLink, startSoloDemo, cleanCode } from './onboarding.js';

const NAME = { autocomplete: 'given-name', maxlength: 30, required: true, enterkeyhint: 'next', autocapitalize: 'words' };
const CODE = { maxlength: 8, required: true, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', inputmode: 'text', enterkeyhint: 'go' };

function form(id, children, onSubmit) {
  const err = errorBox();
  const f = h('form', { id, class: 'stack', novalidate: true }, children, err);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.show(null);
    const submit = f.querySelector('button[type="submit"]');
    try {
      await busy(submit, () => onSubmit(new FormData(f)));
    } catch (error) {
      err.show(messageFor(error));
    }
  });
  return f;
}

export function invitePanel(code, { onboarding = true } = {}) {
  const from = currentSession()?.names?.[1] || '';
  const linkText = h('p', { class: 'small muted link-text', 'data-testid': 'invite-link' });
  const qrBox = h('div', { 'data-testid': 'invite-qr' });
  const partner = field({ id: 'invite-partner', label: 'Prénom de ton/ta partenaire (facultatif)', maxlength: 30, autocomplete: 'off', autocapitalize: 'words', hint: 'Il ou elle n’aura qu’à toucher « Rejoindre ».' });
  const input = partner.querySelector('input');
  let link = '';
  const update = () => {
    link = buildInviteUrl(appBaseUrl(), code, { from, to: input.value });
    linkText.textContent = link;
    qrBox.replaceChildren(qrElement(link));
  };
  input.addEventListener('input', update);
  update();
  return card([
    h('h2', {}, onboarding ? 'Partie créée 🎉' : 'Invitation en attente'),
    h('p', {}, 'Envoie ce lien à ton/ta partenaire : il ou elle rejoindra la partie en une touche.'),
    partner,
    h('div', { class: 'row' },
      button('Envoyer l’invitation 💌', { variant: 'teal', 'data-testid': 'share-invite', onClick: () => share({ title: 'Duo Quiz', text: `${from ? from + ' t’invite' : 'Je t’invite'} à jouer à Duo Quiz 💞`, url: link }) }),
      button('Copier le lien', { variant: 'ghost', onClick: () => copy(link) })),
    h('details', { class: 'invite-qr-box' }, h('summary', {}, 'Vous êtes ensemble ? Afficher le QR code'),
      h('p', { class: 'small muted center' }, 'À scanner avec l’appareil photo de l’autre téléphone.'), qrBox),
    h('p', { class: 'small muted' }, 'Code (si besoin) : ', h('strong', { class: 'code-inline', 'data-testid': 'invite-code' }, code)),
    linkText,
    h('p', { class: 'small muted' }, 'L’invitation reste visible dans Plus tant que ton/ta partenaire n’a pas rejoint.'),
    onboarding ? button('Continuer', { size: 'lg', block: true, 'data-testid': 'continue', onClick: () => go('#/install') }) : null,
  ], { variant: 'gold', 'data-testid': 'invite' });
}

export function render({ mode }) {
  const root = h('section', { class: 'view stack', 'data-view': 'setup' });

  const create = form('create-form', [
    field({ id: 'create-name', label: 'Ton prénom', ...NAME, enterkeyhint: 'go' }),
    button('Créer notre partie', { type: 'submit', block: true, size: 'lg' }),
  ], async (data) => {
    const res = await createGame(String(data.get('create-name') || ''));
    clear(root).append(invitePanel(res.invite_code));
  });

  const join = form('join-form', [
    field({ id: 'join-code', label: 'Lien ou code d’invitation', placeholder: 'AB12CD34', ...CODE, maxlength: 300, enterkeyhint: 'next' }),
    field({ id: 'join-name', label: 'Ton prénom', ...NAME, enterkeyhint: 'go' }),
    button('Rejoindre', { type: 'submit', variant: 'teal', block: true }),
  ], async (data) => {
    const inv = parseInvite(data.get('join-code'));
    await joinGame(inv ? inv.code : cleanCode(data.get('join-code')), String(data.get('join-name') || ''));
    go('#/install');
  });

  const link = form('link-form', [
    field({ id: 'link-code', label: 'Code de connexion', hint: 'À générer depuis ton autre appareil : Réglages → Connecter un autre appareil.', ...CODE }),
    button('Connecter cet appareil', { type: 'submit', variant: 'ghost', block: true }),
  ], async (data) => {
    await claimLink(cleanCode(data.get('link-code')));
    go('#/today');
  });

  const pasteCard = card([
    h('h2', {}, 'Tu as reçu une invitation ? 💌'),
    h('p', { class: 'small muted' }, 'Copie le lien reçu, puis touche le bouton : tu rejoins la partie directement.'),
    button('Coller mon invitation', { variant: 'teal', block: true, size: 'lg', 'data-testid': 'paste-invite', onClick: async () => {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch { /* refusé ou indisponible */ }
      const inv = parseInvite(text);
      if (!inv) {
        toast('Aucune invitation trouvée dans le presse-papiers : colle le lien ou le code dans « Rejoindre ».', { type: 'error', duration: 4000 });
        root.querySelector('#join-code')?.focus();
        return;
      }
      const q = new URLSearchParams();
      if (inv.from) q.set('de', inv.from);
      if (inv.to) q.set('n', inv.to);
      go(`#/join/${inv.code}${q.toString() ? `?${q}` : ''}`);
    } }),
  ], { 'data-testid': 'paste-card' });

  root.append(
    h('div', { class: 'hero center' },
      h('p', { class: 'hero-emoji', 'aria-hidden': 'true' }, '💞'),
      h('h1', {}, 'Duo Quiz'),
      h('p', { class: 'muted' }, 'Chaque jour, répondez aux mêmes questions et devinez la réponse de l’autre. Qui connaît le mieux l’autre ?')),
    isStandalone() ? pasteCard : null,
    card([h('h2', {}, 'Nouvelle partie'), create]),
    card([h('h2', {}, 'Rejoindre ton/ta partenaire'), join]),
    isStandalone() ? null : pasteCard,
    h('details', { class: 'card' },
      h('summary', {}, 'Retrouver notre partie sur ce téléphone'),
      h('p', { class: 'small muted' }, 'Tu as installé l’app ou changé de téléphone ? Saisis un code de connexion (valable 15 minutes).'),
      link),
  );

  if (mode === 'memory') {
    const demo = form('demo-form', [
      field({ id: 'demo-name', label: 'Ton prénom', ...NAME, enterkeyhint: 'go' }),
      button('Jouer avec un partenaire simulé', { type: 'submit', variant: 'coral', block: true }),
    ], async (data) => {
      await startSoloDemo(String(data.get('demo-name') || ''));
      go('#/today');
    });
    root.append(card([h('h2', {}, 'Mode démo 🎭'), h('p', { class: 'small muted' }, 'Rien n’est envoyé sur Internet : les données restent sur ce téléphone.'), demo]));
  }
  return root;
}
