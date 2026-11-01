// #/link/CODE : connecte ce téléphone à une partie existante (l'ancien appareil est déconnecté).
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { errorBox, busy } from '../ui/form.js';
import { messageFor } from '../api/errors.js';
import { go } from '../context.js';
import { claimLink, cleanCode } from './onboarding.js';

export function render({ params }) {
  const code = cleanCode(params.code);
  const err = errorBox();
  const btn = button('Connecter ce téléphone', { size: 'lg', block: true, 'data-testid': 'claim' });
  btn.addEventListener('click', async () => {
    err.show(null);
    try {
      await busy(btn, () => claimLink(code));
      go('#/today');
    } catch (error) {
      err.show(messageFor(error));
    }
  });
  return h('section', { class: 'view stack', 'data-view': 'link' },
    h('div', { class: 'hero center' }, h('p', { class: 'hero-emoji', 'aria-hidden': 'true' }, '📲'), h('h1', {}, 'Connecter ce téléphone')),
    card([
      h('p', {}, 'Code de connexion :'),
      h('p', { class: 'code' }, code),
      h('p', { class: 'notice' }, 'Ton ancien appareil (ou Safari, si tu passes à l’app installée) sera déconnecté de la partie. C’est normal !'),
      err, btn,
      h('a', { href: '#/setup', class: 'btn btn--ghost btn--block' }, 'Annuler'),
    ]));
}
