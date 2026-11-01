import { describe, it, expect } from 'vitest';
import { encodeCategory, decodeCategory, categoryLabel, CATEGORIES, CATEGORY_LABELS } from '../../js/logic/category.js';
import { facetOf } from '../../js/logic/compat.js';

describe('category', () => {
  it('encode / décode « categorie:facette »', () => {
    expect(encodeCategory('gouts', 'aime')).toBe('gouts:aime');
    expect(encodeCategory('gouts')).toBe('gouts');
    expect(decodeCategory('reves:futur')).toEqual({ category: 'reves', facet: 'futur' });
    expect(decodeCategory('perso')).toEqual({ category: 'perso', facet: null });
    expect(decodeCategory(null)).toEqual({ category: '', facet: null });
  });

  it('libellés', () => {
    expect(categoryLabel('et-si:fun')).toBe('Et si…');
    expect(categoryLabel('perso')).toBe('Divers');
    for (const c of CATEGORIES) expect(CATEGORY_LABELS[c]).toBeTruthy();
  });

  it('la facette encodée est utilisée par compat', () => {
    expect(facetOf({ category: 'humour:valeurs' })).toBe('valeurs');
    expect(facetOf({ category: 'humour' })).toBe('fun');
  });
});
