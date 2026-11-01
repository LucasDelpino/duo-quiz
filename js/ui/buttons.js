import { h } from './dom.js';

/** Bouton du design system. variant : primary | coral | teal | ghost. */
export function button(label, { variant = 'primary', block = false, size, type = 'button', onClick, ...attrs } = {}) {
  const cls = ['btn', `btn--${variant}`, block && 'btn--block', size && `btn--${size}`].filter(Boolean).join(' ');
  return h('button', { type, class: cls, onClick, ...attrs }, label);
}
