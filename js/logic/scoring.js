// Points : 1 si la prédiction est correcte, 0 sinon, null si en attente.
import { sameAnswer } from './normalize.js';

export const other = (p) => (p === 1 ? 2 : 1);

export function answersOf(roundId, answers) {
  const out = {};
  for (const a of answers || []) if (a.round_id === roundId) out[a.player] = a;
  return out;
}

export function judgmentsOf(roundId, judgments) {
  const out = {};
  for (const j of judgments || []) if (j.round_id === roundId) out[j.judge] = j;
  return out;
}

export function isComplete(round, answers) {
  const a = answersOf(round.id, answers);
  return Boolean(a[1] && a[2]);
}

/** Point du joueur `p` : a-t-il bien deviné la réponse de l'autre ? */
export function pointFor(round, answers, judgments, p) {
  const a = answersOf(round.id, answers);
  const mine = a[p];
  const theirs = a[other(p)];
  if (!mine || !theirs) return null;
  if (round.kind === 'text') {
    // C'est l'autre (dont la réponse sert de référence) qui juge ma prédiction.
    const j = judgmentsOf(round.id, judgments)[other(p)];
    return j ? (j.correct ? 1 : 0) : null;
  }
  if (round.kind === 'scale') return Number(mine.guess_other) === Number(theirs.self_answer) ? 1 : 0;
  return sameAnswer(mine.guess_other, theirs.self_answer) ? 1 : 0;
}

/**
 * État d'un round pour le joueur `me` :
 * todo (à jouer) · waiting (l'autre n'a pas répondu) · to_judge (je dois valider) · revealed.
 */
export function roundStatus(round, answers, judgments, me) {
  const a = answersOf(round.id, answers);
  if (!a[me]) return 'todo';
  if (!a[other(me)]) return 'waiting';
  if (round.kind === 'text' && !judgmentsOf(round.id, judgments)[me]) return 'to_judge';
  return 'revealed';
}

/** Totaux par joueur sur une liste de rounds. */
export function scoreRounds(rounds, answers, judgments) {
  const res = { 1: { points: 0, scored: 0 }, 2: { points: 0, scored: 0 }, complete: 0 };
  for (const r of rounds || []) {
    if (isComplete(r, answers)) res.complete += 1;
    for (const p of [1, 2]) {
      const pt = pointFor(r, answers, judgments, p);
      if (pt === null) continue;
      res[p].points += pt;
      res[p].scored += 1;
    }
  }
  return res;
}
