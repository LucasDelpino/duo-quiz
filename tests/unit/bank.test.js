import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateBank } from '../../scripts/bank-rules.mjs';
import { drawCandidates, seededRng } from '../../js/logic/draw.js';
import { decodeCategory } from '../../js/logic/category.js';
import { fillOther } from '../../js/logic/normalize.js';

const bank = JSON.parse(readFileSync('data/questions.json', 'utf8'));

describe('banque de questions', () => {
  it('respecte toutes les règles de la SPEC §5', () => {
    expect(validateBank(bank)).toEqual([]);
    expect(bank.length).toBeGreaterThanOrEqual(300);
  });

  it('{autre} est remplacé par le prénom à l’affichage', () => {
    const withOther = bank.filter((q) => q.text.includes('{autre}'));
    expect(withOther.length).toBeGreaterThan(10);
    for (const q of withOther) expect(fillOther(q.text, 'Léa')).not.toContain('{');
  });

  it('les candidates tirées portent la facette dans la catégorie', () => {
    const c = drawCandidates(bank, [], { count: 20, rng: seededRng(5) });
    expect(c).toHaveLength(20);
    for (const q of c) {
      const { category, facet } = decodeCategory(q.category);
      const src = bank.find((b) => b.id === q.id);
      expect([category, facet]).toEqual([src.category, src.facet]);
    }
  });

  it('détecte les erreurs', () => {
    expect(validateBank('x')).toEqual(['La banque doit être un tableau']);
    const bad = [
      { id: 'q1', text: 'pas normalisée', kind: 'choice', options: ['a'], category: 'gouts', facet: 'aime' },
      { id: 'q1', text: 'Pas normalisée ?', kind: 'zzz', options: [], category: 'nope', facet: 'nope', extra: 1 },
      { id: 'x', text: 'Ton {prenom} ?', kind: 'scale', options: null, category: 'gouts', facet: 'aime' },
      { id: 'q4', text: 'Ton salaire ?', kind: 'text', options: ['a'], category: 'gouts', facet: 'aime' },
      { id: 'q5', text: 'Choix ?', kind: 'choice', options: ['a', 'A'], category: 'gouts', facet: 'aime' },
      { id: 'q6', text: 'Long ?', kind: 'choice', options: ['A', 'B'.repeat(501)], category: 'gouts', facet: 'aime' },
      { id: 'q7', text: `${'L'.repeat(301)} ?`, kind: 'text', options: null, category: 'gouts', facet: 'aime' },
    ];
    const errs = validateBank(bad).join('\n');
    for (const m of ['Au moins 300', 'id invalide', 'id en double', 'champs inattendus', 'texte non normalisé', 'texte en double', 'seul {autre}', 'sujet exclu',
      'kind invalide', 'catégorie inconnue', 'facette inconnue', '2 à 6 options', 'options non normalisées', 'option trop longue', 'options doit valoir null',
      'échelle sans libellés', 'texte trop long', 'Répartition', 'trop peu fournie', 'jamais utilisée']) {
      expect(errs).toContain(m);
    }
  });
});
