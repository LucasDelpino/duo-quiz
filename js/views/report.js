// « Bilan » : stats de la période (identiques sur les 2 téléphones), gagnant, surprises, partage.
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { animateCount } from '../ui/counter.js';
import { share } from '../ui/share.js';
import { messageFor } from '../api/errors.js';
import { go } from '../context.js';
import { loadGame, loadRoom, players, textFor, answerLabel } from '../game.js';
import { buildReport, periodBounds, shareText } from '../logic/report.js';
import { todayParis, addDays, diffDays, formatShort, isISODate } from '../logic/dates.js';
import { categoryLabel } from '../logic/category.js';

const PERIODS = [['current', 'En cours'], ['previous', 'Précédente'], ['custom', 'Personnalisée'], ['all', 'Depuis le début']];

export function readQuery(hash = location.hash) {
  const q = new URLSearchParams(hash.split('?')[1] || '');
  return { p: q.get('p') || 'current', from: q.get('from'), to: q.get('to'), cat: q.get('cat') };
}

/** Période choisie + période de comparaison (pour l'évolution). */
export function choosePeriod(room, query, today) {
  if (query.p === 'all') return { period: periodBounds(room, 'all', today), previous: null };
  if (query.p === 'custom' && isISODate(query.from) && isISODate(query.to) && query.from <= query.to) {
    return { period: { from: query.from, to: query.to }, previous: null };
  }
  if (query.p === 'previous') {
    const period = periodBounds(room, 'previous', today);
    const len = diffDays(period.from, period.to) + 1;
    return { period, previous: { from: addDays(period.from, -len), to: addDays(period.from, -1) } };
  }
  const period = periodBounds(room, 'current', today);
  const len = diffDays(period.from, period.to) + 1;
  return { period, previous: { from: addDays(period.from, -len), to: addDays(period.from, -1) } };
}

const signed = (n, unit = '') => (n > 0 ? `+${n}${unit}` : `${n}${unit}`);

function playerCard(p, report, me) {
  const P = report.players[p];
  const pts = h('span', { class: 'score', 'data-testid': `report-points-${p}` }, '0');
  animateCount(pts, P.points, { from: 0 });
  const evo = report.evolution?.[p];
  return card([
    h('h2', {}, p === me ? `${P.name} (toi)` : P.name),
    h('div', { class: 'row' }, pts, h('span', { class: 'muted' }, P.points > 1 ? 'points' : 'point')),
    h('dl', { class: 'recap' },
      h('dt', {}, 'Précision'), h('dd', { 'data-testid': `report-accuracy-${p}` }, P.accuracy === null ? '—' : `${P.accuracy} %`),
      h('dt', {}, 'Point fort'), h('dd', {}, P.best ? categoryLabel(P.best) : '—'),
      h('dt', {}, 'À travailler'), h('dd', {}, P.worst ? categoryLabel(P.worst) : '—'),
      evo ? h('dt', {}, 'Évolution') : null,
      evo ? h('dd', {}, `${signed(evo.points, ' pt')}${evo.accuracy === null ? '' : ` · ${signed(evo.accuracy, ' %')}`}`) : null),
  ], { variant: report.winner === p ? 'gold' : undefined, 'data-testid': `report-player-${p}` });
}

function surprisesCard(report, me, names) {
  if (!report.surprises.length) return null;
  return card([
    h('h2', {}, 'Tu ne l’aurais jamais deviné 😮'),
    h('ol', { class: 'surprises' }, report.surprises.map((s) => {
      const round = { kind: s.kind };
      return h('li', {},
        h('p', { class: 'small muted' }, textFor(s.text, me, names)),
        h('p', {}, `${names[s.guesser]} pensait « ${answerLabel(round, s.guess, s.target, names)} », mais ${names[s.target]} a répondu « ${answerLabel(round, s.actual, s.target, names)} ».`));
    })),
  ], { 'data-testid': 'surprises' });
}

function periodPicker(query, period) {
  const nav = h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Période' },
    PERIODS.map(([id, label]) => h('a', {
      class: 'segment' + (query.p === id ? ' is-active' : ''), role: 'tab', 'aria-selected': String(query.p === id),
      href: id === 'custom' ? `#/report?p=custom&from=${period.from || ''}&to=${period.to}` : `#/report?p=${id}`, 'data-period': id,
    }, label)));
  if (query.p !== 'custom') return nav;
  const from = h('input', { type: 'date', class: 'input', id: 'from', value: period.from || '', 'aria-label': 'Du' });
  const to = h('input', { type: 'date', class: 'input', id: 'to', value: period.to, 'aria-label': 'Au' });
  const apply = () => { if (from.value && to.value) go(`#/report?p=custom&from=${from.value}&to=${to.value}`); };
  from.addEventListener('change', apply);
  to.addEventListener('change', apply);
  return h('div', { class: 'stack' }, nav, h('div', { class: 'date-range' }, from, to));
}

export async function render() {
  const query = readQuery();
  const today = todayParis();
  let room;
  let game;
  try {
    [room, game] = await Promise.all([loadRoom(), loadGame({ to: today })]);
  } catch (error) {
    return h('section', { class: 'view stack', 'data-view': 'report' }, h('h1', {}, 'Bilan'), card(h('p', { role: 'alert' }, messageFor(error))));
  }
  const { me, names } = players();
  const { period, previous } = choosePeriod(room, query, today);
  const report = buildReport(game, period, { names, previous });
  const range = period.from ? `Du ${formatShort(period.from)} au ${formatShort(period.to)}` : `Jusqu’au ${formatShort(period.to)}`;

  return h('section', { class: 'view stack', 'data-view': 'report' },
    h('h1', {}, 'Bilan'),
    periodPicker(query, period),
    card([
      h('p', { class: 'small muted', 'data-testid': 'report-range' }, range),
      h('p', { class: 'title report-title', 'data-testid': 'report-title' }, report.title),
      h('p', { class: 'small' }, `${report.complete} manche${report.complete > 1 ? 's' : ''} complète${report.complete > 1 ? 's' : ''} · série en cours : ${report.streak.current} jour${report.streak.current > 1 ? 's' : ''} (record ${report.streak.best})`),
    ], { variant: 'gold' }),
    h('div', { class: 'report-players' }, playerCard(1, report, me), playerCard(2, report, me)),
    surprisesCard(report, me, names),
    button('Partager le bilan', { variant: 'teal', block: true, 'data-testid': 'share-report', onClick: () => share({ title: 'Bilan Duo Quiz', text: shareText(report) }) }),
    h('a', { class: 'btn btn--ghost btn--block', href: '#/history' }, 'Voir l’historique'));
}
