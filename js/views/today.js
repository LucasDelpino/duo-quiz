// « Aujourd'hui » : questions du jour, retards, validations en attente, score de la période.
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { statusChip, categoryChip } from '../ui/status.js';
import { animateCount } from '../ui/counter.js';
import { share } from '../ui/share.js';
import { ApiError, messageFor } from '../api/errors.js';
import { ensureToday, loadGame, loadRoom, players, textFor } from '../game.js';
import { todayParis, formatDay, formatShort, addDays } from '../logic/dates.js';
import { roundStatus, pointFor, scoreRounds } from '../logic/scoring.js';
import { sortForDisplay } from '../logic/draw.js';
import { periodBounds, roundsIn } from '../logic/report.js';
import { appBaseUrl, go, leave } from '../context.js';

const LOOKBACK_DAYS = 30;

function roundCard(round, game, me, names, { showDate = false } = {}) {
  const status = roundStatus(round, game.answers, game.judgments, me);
  const pt = status === 'revealed' || status === 'to_judge' ? pointFor(round, game.answers, game.judgments, me) : null;
  return h('a', { class: 'card round-card', href: `#/round/${encodeURIComponent(round.id)}`, 'data-round': round.id, 'data-status': status },
    h('div', { class: 'row round-card-head' }, categoryChip(round.category), statusChip(status),
      showDate ? h('span', { class: 'small muted' }, formatShort(round.play_date)) : null,
      pt === 1 ? h('span', { class: 'chip chip--gold' }, '+1') : null),
    h('p', { class: 'round-card-text' }, textFor(round.text, me, names)));
}

function scoreBanner(room, game, me, names, today) {
  const period = periodBounds(room, 'current', today);
  const s = scoreRounds(roundsIn(game.rounds, period), game.answers, game.judgments);
  const mine = h('span', { class: 'score', 'data-testid': 'score-me' }, '0');
  const theirs = h('span', { class: 'score', 'data-testid': 'score-them' }, '0');
  animateCount(mine, s[me].points, { from: 0 });
  animateCount(theirs, s[me === 1 ? 2 : 1].points, { from: 0 });
  return card([
    h('div', { class: 'score-banner' },
      h('div', { class: 'center' }, mine, h('div', { class: 'small' }, names[me])),
      h('div', { class: 'center small muted' }, 'Cette période', h('br'), `jusqu’au ${formatShort(period.to)}`),
      h('div', { class: 'center' }, theirs, h('div', { class: 'small' }, names[me === 1 ? 2 : 1]))),
  ], { variant: 'gold', 'data-testid': 'score-banner' });
}

function waitingPartner(room) {
  if (room.p2_name || !room.invite_code) return null;
  const link = `${appBaseUrl()}#/join/${room.invite_code}`;
  return card([
    h('h2', {}, 'Ton/ta partenaire n’a pas encore rejoint'),
    h('p', { class: 'code' }, room.invite_code),
    button('Envoyer l’invitation', { variant: 'teal', block: true, onClick: () => share({ text: `Rejoins-moi sur Duo Quiz avec le code ${room.invite_code} 💞`, url: link }) }),
  ], { 'data-testid': 'waiting-partner' });
}

function errorView(error) {
  const lost = error instanceof ApiError && error.code === 'unauthorized';
  return h('section', { class: 'view stack', 'data-view': 'today' },
    h('h1', {}, 'Aujourd’hui'),
    card([
      h('p', { role: 'alert' }, messageFor(error)),
      lost
        ? button('Rejoindre à nouveau', { block: true, onClick: () => { leave(); go('#/setup'); } })
        : button('Réessayer', { block: true, onClick: () => go('#/today') }),
    ]));
}

export async function render() {
  const today = todayParis();
  let room;
  let game;
  try {
    room = await loadRoom();
    await ensureToday(today);
    game = await loadGame({ from: addDays(today, -LOOKBACK_DAYS), to: today });
  } catch (error) {
    return errorView(error);
  }
  const { me, names } = players();
  const todays = sortForDisplay(game.rounds.filter((r) => r.play_date === today));
  const older = game.rounds.filter((r) => r.play_date < today);
  const late = sortForDisplay(older.filter((r) => ['todo', 'to_judge'].includes(roundStatus(r, game.answers, game.judgments, me))));
  const done = todays.every((r) => roundStatus(r, game.answers, game.judgments, me) === 'revealed');

  return h('section', { class: 'view stack', 'data-view': 'today' },
    h('div', {},
      h('h1', {}, 'Aujourd’hui'),
      h('p', { class: 'muted today-date' }, formatDay(today))),
    waitingPartner(room),
    scoreBanner(room, game, me, names, today),
    todays.length && done ? h('p', { class: 'notice', 'data-testid': 'all-done' }, 'Tout est joué pour aujourd’hui 🎉 Reviens demain pour de nouvelles questions !') : null,
    h('div', { class: 'stack', 'data-testid': 'today-rounds' },
      todays.length ? todays.map((r) => roundCard(r, game, me, names)) : h('p', { class: 'empty' }, h('span', { class: 'emoji' }, '🃏'), 'Pas de question aujourd’hui.')),
    late.length ? h('div', { class: 'stack', 'data-testid': 'late-rounds' },
      h('h2', {}, 'En retard'),
      late.map((r) => roundCard(r, game, me, names, { showDate: true }))) : null,
    button('Rafraîchir', { variant: 'ghost', block: true, 'data-testid': 'refresh', onClick: () => go('#/today') }),
  );
}
