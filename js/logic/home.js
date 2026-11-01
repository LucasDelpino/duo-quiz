// Accueil : questions à jouer en haut, puis historique tournant des 5 dernières réponses.
// Le tri de l'historique utilise l'heure de MA réponse (jamais la date de création d'une question :
// elle pourrait trahir une question perso).
import { roundStatus, answersOf } from './scoring.js';

export const RECENT_MAX = 5;
const PENDING = ['todo', 'to_judge'];

/** À jouer d'abord (aujourd'hui puis retards), puis les 5 dernières réponses (la plus récente en premier). */
export function splitRounds(rounds, answers, judgments, me, today) {
  const st = (r) => roundStatus(r, answers, judgments, me);
  const byId = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  const pendingToday = rounds.filter((r) => r.play_date === today && PENDING.includes(st(r))).sort(byId);
  const pendingLate = rounds.filter((r) => r.play_date < today && PENDING.includes(st(r)))
    .sort((a, b) => (a.play_date > b.play_date ? -1 : a.play_date < b.play_date ? 1 : byId(a, b)));
  const at = (r) => answersOf(r.id, answers)[me]?.created_at || '';
  const recent = rounds.filter((r) => at(r) && !PENDING.includes(st(r)))
    .sort((a, b) => (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0))
    .slice(0, RECENT_MAX);
  return { pending: [...pendingToday, ...pendingLate], recent };
}

