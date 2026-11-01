import { h } from './dom.js';
import { prefersReducedMotion, waitFor } from './motion.js';

/** Carte « plateau ». La même pour toutes les questions (banque ou perso : indiscernables). */
export function card(children, { variant, ...attrs } = {}) {
  return h('div', { class: 'card' + (variant ? ` card--${variant}` : ''), ...attrs }, children);
}

/** Carte qui se retourne : face cachée (`front`) puis contenu (`back`). */
export function flipCard({ front = '?', back, label = 'Carte' } = {}) {
  return h('div', { class: 'flip', role: 'group', 'aria-label': label },
    h('div', { class: 'flip-inner' },
      h('div', { class: 'flip-face flip-front card', 'aria-hidden': 'true' }, front),
      h('div', { class: 'flip-face flip-back card', 'aria-hidden': 'true' }, back),
    ),
  );
}

/** Retourne la carte ; résout à la fin de l'animation (immédiat si mouvement réduit). */
export function reveal(el) {
  if (el.classList.contains('is-flipped')) return Promise.resolve();
  el.classList.add('is-flipped');
  el.querySelector('.flip-front')?.setAttribute('aria-hidden', 'true');
  el.querySelector('.flip-back')?.setAttribute('aria-hidden', 'false');
  if (prefersReducedMotion()) return Promise.resolve();
  return waitFor(el.querySelector('.flip-inner') || el, 'transitionend', 700);
}
