import { h } from './dom.js';

function region() {
  let el = document.getElementById('toasts');
  if (!el) {
    el = h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  return el;
}

/** Message éphémère. type : info | success | error. */
export function toast(message, { type = 'info', duration = 3000 } = {}) {
  const el = h('div', { class: `toast toast--${type}` }, message);
  region().append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, duration);
  return el;
}
