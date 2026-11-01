// Score de compatibilité en direct (déterministe) + portraits issus des réponses.
import { sameAnswer } from './normalize.js';
import { answersOf, isComplete, pointFor } from './scoring.js';

export const MIN_ROUNDS = 5;
export const FACETS = ['aime', 'naime_pas', 'ressenti', 'valeurs', 'futur', 'amour', 'souvenir', 'fun'];
export const FACET_WEIGHTS = { valeurs: 2, futur: 2, amour: 2, fun: 0.5 };
/** Facette par défaut si un round n'en porte pas. */
export const CATEGORY_FACET = {
  gouts: 'aime', souvenirs: 'souvenir', quotidien: 'aime', reves: 'futur', valeurs: 'valeurs',
  couple: 'amour', voyage: 'futur', humour: 'fun', 'et-si': 'fun', enfance: 'souvenir',
};

export const facetOf = (r) => (FACETS.includes(r.facet) ? r.facet : CATEGORY_FACET[r.category] || 'aime');
export const weightOf = (r) => FACET_WEIGHTS[facetOf(r)] ?? 1;

/** Accord des deux réponses : choice 1/0, scale 1 − |a−b|/4, text exclu (null). */
export function agreement(round, answers) {
  const a = answersOf(round.id, answers);
  if (!a[1] || !a[2] || round.kind === 'text') return null;
  if (round.kind === 'scale') {
    const d = Math.abs(Number(a[1].self_answer) - Number(a[2].self_answer));
    return Number.isFinite(d) ? Math.max(0, 1 - d / 4) : null;
  }
  return sameAnswer(a[1].self_answer, a[2].self_answer) ? 1 : 0;
}

function wavg(pairs) {
  let s = 0;
  let w = 0;
  for (const [v, k] of pairs) { s += v * k; w += k; }
  return w ? s / w : null;
}

export function labelFor(score) {
  if (score < 40) return 'Des opposés qui s’attirent';
  if (score < 60) return 'Belle complémentarité';
  if (score <= 80) return 'Très complices';
  return 'Âmes sœurs';
}

function components(rounds, answers, judgments) {
  const acc = [];
  const know = { 1: [], 2: [] };
  for (const r of rounds) {
    const w = weightOf(r);
    const ag = agreement(r, answers);
    if (ag !== null) acc.push([ag, w]);
    for (const p of [1, 2]) {
      const pt = pointFor(r, answers, judgments, p);
      if (pt !== null) know[p].push([pt, w]);
    }
  }
  const p1 = wavg(know[1]);
  const p2 = wavg(know[2]);
  const parts = [
    [wavg(acc), 0.4],
    [p1 === null && p2 === null ? null : ((p1 ?? p2) + (p2 ?? p1)) / 2, 0.4],
    [p1 === null || p2 === null ? null : 1 - Math.abs(p1 - p2), 0.2],
  ];
  return { accords: parts[0][0], knowledge: parts[1][0], balance: parts[2][0], score: wavg(parts.filter(([v]) => v !== null)) };
}

const toPct = (v) => (v === null ? null : Math.round(v * 100));

/** Score 0–100 sur les rounds complets fournis (période ou global). */
export function compatibility({ rounds = [], answers = [], judgments = [] }) {
  const complete = rounds.filter((r) => isComplete(r, answers));
  const remaining = Math.max(0, MIN_ROUNDS - complete.length);
  const c = components(complete, answers, judgments);
  const facets = {};
  for (const f of FACETS) {
    const rs = complete.filter((r) => facetOf(r) === f);
    if (!rs.length) continue;
    facets[f] = { score: toPct(components(rs, answers, judgments).score), rounds: rs.length };
  }
  const unlocked = remaining === 0 && c.score !== null;
  const score = unlocked ? toPct(c.score) : null;
  return {
    unlocked,
    remaining,
    complete: complete.length,
    score,
    label: unlocked ? labelFor(score) : null,
    accords: toPct(c.accords),
    knowledge: toPct(c.knowledge),
    balance: toPct(c.balance),
    facets,
  };
}

export const PORTRAIT_SECTIONS = [
  { id: 'aime', title: (g) => `Ce qu’${g} aime`, facets: ['aime'] },
  { id: 'naime_pas', title: (g) => `Ce qu’${g} n’aime pas`, facets: ['naime_pas'] },
  { id: 'reves', title: () => 'Ses rêves', facets: ['futur'] },
  { id: 'compte', title: (g) => `Ce qui compte pour ${g === 'il' ? 'lui' : g === 'elle' ? 'elle' : 'lui/elle'}`, facets: ['valeurs', 'amour'] },
];

/** Portrait du joueur `p` : ses propres réponses regroupées par facette, sans interprétation. */
export function portrait({ rounds = [], answers = [] }, p, { limit = 5 } = {}) {
  const sorted = [...rounds].sort((a, b) => (a.play_date < b.play_date ? 1 : a.play_date > b.play_date ? -1 : 0));
  const out = {};
  for (const s of PORTRAIT_SECTIONS) {
    out[s.id] = [];
    for (const r of sorted) {
      if (!s.facets.includes(facetOf(r))) continue;
      const a = answersOf(r.id, answers)[p];
      if (!a) continue;
      out[s.id].push({ round_id: r.id, question: r.text, answer: r.kind === 'scale' ? `${a.self_answer}/5` : a.self_answer });
      if (out[s.id].length >= limit) break;
    }
  }
  return out;
}
