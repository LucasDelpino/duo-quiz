// « Qui a joué aujourd'hui ? » — fonctions pures (compteurs seulement, jamais le contenu des réponses).
import { other } from './scoring.js';

const clampInt = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0);

/** Normalise les lignes de day_progress → { me, them, total, state } (null si inexploitable). */
export function progressSummary(rows, me) {
  if (!Array.isArray(rows) || !rows.length || ![1, 2].includes(me)) return null;
  const find = (p) => rows.find((r) => Number(r?.player) === p) || {};
  const total = Math.max(0, ...rows.map((r) => clampInt(r?.total)));
  if (!total) return null;
  const mk = (p) => {
    const r = find(p);
    return { answered: Math.min(total, clampInt(r.answered)), last: r.last_answer_at || null };
  };
  const mine = mk(me);
  const theirs = mk(other(me));
  const meDone = mine.answered >= total;
  const themDone = theirs.answered >= total;
  let state;
  if (meDone && themDone) state = 'all_done';
  else if (meDone) state = 'me_done';
  else if (themDone) state = 'them_done';
  else if (theirs.answered > 0) state = 'them_started';
  else if (mine.answered > 0) state = 'me_started';
  else state = 'none';
  return { me: mine, them: theirs, total, state };
}

/** « à l'instant », « il y a 12 min », « il y a 3 h », « hier », « il y a 4 j ». */
export function ago(iso, now = new Date()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} j`;
}

/** Message motivant selon l'état. cta : 'play' | 'reveal' | null. */
export function progressMessage(summary, names, me) {
  if (!summary) return null;
  const autre = names?.[other(me)] || 'ton/ta partenaire';
  const { me: m, them: t, total } = summary;
  const left = total - m.answered;
  const q = (n) => `${n} question${n > 1 ? 's' : ''}`;
  switch (summary.state) {
    case 'all_done':
      return { emoji: '🎉', title: 'Vous avez tout fini !', text: `Les ${q(total)} du jour sont jouées des deux côtés. Les révélations t’attendent.`, cta: 'reveal' };
    case 'me_done':
      return { emoji: '🤫', title: `${autre} n’a pas encore fini`, text: `Tu as répondu à tout. ${autre} en est à ${t.answered}/${total}… patience !`, cta: null };
    case 'them_done':
      return { emoji: '👀', title: `${autre} a déjà tout joué !`, text: `${autre} a répondu à ${total}/${total}. À toi : encore ${q(left)}.`, cta: 'play' };
    case 'them_started':
      return { emoji: '👀', title: `${autre} a commencé !`, text: `${autre} a déjà répondu à ${t.answered}/${total}. À toi de jouer !`, cta: 'play' };
    case 'me_started':
      return { emoji: '🔥', title: 'Tu as pris de l’avance', text: `Tu en es à ${m.answered}/${total}. ${autre} n’a pas encore joué aujourd’hui.`, cta: 'play' };
    default:
      return { emoji: '🎲', title: 'Personne n’a encore joué', text: `${q(total)} vous attendent aujourd’hui. Lance la partie !`, cta: 'play' };
  }
}

export const POPUP_KEY = 'duo-quiz:progress-popup-at';
export const POPUP_EVERY_MS = 30 * 60 * 1000;

/** La pop-up s'affiche à l'ouverture, au plus une fois toutes les 30 min. */
export function shouldShowPopup(lastShownAt, now = Date.now()) {
  const t = Number(lastShownAt);
  return !Number.isFinite(t) || t <= 0 || now - t >= POPUP_EVERY_MS;
}
