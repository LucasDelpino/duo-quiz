import { describe, it, expect } from 'vitest';
import { pointFor, roundStatus, scoreRounds, isComplete, other, answersOf, judgmentsOf } from '../../js/logic/scoring.js';
import { seededRng, shuffle, drawCandidates, sortForDisplay, lateRounds, roundsOn } from '../../js/logic/draw.js';
import { game } from './fixtures.js';

describe('scoring', () => {
  it('choice : prédiction comparée via normalize', () => {
    const g = game().round('choice', '2026-11-01', { a1: ['Pizza', 'sushi'], a2: ['Sushi ', 'pizza'] });
    const r = g.rounds[0];
    expect(pointFor(r, g.answers, g.judgments, 1)).toBe(1);
    expect(pointFor(r, g.answers, g.judgments, 2)).toBe(1);
  });

  it('scale : égalité stricte', () => {
    const g = game().round('scale', '2026-11-01', { a1: [3, 4], a2: [4, 2] });
    expect(pointFor(g.rounds[0], g.answers, [], 1)).toBe(1);
    expect(pointFor(g.rounds[0], g.answers, [], 2)).toBe(0);
  });

  it("text : c'est l'autre qui valide ; null tant que non validé", () => {
    const g = game().round('text', '2026-11-01', { a1: ['a', 'b'], a2: ['c', 'd'], j2: true });
    const r = g.rounds[0];
    expect(pointFor(r, g.answers, g.judgments, 1)).toBe(1); // jugé par 2
    expect(pointFor(r, g.answers, g.judgments, 2)).toBeNull(); // 1 n'a pas jugé
    g.judgments.push({ round_id: r.id, judge: 1, correct: false });
    expect(pointFor(r, g.answers, g.judgments, 2)).toBe(0);
  });

  it('null si une réponse manque', () => {
    const g = game().round('choice', '2026-11-01', { a1: ['x', 'y'] });
    expect(pointFor(g.rounds[0], g.answers, [], 1)).toBeNull();
    expect(pointFor(g.rounds[0], g.answers, [], 2)).toBeNull();
    expect(isComplete(g.rounds[0], g.answers)).toBe(false);
  });

  it('statuts', () => {
    const g = game()
      .round('choice', 'd', { a2: ['x', 'y'] })
      .round('choice', 'd', { a1: ['x', 'y'] })
      .round('text', 'd', { a1: ['x', 'y'], a2: ['x', 'y'] })
      .round('text', 'd', { a1: ['x', 'y'], a2: ['x', 'y'], j1: true })
      .round('scale', 'd', { a1: [1, 2], a2: [2, 1] });
    expect(g.rounds.map((r) => roundStatus(r, g.answers, g.judgments, 1))).toEqual(['todo', 'waiting', 'to_judge', 'revealed', 'revealed']);
    expect(roundStatus(g.rounds[3], g.answers, g.judgments, 2)).toBe('to_judge');
  });

  it('totaux', () => {
    const g = game()
      .round('choice', 'd', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', 'd', { a1: ['A', 'C'], a2: ['B', 'B'] })
      .round('text', 'd', { a1: ['x', 'y'], a2: ['x', 'y'] })
      .round('choice', 'd', { a1: ['A', 'B'] });
    expect(scoreRounds(g.rounds, g.answers, g.judgments)).toEqual({ 1: { points: 1, scored: 2 }, 2: { points: 1, scored: 2 }, complete: 3 });
    expect(scoreRounds()).toEqual({ 1: { points: 0, scored: 0 }, 2: { points: 0, scored: 0 }, complete: 0 });
    expect(other(1)).toBe(2);
    expect(answersOf('x', null)).toEqual({});
    expect(judgmentsOf('x', null)).toEqual({});
  });
});

describe('draw', () => {
  const bank = Array.from({ length: 60 }, (_, i) => ({
    id: `q${i}`, text: `Q${i} ?`, kind: 'choice', options: ['a', 'b'], category: ['gouts', 'reves', 'humour'][i % 3], facet: 'aime',
  }));

  it('rng déterministe et mélange complet', () => {
    expect(seededRng(42)()).toBe(seededRng(42)());
    expect(seededRng()()).toBeGreaterThanOrEqual(0);
    const s = shuffle([1, 2, 3, 4, 5], seededRng(1));
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffle([1, 2, 3])).toHaveLength(3);
  });

  it('exclut les questions utilisées et varie les catégories', () => {
    const used = bank.slice(0, 30).map((q) => q.id);
    const c = drawCandidates(bank, used, { count: 20, rng: seededRng(7) });
    expect(c).toHaveLength(20);
    expect(c.every((q) => !used.includes(q.id))).toBe(true);
    expect(new Set(c.map((q) => q.id)).size).toBe(20);
    // alternance : 3 premières de catégories différentes
    expect(new Set(c.slice(0, 3).map((q) => q.category)).size).toBe(3);
    expect(Object.keys(c[0]).sort()).toEqual(['category', 'id', 'kind', 'options', 'text']);
    expect(c[0].category).toMatch(/^(gouts|reves|humour):aime$/);
  });

  it('renvoie ce qui reste quand la banque est presque épuisée', () => {
    expect(drawCandidates(bank, bank.slice(2).map((q) => q.id))).toHaveLength(2);
    expect(drawCandidates([], [])).toEqual([]);
    expect(drawCandidates(null)).toEqual([]);
    expect(drawCandidates([{ id: 'x', text: 'T ?', kind: 'text', category: 'gouts' }])[0]).toMatchObject({ options: null, category: 'gouts' });
  });

  it("ordre d'affichage par id, jamais par created_at", () => {
    const rs = [
      { id: 'c', created_at: '1' }, { id: 'a', created_at: '3' }, { id: 'b', created_at: '2' }, { id: 'a', created_at: '0' },
    ];
    expect(sortForDisplay(rs).map((r) => r.id)).toEqual(['a', 'a', 'b', 'c']);
    expect(sortForDisplay()).toEqual([]);
  });

  it('retards et rounds du jour', () => {
    const g = game()
      .round('choice', '2026-10-30', { a2: ['x', 'y'] })
      .round('choice', '2026-10-31', { a1: ['x', 'y'] })
      .round('choice', '2026-10-29')
      .round('choice', '2026-11-01');
    expect(lateRounds(g.rounds, g.answers, 1, '2026-11-01').map((r) => r.id)).toEqual(['r003', 'r001']);
    expect(lateRounds(g.rounds, g.answers, 2, '2026-11-01').map((r) => r.id)).toEqual(['r003', 'r002']);
    expect(lateRounds()).toEqual([]);
    expect(roundsOn(g.rounds, '2026-11-01').map((r) => r.id)).toEqual(['r004']);
    expect(roundsOn(null, 'x')).toEqual([]);
  });
});
