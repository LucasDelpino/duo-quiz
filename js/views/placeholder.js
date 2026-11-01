// Écran provisoire, remplacé étape par étape (voir ROADMAP.md).
import { h } from '../ui/dom.js';

export function render({ route }) {
  return h('section', { class: 'view', 'data-view': route.name },
    h('h1', {}, route.title),
    h('p', { class: 'muted' }, 'Bientôt disponible ✨'),
  );
}
