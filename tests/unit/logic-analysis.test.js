import { describe, it, expect } from 'vitest';
import { sanitizeAnalysis, analysesTimeline } from '../../js/logic/analysis.js';
import { fakeAnalysis } from '../../js/api/demo-data.js';

describe('rapport IA : lecture défensive', () => {
  it('rapport complet conforme', () => {
    const a = sanitizeAnalysis(fakeAnalysis('r', '2026-10-19', '2026-10-25'));
    expect(a.compatibility).toBe(78);
    expect(a.summary).toMatch(/complicité/);
    expect(a.players[1].aime).toEqual(['Les week-ends improvisés']);
    expect(a.players[2].ressenti).toMatch(/enthousiaste/);
    expect(a.a_faire_ensemble).toHaveLength(2);
    expect(a.evolution).toBeNull();
  });

  it('champs manquants ou inattendus', () => {
    for (const bad of [null, undefined, 42, 'x', [], { content: 'pas du json' }, { content: '[1,2]' }, { content: [] }]) {
      const a = sanitizeAnalysis(bad);
      expect(a.summary).toBeNull();
      expect(a.players[1]).toEqual({ aime: [], naime_pas: [], ressenti: null, a_savoir: [], surprises: [] });
    }
    const a = sanitizeAnalysis({
      compatibility: '140', period_end: 5,
      content: { summary: '  ', players: { 1: ['x'], 2: { aime: 'Le ski', naime_pas: [1, null, ' Pluie '], ressenti: {} } }, points_communs: 'Rire', differences: [{}], evolution: 'Mieux',
        a_faire_ensemble: Array.from({ length: 30 }, (_, i) => `idée ${i}`) },
    });
    expect(a.compatibility).toBe(100);
    expect(a.period_end).toBeNull();
    expect(a.summary).toBeNull();
    expect(a.players[1].aime).toEqual([]);
    expect(a.players[2]).toMatchObject({ aime: ['Le ski'], naime_pas: ['Pluie'], ressenti: null });
    expect(a.points_communs).toEqual(['Rire']);
    expect(a.differences).toEqual([]);
    expect(a.a_faire_ensemble).toHaveLength(12);
    expect(a.evolution).toBe('Mieux');
    expect(sanitizeAnalysis({ compatibility: null, content: { compatibility: -5 } }).compatibility).toBe(0);
    expect(sanitizeAnalysis({ content: JSON.stringify({ summary: 'ok', players: { '1': { aime: ['a'] } } }) })).toMatchObject({ summary: 'ok', players: { 1: { aime: ['a'] } } });
    expect(sanitizeAnalysis({ content: { summary: 'x'.repeat(5000) } }).summary).toHaveLength(1200);
  });

  it('chronologie pour la courbe', () => {
    const rows = [
      { period_end: '2026-10-25', compatibility: 70 },
      { period_end: '2026-10-18', compatibility: 60 },
      { period_end: null, compatibility: 10 },
      { period_end: '2026-10-11', content: {} },
    ];
    expect(analysesTimeline(rows).map((a) => a.compatibility)).toEqual([60, 70]);
    expect(analysesTimeline(null)).toEqual([]);
    expect(analysesTimeline([{ period_end: 'b', compatibility: 1 }, { period_end: 'b', compatibility: 2 }])).toHaveLength(2);
  });
});
