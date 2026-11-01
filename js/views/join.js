// Lien d'invitation #/join/CODE : il ne reste qu'à saisir son prénom.
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { field, errorBox, busy } from '../ui/form.js';
import { messageFor } from '../api/errors.js';
import { go, currentSession } from '../context.js';
import { joinGame, cleanCode } from './onboarding.js';

export function render({ params }) {
  const err = errorBox();
  const f = h('form', { id: 'join-form', class: 'stack', novalidate: true },
    field({ id: 'join-code', label: 'Code d’invitation', value: cleanCode(params.code), maxlength: 8, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', required: true }),
    field({ id: 'join-name', label: 'Ton prénom', autocomplete: 'given-name', maxlength: 30, required: true, enterkeyhint: 'go', autocapitalize: 'words' }),
    err,
    button('Rejoindre la partie', { type: 'submit', block: true, size: 'lg' }));
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
  return h('section', { class: 'view stack', 'data-view': 'join' },
    h('div', { class: 'hero center' }, h('p', { class: 'hero-emoji', 'aria-hidden': 'true' }, '💌'), h('h1', {}, 'On t’attend !'),
      h('p', { class: 'muted' }, 'Ton/ta partenaire t’a invité·e à jouer à Duo Quiz.')),
    currentSession() ? h('p', { class: 'notice' }, 'Ce téléphone est déjà connecté à une partie : rejoindre celle-ci la remplacera.') : null,
    card(f));
}
