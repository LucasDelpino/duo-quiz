import { describe, it, expect } from 'vitest';
import { createMemoryApi, UNLIMITED_BASE } from '../../js/api/memory.js';
import { createSupabaseApi } from '../../js/api/supabase.js';

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const TODAY = '2026-11-01';
const bank = (n) => Array.from({ length: n }, (_, i) => ({ id: `b${i}`, text: `Question ${i} ?`, kind: 'text', options: null, category: 'gouts:aime' }));
const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'ok'; };

async function couple() {
  const storage = makeStorage();
  let t = Date.parse('2026-11-01T10:00:00Z');
  const now = () => new Date((t += 1000));
  const p1 = createMemoryApi({ storage, now });
  const p2 = createMemoryApi({ storage, now });
  const { invite_code } = await p1.createRoom('Lucas');
  await p2.joinRoom(invite_code, 'Léa');
  return { p1, p2 };
}
const answerAll = async (api, rounds) => { for (const r of rounds) await api.submitAnswer(r.id, 'a', 'b').catch(() => {}); };

describe('mode illimité (questions_per_day = 0)', () => {
  it('base de 3 questions, puis +3 à la demande, anonymat conservé (1 perso max par lot)', async () => {
    const { p1, p2 } = await couple();
    for (let i = 0; i < 6; i += 1) await p2.addCustomQuestion({ text: `Perso ${i} ?`, kind: 'text', category: 'gouts:aime' });
    expect(await code(p1.drawMore(TODAY, bank(20)))).toBe('not_unlimited');
    await p1.updateRoom({ questions_per_day: 0 });
    expect((await p2.getRoom()).questions_per_day).toBe(0);

    let rounds = await p1.ensureRounds(TODAY, bank(20));
    expect(rounds).toHaveLength(UNLIMITED_BASE);
    expect(await code(p1.drawMore(TODAY, bank(20)))).toBe('finish_first');
    await answerAll(p1, rounds);
    rounds = await p1.drawMore(TODAY, bank(20));
    expect(rounds).toHaveLength(6);
    expect(await p1.ensureRounds(TODAY, bank(20))).toHaveLength(6); // pas de nouveau tirage automatique
    await answerAll(p1, rounds);
    rounds = await p1.drawMore(TODAY, bank(20), 99);
    expect(rounds).toHaveLength(16); // borné à 10 par lot
    expect(rounds.every((r) => !('source' in r) && !('author' in r) && !('bank_id' in r))).toBe(true);
    const perso = rounds.filter((r) => r.text.startsWith('Perso')).length;
    expect(perso).toBe(6); // 1 + 1 + les 4 restantes (plafond du 3e lot : 5)
    // L'autre joueur n'a pas fini : il ne peut pas tirer
    expect(await code(p2.drawMore(TODAY, bank(20)))).toBe('finish_first');
  });

  it('supabase : RPC draw_more, triée par id, erreurs traduites', async () => {
    const calls = [];
    const createClient = () => ({
      from: () => ({}),
      rpc: (name, args) => {
        calls.push({ name, args });
        if (args.p_count === 9) return Promise.resolve({ data: null, error: { message: 'finish_first' } });
        return Promise.resolve({ data: [{ id: 'b' }, { id: 'a' }], error: null });
      },
    });
    const api = await createSupabaseApi({ secret: 's', room_id: 'r', player: 1, createClient });
    expect((await api.drawMore(TODAY, [{ id: 'q1' }])).map((r) => r.id)).toEqual(['a', 'b']);
    expect(calls[0]).toEqual({ name: 'draw_more', args: { p_date: TODAY, p_candidates: [{ id: 'q1' }], p_count: 3 } });
    await expect(api.drawMore(TODAY, [], 9)).rejects.toMatchObject({ code: 'finish_first' });
  });
});
