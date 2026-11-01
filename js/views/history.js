// « Historique » : toutes les questions jouées, filtrables par catégorie (rien ne trahit leur origine).
import { h } from '../ui/dom.js';
import { card } from '../ui/card.js';
import { statusChip, categoryChip } from '../ui/status.js';
import { messageFor } from '../api/errors.js';
import { loadGame, players, textFor, answerLabel } from '../game.js';
import { answersOf, roundStatus, pointFor } from '../logic/scoring.js';
import { sortForDisplay } from '../logic/draw.js';
import { CATEGORIES, CATEGORY_LABELS, decodeCategory } from '../logic/category.js';
import { formatDay, todayParis } from '../logic/dates.js';
import { readQuery } from './report.js';

function filters(active, present) {
  const cats = CATEGORIES.filter((c) => present.has(c));
  return h('div', { class: 'chip-filter', role: 'tablist', 'aria-label': 'Filtrer par catégorie' },
    [['', 'Tout'], ...cats.map((c) => [c, CATEGORY_LABELS[c]])].map(([c, label]) =>
      h('a', { class: 'chip' + (active === c || (!active && !c) ? ' chip--gold' : ''), href: c ? `#/history?cat=${c}` : '#/history', role: 'tab', 'data-cat': c || 'all' }, label)));
}

function item(r, game, me, them, names) {
  const status = roundStatus(r, game.answers, game.judgments, me);
  const a = answersOf(r.id, game.answers);
  const pt = pointFor(r, game.answers, game.judgments, me);
  return h('a', { class: 'card history-item', href: `#/round/${encodeURIComponent(r.id)}`, 'data-round': r.id },
    h('div', { class: 'row' }, categoryChip(r.category), statusChip(status), pt === 1 ? h('span', { class: 'chip chip--gold' }, '+1') : null),
    h('p', { class: 'round-card-text' }, textFor(r.text, me, names)),
    a[me] && a[them] ? h('p', { class: 'small muted' },
      `Toi : ${answerLabel(r, a[me].self_answer, me, names)} · ${names[them]} : ${answerLabel(r, a[them].self_answer, them, names)}`) : null);
}

export async function render() {
  const { cat } = readQuery();
  let game;
  try {
    game = await loadGame({ to: todayParis() });
  } catch (error) {
    return h('section', { class: 'view stack', 'data-view': 'history' }, h('h1', {}, 'Historique'), card(h('p', { role: 'alert' }, messageFor(error))));
  }
  const { me, them, names } = players();
  const present = new Set(game.rounds.map((r) => decodeCategory(r.category).category));
  const shown = game.rounds.filter((r) => !cat || decodeCategory(r.category).category === cat);
  const days = [...new Set(shown.map((r) => r.play_date))].sort().reverse();

  return h('section', { class: 'view stack', 'data-view': 'history' },
    h('h1', {}, 'Historique'),
    filters(cat, present),
    days.length
      ? days.map((d) => h('div', { class: 'stack history-day' },
        h('h2', { class: 'history-date' }, formatDay(d)),
        sortForDisplay(shown.filter((r) => r.play_date === d)).map((r) => item(r, game, me, them, names))))
      : h('p', { class: 'empty' }, h('span', { class: 'emoji' }, '📭'), 'Rien à afficher pour l’instant.'));
}
