// Bilan de période — calculé depuis les mêmes données serveur : identique sur les 2 téléphones.
import { addDays, diffDays, inRange } from './dates.js';
import { answersOf, isComplete, other, pointFor, scoreRounds } from './scoring.js';
import { normalizeAnswer } from './normalize.js';

/** Bornes {from, to} : 'current' | 'previous' | 'all' | {from, to} (personnalisée). */
export function periodBounds({ report_start, report_period_days = 7 }, which, today) {
  const days = Math.max(1, Number(report_period_days) || 7);
  if (which && typeof which === 'object') return { from: which.from, to: which.to };
  if (which === 'all') return { from: null, to: today };
  const k = Math.floor(Math.max(0, diffDays(report_start, today)) / days);
  const idx = which === 'previous' ? k - 1 : k;
  const from = addDays(report_start, idx * days);
  return { from, to: addDays(from, days - 1) };
}

export const roundsIn = (rounds, { from, to }) => (rounds || []).filter((r) => inRange(r.play_date, from, to));

const pct = (pts, n) => (n ? Math.round((pts / n) * 100) : null);

function categoryStats(rounds, answers, judgments, p) {
  const stats = {};
  for (const r of rounds) {
    const pt = pointFor(r, answers, judgments, p);
    if (pt === null) continue;
    const s = (stats[r.category] ??= { category: r.category, points: 0, n: 0 });
    s.points += pt;
    s.n += 1;
  }
  const list = Object.values(stats).map((s) => ({ ...s, accuracy: s.points / s.n }));
  const order = (a, b) => b.accuracy - a.accuracy || b.n - a.n || a.category.localeCompare(b.category);
  list.sort(order);
  const best = list[0] ?? null;
  const last = list.at(-1);
  // Pas de « pire » catégorie si toutes se valent.
  const worst = last && best && last.accuracy < best.accuracy ? last : null;
  return { best: best?.category ?? null, worst: worst?.category ?? null };
}

/** Jours où les deux ont complété au moins un round : meilleure série et série en cours (jusqu'à `to`). */
export function streaks(rounds, answers, to) {
  const days = [...new Set(rounds.filter((r) => isComplete(r, answers)).map((r) => r.play_date))].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDays(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const last = days.at(-1);
  const current = last && to && diffDays(last, to) <= 1 ? run : 0;
  return { best, current, days: days.length };
}

/** Top des prédictions ratées les plus étonnantes (« tu ne l'aurais jamais deviné »). */
export function surprises(rounds, answers, judgments, limit = 3) {
  const out = [];
  for (const r of rounds) {
    const a = answersOf(r.id, answers);
    const misses = [1, 2].filter((p) => pointFor(r, answers, judgments, p) === 0);
    for (const p of misses) {
      const guess = a[p].guess_other;
      const actual = a[other(p)].self_answer;
      let weight = 1 + (misses.length === 2 ? 0.5 : 0);
      if (r.kind === 'scale') weight += Math.abs(Number(guess) - Number(actual)) / 2;
      out.push({ round_id: r.id, text: r.text, kind: r.kind, play_date: r.play_date, guesser: p, target: other(p), guess, actual, weight });
    }
  }
  out.sort((x, y) => y.weight - x.weight || (x.play_date < y.play_date ? 1 : x.play_date > y.play_date ? -1 : 0)
    || String(x.round_id).localeCompare(String(y.round_id)) || x.guesser - y.guesser);
  return out.slice(0, limit);
}

function title(winner, names, complete) {
  if (!complete) return 'Pas encore de manche complète : à vous de jouer 🎲';
  if (!winner) return 'Égalité parfaite : vous êtes sur la même longueur d’onde 🤝';
  return `${names[winner]} connaît ${names[other(winner)]} par cœur 👑`;
}

/**
 * Bilan d'une période.
 * @param data {rounds, answers, judgments}
 * @param period {from, to}
 * @param opts {names, previous: {from, to}}
 */
export function buildReport(data, period, { names = { 1: 'Joueur 1', 2: 'Joueur 2' }, previous } = {}) {
  const { answers = [], judgments = [] } = data;
  const rounds = roundsIn(data.rounds, period);
  const totals = scoreRounds(rounds, answers, judgments);
  const players = {};
  for (const p of [1, 2]) {
    players[p] = {
      name: names[p],
      points: totals[p].points,
      scored: totals[p].scored,
      accuracy: pct(totals[p].points, totals[p].scored),
      ...categoryStats(rounds, answers, judgments, p),
    };
  }
  const diff = players[1].points - players[2].points;
  const winner = diff > 0 ? 1 : diff < 0 ? 2 : null;
  const report = {
    period,
    rounds: rounds.length,
    complete: totals.complete,
    players,
    winner,
    title: title(winner, names, totals.complete),
    streak: streaks(rounds, answers, period.to),
    surprises: surprises(rounds, answers, judgments),
    evolution: null,
  };
  if (previous) {
    const prev = scoreRounds(roundsIn(data.rounds, previous), answers, judgments);
    report.evolution = {};
    for (const p of [1, 2]) {
      const before = pct(prev[p].points, prev[p].scored);
      report.evolution[p] = {
        points: players[p].points - prev[p].points,
        accuracy: before === null || players[p].accuracy === null ? null : players[p].accuracy - before,
      };
    }
  }
  return report;
}

/** Texte à partager (Web Share / copier). */
export function shareText(report) {
  const { players: P, period } = report;
  const range = period.from ? `du ${period.from} au ${period.to}` : `jusqu’au ${period.to}`;
  const line = (p) => `${P[p].name} : ${P[p].points} pt${P[p].points > 1 ? 's' : ''}${P[p].accuracy === null ? '' : ` (${P[p].accuracy} %)`}`;
  return [`Duo Quiz — bilan ${range}`, report.title, line(1), line(2)].join('\n');
}

/** Indique si deux réponses texte sont trivialement identiques (utile à l'affichage). */
export const identical = (a, b) => normalizeAnswer(a) === normalizeAnswer(b);
