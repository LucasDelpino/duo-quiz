// « Aujourd'hui » : questions du jour, retards, validations en attente, score de la période.
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { statusChip, categoryChip } from '../ui/status.js';
import { animateCount } from '../ui/counter.js';
import { share } from '../ui/share.js';
import { ApiError, messageFor } from '../api/errors.js';
import { ensureToday, drawMoreToday, loadGame, loadRoom, players, textFor } from '../game.js';
import { toast } from '../ui/toast.js';
import { todayParis, formatDay, formatShort, addDays } from '../logic/dates.js';
import { roundStatus, pointFor, scoreRounds } from '../logic/scoring.js';
import { sortForDisplay } from '../logic/draw.js';
import { periodBounds, roundsIn } from '../logic/report.js';
import { appBaseUrl, go, leave, getApi } from '../context.js';
import { progressSummary, progressMessage, ago, shouldShowPopup, POPUP_KEY } from '../logic/progress.js';
import { paceState, paceMessage, PACE_POPUP_KEY } from '../logic/pace.js';

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

function bar(label, answered, total, last, testid) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  const when = last ? ago(last) : null;
  return h('div', { class: 'progress-row', 'data-testid': testid },
    h('div', { class: 'row progress-head' },
      h('strong', {}, label),
      h('span', { class: 'small muted' }, `${answered}/${total}`, when ? ` · ${when}` : '')),
    h('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(answered), 'aria-label': `${label} : ${answered} sur ${total}` },
      h('div', { class: 'progress-fill' + (answered >= total ? ' progress-fill--done' : ''), style: `width:${pct}%` })));
}

/** Bandeau permanent « Qui a joué aujourd'hui ? ». */
function progressBanner(summary, me, names) {
  if (!summary) return null;
  return card([
    h('h2', { class: 'progress-title' }, 'Qui a joué aujourd’hui ?'),
    bar(names[me] + ' (toi)', summary.me.answered, summary.total, summary.me.last, 'progress-me'),
    bar(names[me === 1 ? 2 : 1], summary.them.answered, summary.total, summary.them.last, 'progress-them'),
  ], { 'data-testid': 'progress-banner' });
}

function readPopupAt(key = POPUP_KEY) {
  try {
    // Navigateur piloté par les tests : pop-up désactivée sauf demande explicite (sinon elle masque l'écran).
    if (globalThis.navigator?.webdriver && !localStorage.getItem('duo-quiz:force-popup')) return String(Date.now());
    return localStorage.getItem(key);
  } catch { return null; }
}
function writePopupAt(key = POPUP_KEY) {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* stockage indisponible */ }
}

/** Pop-up à l'ouverture (max 1 fois / 30 min). */
function progressPopup(summary, me, names, todays, game, { msg = progressMessage(summary, names, me), key = POPUP_KEY, testid = 'progress-popup' } = {}) {
  if (!msg || !shouldShowPopup(readPopupAt(key))) return null;
  writePopupAt(key);
  const target = msg.cta === 'reveal'
    ? todays.find((r) => roundStatus(r, game.answers, game.judgments, me) === 'revealed')
    : todays.find((r) => ['todo', 'to_judge'].includes(roundStatus(r, game.answers, game.judgments, me)));
  let overlay;
  const close = () => {
    overlay.classList.add('progress-pop--out');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const cta = msg.cta && target
    ? button(msg.cta === 'reveal' ? 'Voir les révélations' : 'Jouer', { block: true, 'data-testid': 'progress-play', onClick: () => { close(); go(`#/round/${encodeURIComponent(target.id)}`); } })
    : null;
  overlay = h('div', { class: 'progress-pop', 'data-testid': testid, onClick: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'progress-pop-box card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'progress-pop-title' },
      h('button', { type: 'button', class: 'progress-pop-close', 'aria-label': 'Fermer', 'data-testid': 'progress-close', onClick: close }, '✕'),
      h('div', { class: 'progress-pop-emoji', 'aria-hidden': 'true' }, msg.emoji),
      h('h2', { id: 'progress-pop-title' }, msg.title),
      h('p', {}, msg.text),
      summary ? bar(names[me] + ' (toi)', summary.me.answered, summary.total, summary.me.last, 'popup-me') : null,
      summary ? bar(names[me === 1 ? 2 : 1], summary.them.answered, summary.total, summary.them.last, 'popup-them') : null,
      cta,
      button('Plus tard', { variant: 'ghost', block: true, onClick: close })));
  setTimeout(() => overlay.querySelector('.progress-pop-close')?.focus(), 50);
  return overlay;
}

/** Bandeau d'avance / de blocage (rythme commun). */
function paceBanner(pace, me, names) {
  if (!pace || !['ahead', 'blocked'].includes(pace.state)) return null;
  const msg = paceMessage(pace, names, me);
  return card([
    h('p', { class: 'pace-title' }, h('span', { 'aria-hidden': 'true' }, msg.emoji + ' '), h('strong', {}, msg.title)),
    h('p', { class: 'small' }, msg.text),
  ], { variant: pace.state === 'blocked' ? 'danger' : undefined, 'data-testid': 'pace-banner', 'data-state': pace.state });
}

/** Mode illimité : « Encore des questions » quand j'ai répondu à tout aujourd'hui. */
function moreButton(room, todays, game, me, pace) {
  if (room.questions_per_day !== 0 || !room.p2_name || pace?.state === 'blocked') return null;
  const mineDone = todays.every((r) => roundStatus(r, game.answers, game.judgments, me) !== 'todo');
  if (!todays.length || !mineDone) return null;
  const btn = button('Encore des questions 🎲', {
    variant: 'coral', block: true, 'data-testid': 'draw-more',
    onClick: async () => {
      btn.disabled = true;
      try {
        await drawMoreToday();
        go('#/today');
      } catch (error) {
        btn.disabled = false;
        toast(messageFor(error), { type: 'error' });
      }
    },
  });
  return card([
    h('p', { class: 'center' }, 'Mode illimité ♾️ — tu as répondu à tout. On continue ?'),
    btn,
  ], { 'data-testid': 'more-card' });
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
  let summary = null;
  let pace = null;
  try {
    const api = await getApi();
    if (room.p2_name) {
      const [prog, p] = await Promise.all([api.dayProgress ? api.dayProgress(today) : null, api.pace ? api.pace() : null]);
      summary = progressSummary(prog, me);
      pace = paceState(p);
    }
  } catch { summary = null; pace = null; } // indicateurs non critiques
  const paceMsg = pace?.state === 'behind' ? paceMessage(pace, names, me) : null;
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
    paceBanner(pace, me, names),
    progressBanner(summary, me, names),
    todays.length && done ? h('p', { class: 'notice', 'data-testid': 'all-done' }, room.questions_per_day === 0 ? 'Tout est joué pour l’instant 🎉' : 'Tout est joué pour aujourd’hui 🎉 Reviens demain pour de nouvelles questions !') : null,
    h('div', { class: 'stack', 'data-testid': 'today-rounds' },
      todays.length ? todays.map((r) => roundCard(r, game, me, names)) : h('p', { class: 'empty' }, h('span', { class: 'emoji' }, '🃏'), 'Pas de question aujourd’hui.')),
    moreButton(room, todays, game, me, pace),
    late.length ? h('div', { class: 'stack', 'data-testid': 'late-rounds' },
      h('h2', {}, 'En retard'),
      late.map((r) => roundCard(r, game, me, names, { showDate: true }))) : null,
    button('Rafraîchir', { variant: 'ghost', block: true, 'data-testid': 'refresh', onClick: () => go('#/today') }),
    paceMsg
      ? progressPopup(summary, me, names, todays, game, { msg: paceMsg, key: PACE_POPUP_KEY, testid: 'pace-popup' })
      : summary ? progressPopup(summary, me, names, todays, game) : null,
  );
}
