import { describe, it, expect, vi, beforeEach } from 'vitest';
import { textFor, answerLabel, loadBank, players } from '../../js/game.js';
import { formatDay, formatShort } from '../../js/logic/dates.js';
import { saveSession } from '../../js/store.js';

const names = { 1: 'Lucas', 2: 'Léa' };

describe('game utils', () => {
  beforeEach(() => localStorage.clear());

  it('{autre} vu par chaque joueur', () => {
    expect(textFor('Qu’aimes-tu chez {autre} ?', 1, names)).toBe('Qu’aimes-tu chez Léa ?');
    expect(textFor('Qu’aimes-tu chez {autre} ?', 2, names)).toBe('Qu’aimes-tu chez Lucas ?');
  });

  it('libellé des réponses', () => {
    expect(answerLabel({ kind: 'scale' }, '4', 1, names)).toBe('4/5');
    expect(answerLabel({ kind: 'choice' }, 'Avec {autre}', 2, names)).toBe('Avec Lucas');
    expect(answerLabel({ kind: 'text' }, '', 1, names)).toBe('—');
    expect(answerLabel({ kind: 'text' }, null, 1, names)).toBe('—');
  });

  it('joueurs depuis la session', () => {
    expect(players()).toMatchObject({ me: 1, them: 2, names: { 1: 'Joueur 1', 2: 'Joueur 2' } });
    saveSession({ room_id: 'r', player: 2, secret: 's', names: { 1: 'Lucas' } });
    expect(players()).toMatchObject({ me: 2, them: 1, names: { 1: 'Lucas', 2: 'ton/ta partenaire' } });
  });

  it('banque chargée une fois, relancée après une erreur', async () => {
    const bad = vi.fn().mockResolvedValue({ ok: false });
    await expect(loadBank(bad)).rejects.toThrow('bank');
    const good = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'q001' }] });
    expect(await loadBank(good)).toEqual([{ id: 'q001' }]);
    expect(await loadBank(good)).toEqual([{ id: 'q001' }]);
    expect(good).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledWith('data/questions.json');
  });

  it('dates en français', () => {
    expect(formatDay('2026-11-01')).toBe('dimanche 1 novembre');
    expect(formatShort('2026-11-01')).toBe('1 nov.');
  });
});
