import { describe, it, expect, vi } from 'vitest';
import { settingsPatch } from '../../js/views/settings.js';
import { play } from '../../js/ui/sound.js';

const ok = { p1_name: ' Lucas ', p2_name: 'Léa', questions_per_day: '4', report_period_days: '7', report_start: '2026-11-02' };

describe('réglages', () => {
  it('construit le patch', () => {
    expect(settingsPatch(ok, true)).toEqual({ patch: { p1_name: 'Lucas', p2_name: 'Léa', questions_per_day: 4, report_period_days: 7, report_start: '2026-11-02' } });
    expect(settingsPatch(ok, false).patch).not.toHaveProperty('p2_name');
  });
  it('refuse les valeurs hors bornes', () => {
    expect(settingsPatch({ ...ok, p1_name: '' }, true).error).toMatch(/prénoms/);
    expect(settingsPatch({ ...ok, p2_name: '' }, true).error).toMatch(/prénoms/);
    expect(settingsPatch({ ...ok, p2_name: '' }, false).error).toBeUndefined();
    expect(settingsPatch({ ...ok, questions_per_day: '11' }, true).error).toMatch(/1 et 10/);
    expect(settingsPatch({ ...ok, questions_per_day: '-1' }, true).error).toMatch(/Illimité/);
    expect(settingsPatch({ ...ok, questions_per_day: '0' }, true).patch.questions_per_day).toBe(0);
    expect(settingsPatch({ ...ok, questions_per_day: '2.5' }, true).error).toMatch(/1 et 10/);
    expect(settingsPatch({ ...ok, report_period_days: '0' }, true).error).toMatch(/1 et 90/);
    expect(settingsPatch({ ...ok, report_start: '2026-02-30' }, true).error).toMatch(/Date/);
  });
});

describe('sons', () => {
  function fakeAudio() {
    const osc = { frequency: {}, connect: vi.fn((g) => g), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    return class { constructor() { this.currentTime = 0; this.destination = {}; } createOscillator() { return osc; } createGain() { return gain; } };
  }
  it('muets par défaut, joués si activés', () => {
    expect(play('win', { prefs: { sounds: false }, AudioCtx: fakeAudio() })).toBe(false);
    expect(play('win', { prefs: { sounds: true }, AudioCtx: null })).toBe(false);
    expect(play('inconnu', { prefs: { sounds: true }, AudioCtx: fakeAudio() })).toBe(false);
    expect(play('win', { prefs: { sounds: true }, AudioCtx: fakeAudio() })).toBe(true);
    expect(play('miss')).toBe(false); // préférences par défaut : sons coupés
  });
});
