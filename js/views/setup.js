// Écran d'accueil : créer une partie, rejoindre, retrouver sa partie, ou démo solo.
import { h, clear } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { field, errorBox, busy } from '../ui/form.js';
import { share, copy } from '../ui/share.js';
import { messageFor } from '../api/errors.js';
import { appBaseUrl, go } from '../context.js';
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
  const link = `${appBaseUrl()}#/join/${code}`;
  return card([
    h('h2', {}, onboarding ? 'Partie créée 🎉' : 'Invitation en attente'),
    h('p', {}, 'Envoie ce code (ou le lien) à ton/ta partenaire pour qu’il ou elle te rejoigne :'),
    h('p', { class: 'code', 'data-testid': 'invite-code' }, code),
    h('p', { class: 'small muted link-text', 'data-testid': 'invite-link' }, link),
    h('div', { class: 'row' },
      button('Partager', { variant: 'teal', onClick: () => share({ title: 'Duo Quiz', text: `Rejoins-moi sur Duo Quiz avec le code ${code} 💞`, url: link }) }),
      button('Copier le lien', { variant: 'ghost', onClick: () => copy(link) })),
    h('p', { class: 'small muted' }, 'Ce code reste visible dans Réglages tant que ton/ta partenaire n’a pas rejoint.'),
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
    field({ id: 'join-code', label: 'Code d’invitation', placeholder: 'AB12CD34', ...CODE, enterkeyhint: 'next' }),
    field({ id: 'join-name', label: 'Ton prénom', ...NAME, enterkeyhint: 'go' }),
    button('Rejoindre', { type: 'submit', variant: 'teal', block: true }),
  ], async (data) => {
    await joinGame(cleanCode(data.get('join-code')), String(data.get('join-name') || ''));
    go('#/install');
  });

  const link = form('link-form', [
    field({ id: 'link-code', label: 'Code de connexion', hint: 'À générer depuis ton autre appareil : Réglages → Connecter un autre appareil.', ...CODE }),
    button('Connecter cet appareil', { type: 'submit', variant: 'ghost', block: true }),
  ], async (data) => {
    await claimLink(cleanCode(data.get('link-code')));
    go('#/today');
  });

  root.append(
    h('div', { class: 'hero center' },
      h('p', { class: 'hero-emoji', 'aria-hidden': 'true' }, '💞'),
      h('h1', {}, 'Duo Quiz'),
      h('p', { class: 'muted' }, 'Chaque jour, répondez aux mêmes questions et devinez la réponse de l’autre. Qui connaît le mieux l’autre ?')),
    card([h('h2', {}, 'Nouvelle partie'), create]),
    card([h('h2', {}, 'Rejoindre ton/ta partenaire'), join]),
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
