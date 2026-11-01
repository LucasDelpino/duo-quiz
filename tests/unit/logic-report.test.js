import { describe, it, expect } from 'vitest';
import { periodBounds, buildReport, shareText, streaks, surprises, roundsIn, identical } from '../../js/logic/report.js';
import { game } from './fixtures.js';

const names = { 1: 'Lucas', 2: 'Léa' };
const room = { report_start: '2026-10-26', report_period_days: 7 }; // lundi

describe('periodBounds', () => {
  it('période en cours, précédente, tout, personnalisée', () => {
    expect(periodBounds(room, 'current', '2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(periodBounds(room, 'current', '2026-11-02')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(periodBounds(room, 'previous', '2026-11-02')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(periodBounds(room, 'all', '2026-11-02')).toEqual({ from: null, to: '2026-11-02' });
    expect(periodBounds(room, { from: 'a', to: 'b' }, 'x')).toEqual({ from: 'a', to: 'b' });
    expect(periodBounds({ report_start: '2026-11-01', report_period_days: 0 }, 'current', '2026-10-01')).toEqual({ from: '2026-11-01', to: '2026-11-07' });
    expect(periodBounds({ report_start: '2026-11-01' }, 'current', '2026-11-03')).toEqual({ from: '2026-11-01', to: '2026-11-07' });
    expect(periodBounds({ ...room, report_period_days: 1 }, 'previous', '2026-10-28')).toEqual({ from: '2026-10-27', to: '2026-10-27' });
  });
});

describe('buildReport', () => {
  it('période vide', () => {
    const r = buildReport({ rounds: [], answers: [], judgments: [] }, { from: '2026-10-26', to: '2026-11-01' }, { names });
    expect(r.complete).toBe(0);
    expect(r.winner).toBeNull();
    expect(r.players[1]).toMatchObject({ points: 0, accuracy: null, best: null, worst: null });
    expect(r.title).toMatch(/Pas encore/);
    expect(r.streak).toEqual({ best: 0, current: 0, days: 0 });
    expect(r.surprises).toEqual([]);
    expect(r.evolution).toBeNull();
    expect(buildReport({}, { from: null, to: 'x' }).players[1].name).toBe('Joueur 1');
  });

  it('gagnant, précision, catégories, filtrage par période', () => {
    const g = game()
      .round('choice', '2026-10-26', { category: 'gouts', a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-27', { category: 'reves', a1: ['A', 'B'], a2: ['B', 'B'] })
      .round('scale', '2026-10-28', { category: 'reves', a1: [2, 5], a2: [5, 1] })
      .round('choice', '2026-10-20', { a1: ['A', 'B'], a2: ['B', 'A'] }) // hors période
      .round('text', '2026-10-29', { category: 'humour', a1: ['x', 'y'], a2: ['z', 'w'], j2: true }); // 1 jugé par 2
    const r = buildReport(g, { from: '2026-10-26', to: '2026-11-01' }, { names });
    expect(r.rounds).toBe(4);
    expect(r.complete).toBe(4);
    expect(r.players[1]).toMatchObject({ points: 4, scored: 4, accuracy: 100, best: 'reves', worst: null });
    expect(r.players[2]).toMatchObject({ points: 1, scored: 3, accuracy: 33, best: 'gouts', worst: 'reves' });
    expect(r.winner).toBe(1);
    expect(r.title).toBe('Lucas connaît Léa par cœur 👑');
    expect(shareText(r)).toBe('Duo Quiz — bilan du 2026-10-26 au 2026-11-01\nLucas connaît Léa par cœur 👑\nLucas : 4 pts (100 %)\nLéa : 1 pt (33 %)');
  });

  it('égalité et validations manquantes', () => {
    const g = game()
      .round('text', '2026-10-26', { a1: ['x', 'y'], a2: ['z', 'w'] })
      .round('choice', '2026-10-27', { a1: ['A', 'B'], a2: ['B', 'A'] });
    const r = buildReport(g, { from: '2026-10-26', to: '2026-11-01' }, { names });
    expect(r.winner).toBeNull();
    expect(r.title).toMatch(/Égalité/);
    expect(r.players[1].scored).toBe(1); // le texte non validé ne compte pas
    expect(r.complete).toBe(2);
    expect(shareText(buildReport(g, { from: null, to: '2026-11-01' }, { names }))).toContain('jusqu’au 2026-11-01');
  });

  it('joueur 2 gagnant + évolution vs période précédente', () => {
    const g = game()
      .round('choice', '2026-10-20', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-27', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-28', { a1: ['A', 'C'], a2: ['B', 'A'] });
    const r = buildReport(g, { from: '2026-10-26', to: '2026-11-01' }, { names, previous: { from: '2026-10-19', to: '2026-10-25' } });
    expect(r.winner).toBe(2);
    expect(r.title).toBe('Léa connaît Lucas par cœur 👑');
    expect(r.evolution[1]).toEqual({ points: 0, accuracy: -50 });
    expect(r.evolution[2]).toEqual({ points: 1, accuracy: 0 });
    const empty = buildReport(g, { from: '2026-11-02', to: '2026-11-08' }, { names, previous: { from: '2026-10-26', to: '2026-11-01' } });
    expect(empty.evolution[1]).toEqual({ points: -1, accuracy: null });
  });

  it('roundsIn tolère une liste absente', () => {
    expect(roundsIn(undefined, { from: null, to: null })).toEqual([]);
    expect(identical('Été', 'ete')).toBe(true);
  });
});

describe('streaks et surprises', () => {
  it('série de jours joués', () => {
    const g = game()
      .round('choice', '2026-10-26', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-27', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-28', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-30', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-31', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-10-31', { a1: ['A', 'B'], a2: ['B', 'A'] })
      .round('choice', '2026-11-01', { a1: ['A', 'B'] }); // incomplet
    expect(streaks(g.rounds, g.answers, '2026-11-01')).toEqual({ best: 3, current: 2, days: 5 });
    expect(streaks(g.rounds, g.answers, '2026-11-05').current).toBe(0);
    expect(streaks(g.rounds, g.answers, null).current).toBe(0);
  });

  it('top 3 des surprises, les plus étonnantes en premier', () => {
    const g = game()
      .round('scale', '2026-10-26', { a1: [1, 5], a2: [1, 5] }) // 2 ratés, écart 4
      .round('choice', '2026-10-27', { a1: ['A', 'B'], a2: ['C', 'A'] }) // 1 raté
      .round('choice', '2026-10-28', { a1: ['A', 'B'], a2: ['C', 'D'] }) // 2 ratés
      .round('text', '2026-10-29', { a1: ['x', 'y'], a2: ['z', 'w'], j1: false, j2: true });
    const s = surprises(g.rounds, g.answers, g.judgments);
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({ round_id: 'r001', guess: '5', actual: '1', target: 2, weight: 3.5 });
    expect(s.slice(0, 2).map((x) => x.guesser)).toEqual([1, 2]);
    expect(s[2]).toMatchObject({ round_id: 'r003', weight: 1.5 });
    expect(surprises(g.rounds, g.answers, g.judgments, 10)).toHaveLength(6);
  });
});
