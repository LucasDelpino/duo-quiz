import { h } from './dom.js';

/** Champ libellé + input (16 px minimum : pas de zoom auto sur iOS). */
export function field({ id, label, hint, textarea = false, ...attrs }) {
  const input = h(textarea ? 'textarea' : 'input', { id, name: id, class: textarea ? 'textarea' : 'input', ...attrs });
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    input,
    hint ? h('small', { class: 'muted', id: `${id}-hint` }, hint) : null,
  );
}

/** Zone d'erreur accessible ; `show(msg)` / `show(null)`. */
export function errorBox() {
  const el = h('p', { class: 'form-error', role: 'alert', hidden: true });
  el.show = (msg) => {
    el.textContent = msg || '';
    el.hidden = !msg;
  };
  return el;
}

/** Désactive le bouton pendant une action asynchrone. */
export async function busy(button, fn) {
  const label = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = label;
  }
}
