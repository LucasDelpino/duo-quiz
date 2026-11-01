// Tirage des candidates de la banque et ordre d'affichage.
import { inRange } from './dates.js';
import { answersOf } from './scoring.js';
import { encodeCategory, SPICY } from './category.js';

/** Générateur pseudo-aléatoire déterministe (tests). */
export function seededRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ~`count` questions non utilisées, mélangées, en alternant les catégories. */
/**
 * `spicy` : 0 = aucune question « coquin », 1 = une catégorie comme les autres (≈ 1 sur 11),
 * 2 = souvent (≈ 1 question sur 3, à une position aléatoire dans chaque groupe de 3).
 */
export function drawCandidates(bank, usedIds = [], { count = 20, rng = Math.random, spicy = 1 } = {}) {
  const used = new Set(usedIds);
  const pool = (bank || []).filter((q) => q && !used.has(q.id) && (spicy !== 0 || q.category !== SPICY));
  if (spicy === 2) {
    const hot = drawCandidates(pool.filter((q) => q.category === SPICY), [], { count, rng, spicy: 1 });
    const rest = drawCandidates(pool.filter((q) => q.category !== SPICY), [], { count, rng, spicy: 1 });
    const out = [];
    while (out.length < count && (hot.length || rest.length)) {
      const group = [rest.shift(), rest.shift()].filter(Boolean);
      if (hot.length) group.splice(Math.floor(rng() * (group.length + 1)), 0, hot.shift());
      out.push(...group);
    }
    return out.slice(0, count);
  }
  const byCat = new Map();
  for (const q of shuffle(pool, rng)) {
    if (!byCat.has(q.category)) byCat.set(q.category, []);
    byCat.get(q.category).push(q);
  }
  const queues = shuffle([...byCat.values()], rng);
  const out = [];
  while (out.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      if (q.length && out.length < count) out.push(q.shift());
    }
  }
  // La facette voyage dans `category` (« gouts:aime »), exactement comme pour les questions perso.
  return out.map(({ id, text, kind, options, category, facet }) => ({ id, text, kind, options: options ?? null, category: encodeCategory(category, facet) }));
}

/** Ordre d'affichage : par id (aléatoire côté serveur), jamais par created_at. */
export function sortForDisplay(rounds) {
  return [...(rounds || [])].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
}

/** Rounds des jours précédents auxquels `me` n'a pas encore répondu (« En retard »). */
export function lateRounds(rounds, answers, me, today) {
  return sortForDisplay((rounds || []).filter((r) => r.play_date < today && !answersOf(r.id, answers)[me]))
    .sort((a, b) => (a.play_date < b.play_date ? -1 : a.play_date > b.play_date ? 1 : 0));
}

export const roundsOn = (rounds, day) => sortForDisplay((rounds || []).filter((r) => inRange(r.play_date, day, day)));
