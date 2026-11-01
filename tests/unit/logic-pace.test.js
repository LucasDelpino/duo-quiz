import { describe, it, expect } from 'vitest';
import { paceState, paceMessage, BLOCK_AT, WARN_AFTER } from '../../js/logic/pace.js';
import { createMemoryApi } from '../../js/api/memory.js';
import { createSupabaseApi } from '../../js/api/supabase.js';

const names = { 1: 'Lucas', 2: 'Léa' };

describe('rythme commun — logique', () => {
  it('seuils : retard > 10 alerte, avance > 10 prévient, avance ≥ 15 bloque', () => {
    expect([WARN_AFTER, BLOCK_AT]).toEqual([10, 15]);
    expect(paceState({ me: 10, them: 0 }).state).toBe('ok');
    expect(paceState({ me: 11, them: 0 }).state).toBe('ahead');
    expect(paceState({ me: 14, them: 0 })).toMatchObject({ state: 'ahead', left: 1 });
    expect(paceState({ me: 15, them: 0 }).state).toBe('blocked');
    expect(paceState({ me: 0, them: 10 }).state).toBe('ok');
    expect(paceState({ me: 0, them: 11 })).toMatchObject({ state: 'behind', lead: -11 });
    expect(paceState({ me: 20, them: 5, warn_after: 3, block_at: 15 }).state).toBe('blocked');
    expect(paceState(null)).toBeNull();
    expect(paceState({ me: 'x', them: -3 })).toMatchObject({ me: 0, them: 0, state: 'ok' });
  });

  it('messages', () => {
    expect(paceMessage(paceState({ me: 1, them: 1 }), names, 1)).toBeNull();
    expect(paceMessage(paceState({ me: 0, them: 12 }), names, 1)).toMatchObject({ title: 'Tu es en retard !', cta: 'play' });
    expect(paceMessage(paceState({ me: 0, them: 12 }), names, 1).text).toContain('Léa a 12 réponses d’avance');
    expect(paceMessage(paceState({ me: 15, them: 0 }), names, 2).title).toBe('Attends Lucas !');
    expect(paceMessage(paceState({ me: 13, them: 0 }), names, 1).text).toContain('Encore 2 réponses');
  });
});

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('rythme commun — adaptateurs', () => {
  it('mémoire : blocage à 15 d’avance (réponse et tirage), déblocage quand l’autre répond', async () => {
    const storage = makeStorage();
    let t = Date.parse('2026-11-01T10:00:00Z');
    const now = () => new Date((t += 1000));
    const p1 = createMemoryApi({ storage, now });
    const p2 = createMemoryApi({ storage, now });
    const { invite_code } = await p1.createRoom('Lucas');
    await p2.joinRoom(invite_code, 'Léa');
    await p1.updateRoom({ questions_per_day: 10 });
    const bank = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, text: `Question ${i} ?`, kind: 'text', options: null, category: 'gouts:aime' }));
    const r1 = await p1.ensureRounds('2026-10-31', bank);
    const r2 = await p1.ensureRounds('2026-11-01', bank);
    const all = [...r1, ...r2];
    for (const r of all.slice(0, 15)) await p1.submitAnswer(r.id, 'a', 'b');
    expect(await p1.pace()).toEqual({ me: 15, them: 0, warn_after: 10, block_at: 15 });
    expect(await p2.pace()).toMatchObject({ me: 0, them: 15 });
    await expect(p1.submitAnswer(all[15].id, 'a', 'b')).rejects.toMatchObject({ code: 'too_far_ahead' });
    await p1.updateRoom({ questions_per_day: 0 });
    await expect(p1.drawMore('2026-11-01', bank)).rejects.toMatchObject({ code: 'too_far_ahead' });
    await p2.submitAnswer(all[0].id, 'c', 'd');
    await expect(p1.submitAnswer(all[15].id, 'a', 'b')).resolves.toMatchObject({ player: 1 });
  });

  it('supabase : RPC pace, null si indisponible', async () => {
    const createClient = () => ({ from: () => ({}), rpc: (name) => Promise.resolve(name === 'pace' ? { data: { me: 3, them: 1 }, error: null } : { data: null, error: null }) });
    const api = await createSupabaseApi({ secret: 's', room_id: 'r', player: 1, createClient });
    expect(await api.pace()).toEqual({ me: 3, them: 1 });
    const missing = await createSupabaseApi({ secret: 's', room_id: 'r', player: 1, createClient: () => ({ rpc: () => Promise.resolve({ data: null, error: { code: 'PGRST202' } }) }) });
    expect(await missing.pace()).toBeNull();
  });
});
