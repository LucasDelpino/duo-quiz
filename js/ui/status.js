// Badges d'état d'un round et chip de catégorie (identiques pour toutes les questions : anonymat).
import { h } from './dom.js';
import { categoryLabel } from '../logic/category.js';

const STATUS = {
  todo: ['À jouer', 'chip--gold'],
  waiting: ['En attente', ''],
  to_judge: ['À valider', 'chip--coral'],
  revealed: ['Révélée', 'chip--teal'],
};

export function statusChip(status) {
  const [label, cls] = STATUS[status] || STATUS.todo;
  return h('span', { class: `chip ${cls}`.trim(), 'data-status': status }, label);
}

export const categoryChip = (raw) => h('span', { class: 'chip' }, categoryLabel(raw));
