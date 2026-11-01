import { describe, it, expect } from 'vitest';
import { buildCustomQuestion, buildText, FACET_LABELS, KIND_LABELS } from '../../js/logic/custom.js';
import { validateBank } from '../../scripts/bank-rules.mjs';
import { decodeCategory } from '../../js/logic/category.js';
import { FACETS } from '../../js/logic/compat.js';
import { readFileSync } from 'node:fs';

const bank = JSON.parse(readFileSync('data/questions.json', 'utf8'));
const base = { category: 'gouts', facet: 'aime' };

/** Une question perso doit passer EXACTEMENT les mêmes règles qu'une question de la banque. */
function asBankItem(q, id = 'q999') {
  const { category, facet } = decodeCategory(q.category);
  return { id, text: q.text, kind: q.kind, options: q.options, category, facet };
}
const itemErrors = (q) => validateBank([...bank, asBankItem(q)]);

describe('questions perso (anonymat)', () => {
  it('texte libre normalisé comme la banque', () => {
    const { question, errors } = buildCustomQuestion({ ...base, text: "  qu'est-ce qui te fait   rêver??", kind: 'text' });
    expect(errors).toEqual([]);
    expect(question).toEqual({ text: 'Qu’est-ce qui te fait rêver ?', kind: 'text', options: null, category: 'gouts:aime' });
    expect(itemErrors(question)).toEqual([]);
  });

  it('QCM : options nettoyées, dédupliquées', () => {
    const { question } = buildCustomQuestion({ ...base, text: 'plutôt mer ou montagne', kind: 'choice', options: [' mer', 'Mer', 'montagne ', ''] });
    expect(question.options).toEqual(['Mer', 'Montagne']);
    expect(itemErrors(question)).toEqual([]);
  });

  it('échelle : libellés intégrés « (1 = …, 5 = …) » comme la banque', () => {
    const { question } = buildCustomQuestion({ ...base, text: 'à quel point aimes-tu {autre}', kind: 'scale', low: ' Un peu, ', high: '(Passionnément)' });
    expect(question.text).toBe('À quel point aimes-tu {autre} (1 = un peu, 5 = passionnément) ?');
    expect(itemErrors(question)).toEqual([]);
    expect(buildText({ text: 'Tu aimes ?', kind: 'scale' })).toBe('Tu aimes (1 = pas du tout, 5 = énormément) ?');
    expect(buildText({ text: 'Tu aimes (1 = a, 5 = b) ?', kind: 'scale', low: 'x', high: 'y' })).toBe('Tu aimes (1 = x, 5 = y) ?');
    expect(buildText({ text: '', kind: 'scale' })).toBe('');
  });

  it('erreurs lisibles', () => {
    expect(buildCustomQuestion({ ...base, text: '', kind: 'text' }).errors[0]).toMatch(/au moins 3/);
    expect(buildCustomQuestion({ ...base, text: 'x'.repeat(301), kind: 'text' }).errors[0]).toMatch(/trop longue/);
    expect(buildCustomQuestion({ ...base, text: 'Choix ?', kind: 'choice', options: ['a', 'A'] }).errors[0]).toMatch(/entre 2 et 6/);
    expect(buildCustomQuestion({ ...base, text: 'Choix ?', kind: 'choice', options: ['a', 'b'.repeat(101)] }).errors[0]).toMatch(/trop long/);
    expect(buildCustomQuestion({ ...base, text: 'Quoi ?', kind: 'x' }).errors[0]).toMatch(/type/);
    expect(buildCustomQuestion({ text: 'Quoi ?', kind: 'text', category: 'z', facet: 'aime' }).errors[0]).toMatch(/catégorie/);
    expect(buildCustomQuestion({ text: 'Quoi ?', kind: 'text', category: 'gouts', facet: 'z' }).errors[0]).toMatch(/de quoi/);
    expect(buildCustomQuestion({ ...base, text: 'Et {toi} ?', kind: 'text' }).errors[0]).toMatch(/accolades/);
    expect(buildCustomQuestion({ ...base, text: 'Et {toi} ?', kind: 'text' }).question).toBeNull();
  });

  it('libellés pour toutes les facettes et types', () => {
    for (const f of FACETS) expect(FACET_LABELS[f]).toBeTruthy();
    expect(Object.keys(KIND_LABELS)).toEqual(['choice', 'scale', 'text']);
  });
});
