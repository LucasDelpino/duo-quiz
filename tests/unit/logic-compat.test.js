import { describe, it, expect } from 'vitest';
import { compatibility, agreement, labelFor, facetOf, weightOf, portrait, MIN_ROUNDS } from '../../js/logic/compat.js';
import { game } from './fixtures.js';

function perfect(n, opts = {}) {
  const g = game();
  for (let i = 0; i < n; i++) g.round('choice', `2026-10-${String(10 + i).padStart(2, '0')}`, { a1: ['A', 'A'], a2: ['A', 'A'], ...opts });
  return g;
}

describe('compat', () => {
  it('seuil de 5 rounds complets', () => {
    const g = perfect(4);
    g.round('choice', '2026-10-30', { a1: ['A', 'A'] }); // incomplet
    const c = compatibility(g);
    expect(c).toMatchObject({ unlocked: false, remaining: 1, complete: 4, score: null, label: null });
    expect(MIN_ROUNDS).toBe(5);
    expect(compatibility({})).toMatchObject({ unlocked: false, remaining: 5 });
  });

  it('accord parfait = 100 % « Âmes sœurs »', () => {
    const c = compatibility(perfect(5));
    expect(c).toMatchObject({ unlocked: true, score: 100, label: 'Âmes sœurs', accords: 100, knowledge: 100, balance: 100 });
  });

  it('accord : choice, scale, text exclu', () => {
    const g = game()
      .round('scale', 'd', { a1: [1, 1], a2: [3, 3] })
      .round('scale', 'd', { a1: [1, 1], a2: [5, 5] })
      .round('choice', 'd', { a1: ['Oui', 'x'], a2: ['oui', 'x'] })
      .round('text', 'd', { a1: ['a', 'b'], a2: ['a', 'b'] })
      .round('choice', 'd', { a1: ['Oui', 'x'] })
      .round('scale', 'd', { a1: ['?', 1], a2: [1, 1] });
    expect(g.rounds.map((r) => agreement(r, g.answers))).toEqual([0.5, 0, 1, null, null, null]);
  });

  it('composantes 40/40/20 et équilibre', () => {
    // 5 rounds choice : toujours d'accord ; 1 devine tout, 2 rien
    const g = game();
    for (let i = 0; i < 5; i++) g.round('choice', 'd', { a1: ['A', 'A'], a2: ['A', 'B'] });
    const c = compatibility(g);
    expect(c).toMatchObject({ accords: 100, knowledge: 50, balance: 0 });
    expect(c.score).toBe(60); // 0.4 + 0.2 + 0
    expect(c.label).toBe('Très complices');
  });

  it('pondération par facette (valeurs ×2, fun ×0,5)', () => {
    const g = game();
    // 3 rounds « valeurs » d'accord, 2 rounds « fun » en désaccord
    for (let i = 0; i < 3; i++) g.round('choice', 'd', { facet: 'valeurs', a1: ['A', 'A'], a2: ['A', 'A'] });
    for (let i = 0; i < 2; i++) g.round('choice', 'd', { facet: 'fun', a1: ['A', 'A'], a2: ['B', 'B'] });
    const c = compatibility(g);
    expect(c.accords).toBe(86); // 6 / 7
    expect(c.facets.valeurs).toEqual({ score: 100, rounds: 3 });
    expect(c.facets.fun).toEqual({ score: 20, rounds: 2 }); // équilibre parfait (0 % chacun)
    expect(c.facets.aime).toBeUndefined();
  });

  it('uniquement des questions texte : accords absents, poids redistribués', () => {
    const g = game();
    for (let i = 0; i < 5; i++) g.round('text', 'd', { a1: ['a', 'b'], a2: ['c', 'd'], j1: true, j2: i < 2 });
    // précision 1 (jugé par 2) = 2/5, précision 2 = 5/5
    const c = compatibility(g);
    expect(c.accords).toBeNull();
    expect(c.knowledge).toBe(70);
    expect(c.balance).toBe(40);
    expect(c.score).toBe(Math.round(((0.7 * 0.4 + 0.4 * 0.2) / 0.6) * 100));
  });

  it('textes non validés : rien à mesurer', () => {
    const g = game();
    for (let i = 0; i < 5; i++) g.round('text', 'd', { a1: ['a', 'b'], a2: ['c', 'd'] });
    expect(compatibility(g)).toMatchObject({ unlocked: false, remaining: 0, score: null, knowledge: null, balance: null });
    const h = game();
    for (let i = 0; i < 5; i++) h.round('text', 'd', { a1: ['a', 'b'], a2: ['c', 'd'], j2: true });
    expect(compatibility(h)).toMatchObject({ knowledge: 100, balance: null, score: 100 });
  });

  it('libellés aux bornes', () => {
    expect(labelFor(0)).toBe('Des opposés qui s’attirent');
    expect(labelFor(39)).toBe('Des opposés qui s’attirent');
    expect(labelFor(40)).toBe('Belle complémentarité');
    expect(labelFor(60)).toBe('Très complices');
    expect(labelFor(80)).toBe('Très complices');
    expect(labelFor(81)).toBe('Âmes sœurs');
  });

  it('facette : explicite, sinon déduite de la catégorie', () => {
    expect(facetOf({ facet: 'amour', category: 'humour' })).toBe('amour');
    expect(facetOf({ facet: 'bidon', category: 'humour' })).toBe('fun');
    expect(facetOf({ category: 'inconnue' })).toBe('aime');
    expect(weightOf({ category: 'reves' })).toBe(2);
    expect(weightOf({ category: 'gouts' })).toBe(1);
  });

  it('portrait : réponses du joueur regroupées, plus récentes d\'abord', () => {
    const g = game()
      .round('choice', '2026-10-01', { facet: 'aime', a1: ['Pizza', 'x'], a2: ['Sushi', 'x'] })
      .round('choice', '2026-10-02', { facet: 'aime', a1: ['Ski', 'x'] })
      .round('scale', '2026-10-03', { facet: 'naime_pas', a1: [4, 1] })
      .round('text', '2026-10-04', { facet: 'futur', a1: ['Vivre à Lisbonne', 'x'] })
      .round('text', '2026-10-05', { facet: 'amour', a2: ['Les petits mots', 'x'] })
      .round('text', '2026-10-05', { facet: 'ressenti', a1: ['Fatigué', 'x'] });
    const p1 = portrait(g, 1);
    expect(p1.aime.map((x) => x.answer)).toEqual(['Ski', 'Pizza']);
    expect(p1.naime_pas[0].answer).toBe('4/5');
    expect(p1.reves[0].answer).toBe('Vivre à Lisbonne');
    expect(p1.compte).toEqual([]);
    expect(portrait(g, 2).compte[0].answer).toBe('Les petits mots');
    expect(portrait(g, 1, { limit: 1 }).aime).toHaveLength(1);
    expect(portrait({}, 1).aime).toEqual([]);
  });
});

describe('portrait : titres', () => {
  it('accorde selon il / elle', async () => {
    const { PORTRAIT_SECTIONS: S } = await import('../../js/logic/compat.js');
    expect(S.map((s) => s.title('elle'))).toEqual(['Ce qu’elle aime', 'Ce qu’elle n’aime pas', 'Ses rêves', 'Ce qui compte pour elle']);
    expect(S[3].title('il')).toBe('Ce qui compte pour lui');
    expect(S[3].title('il/elle')).toBe('Ce qui compte pour lui/elle');
  });
});
