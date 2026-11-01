import { describe, it, expect } from 'vitest';
import { todayParis, addDays, diffDays, weekday, isISODate, inRange } from '../../js/logic/dates.js';
import { normalizeAnswer, sameAnswer, normalizeQuestionText, normalizeOptions, fillOther } from '../../js/logic/normalize.js';

describe('dates (Europe/Paris)', () => {
  it('donne la date de Paris quel que soit le fuseau', () => {
    // 23h30 UTC le 31/10 = 00h30 à Paris le 01/11 (heure d'hiver, UTC+1)
    expect(todayParis(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    // 22h30 UTC en été = 00h30 à Paris (UTC+2)
    expect(todayParis(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
    expect(todayParis(new Date('2026-07-14T21:59:00Z'))).toBe('2026-07-14');
    // Un téléphone à New York le soir : c'est déjà le lendemain à Paris
    expect(todayParis(new Date('2026-03-01T04:00:00Z'))).toBe('2026-03-01');
    expect(todayParis()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gère le changement d\'heure', () => {
    expect(todayParis(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29');
    expect(todayParis(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('arithmétique de dates', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(diffDays('2026-01-01', '2026-01-08')).toBe(7);
    expect(diffDays('2026-01-08', '2026-01-01')).toBe(-7);
    expect(weekday('2026-11-01')).toBe(0); // dimanche
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-1-1')).toBe(false);
    expect(isISODate(null)).toBe(false);
    expect(inRange('2026-01-05', '2026-01-01', '2026-01-07')).toBe(true);
    expect(inRange('2026-01-08', '2026-01-01', '2026-01-07')).toBe(false);
    expect(inRange('2026-01-08', null, null)).toBe(true);
  });
});

describe('normalize', () => {
  it('compare les réponses sans casse, accents, espaces ni ponctuation finale', () => {
    expect(normalizeAnswer('  Crème   Brûlée ! ')).toBe('creme brulee');
    expect(sameAnswer('Été', 'ete.')).toBe(true);
    expect(sameAnswer("L’Italie", "l'italie")).toBe(true);
    expect(sameAnswer('Chat', 'Chien')).toBe(false);
    expect(sameAnswer('', '')).toBe(false);
    expect(sameAnswer(null, undefined)).toBe(false);
  });

  it('met en forme une question comme la banque', () => {
    expect(normalizeQuestionText("  qu'est-ce qui te fait rire??  ")).toBe('Qu’est-ce qui te fait rire ?');
    expect(normalizeQuestionText('ton plat préféré')).toBe('Ton plat préféré ?');
    expect(normalizeQuestionText('Ton  rêve ?')).toBe('Ton rêve ?');
    expect(normalizeQuestionText('Vraiment !')).toBe('Vraiment ?');
    expect(normalizeQuestionText('élan.')).toBe('Élan ?');
    expect(normalizeQuestionText('   ?? ')).toBe('');
    expect(normalizeQuestionText(undefined)).toBe('');
  });

  it('nettoie les options', () => {
    expect(normalizeOptions([' pizza ', 'Pizza', '', 'sushi', "l'été", null])).toEqual(['Pizza', 'Sushi', 'L’été']);
    expect(normalizeOptions()).toEqual([]);
  });

  it('remplace {autre}', () => {
    expect(fillOther('Que préfère {autre} ? Et {autre} ?', 'Léa')).toBe('Que préfère Léa ? Et Léa ?');
    expect(fillOther('Que préfère {autre} ?')).toBe('Que préfère ton/ta partenaire ?');
    expect(fillOther(null, 'x')).toBe('');
  });
});
