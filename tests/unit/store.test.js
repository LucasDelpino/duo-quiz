import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as store from '../../js/store.js';

const S = { room_id: 'r1', player: 1, secret: 's3cr3t', names: { 1: 'Lucas' } };

describe('store', () => {
  beforeEach(() => localStorage.clear());

  it('sauve et relit une session', () => {
    expect(store.hasSession()).toBe(false);
    store.saveSession(S);
    expect(store.loadSession()).toEqual(S);
    expect(store.hasSession()).toBe(true);
  });

  it('refuse une session invalide', () => {
    expect(() => store.saveSession({ ...S, player: 3 })).toThrow();
    expect(() => store.saveSession({ ...S, secret: '' })).toThrow();
    localStorage.setItem('duo-quiz:session', '{pas du json');
    expect(store.loadSession()).toBeNull();
    localStorage.setItem('duo-quiz:session', JSON.stringify({ room_id: 'x' }));
    expect(store.loadSession()).toBeNull();
  });

  it('met à jour les prénoms et efface la session', () => {
    expect(store.updateNames({ 2: 'Léa' })).toBeNull();
    store.saveSession(S);
    expect(store.updateNames({ 2: 'Léa' }).names).toEqual({ 1: 'Lucas', 2: 'Léa' });
    store.clearSession();
    expect(store.loadSession()).toBeNull();
  });

  it('gère les préférences avec valeurs par défaut', () => {
    expect(store.loadPrefs()).toEqual({ sounds: false });
    expect(store.savePrefs({ sounds: true })).toEqual({ sounds: true });
    expect(store.loadPrefs().sounds).toBe(true);
  });

  it('donne un prénom de repli', () => {
    expect(store.playerName(S, 1)).toBe('Lucas');
    expect(store.playerName(S, 2)).toBe('Joueur 2');
    expect(store.playerName(null, 1)).toBe('Joueur 1');
  });

  it('survit à un localStorage qui lève des erreurs', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const spy2 = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('x'); });
    expect(() => store.saveSession(S)).not.toThrow();
    expect(() => store.clearSession()).not.toThrow();
    spy.mockRestore();
    spy2.mockRestore();
  });
});
