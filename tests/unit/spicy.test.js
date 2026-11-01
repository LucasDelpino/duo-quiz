import { describe, it, expect } from 'vitest';
import { drawCandidates, seededRng } from '../../js/logic/draw.js';
import { settingsPatch } from '../../js/views/settings.js';
import { createMemoryApi } from '../../js/api/memory.js';
import { createSupabaseApi } from '../../js/api/supabase.js';
import { CATEGORIES } from '../../js/logic/category.js';

const bank = CATEGORIES.flatMap((c) => Array.from({ length: 30 }, (_, i) => ({ id: `${c}${i}`, text: `${c} ${i} ?`, kind: 'text', options: null, category: c, facet: 'fun' })));
const hot = (list) => list.filter((q) => q.category.startsWith('coquin')).length;

describe('questions coquines : dosage du tirage', () => {
  it('0 = jamais, 1 = une catégorie parmi 11, 2 = environ une question sur 3', () => {
    expect(hot(drawCandidates(bank, [], { count: 20, spicy: 0, rng: seededRng(1) }))).toBe(0);
    const normal = drawCandidates(bank, [], { count: 22, spicy: 1, rng: seededRng(2) });
    expect(hot(normal)).toBe(2);
    const often = drawCandidates(bank, [], { count: 21, spicy: 2, rng: seededRng(3) });
    expect(often).toHaveLength(21);
    expect(hot(often)).toBe(7);
    for (let i = 0; i < 21; i += 3) expect(hot(often.slice(i, i + 3))).toBe(1); // une par groupe de 3
    expect(new Set(often.map((q) => q.id)).size).toBe(21);
    expect(often[0].category).toMatch(/:fun$/); // facette toujours encodée
  });
  it('épuisement : si plus de coquines, le tirage continue sans', () => {
    const used = bank.filter((q) => q.category === 'coquin').map((q) => q.id);
    const out = drawCandidates(bank, used, { count: 9, spicy: 2, rng: seededRng(4) });
    expect(out).toHaveLength(9);
    expect(hot(out)).toBe(0);
  });
});

describe('questions coquines : réglage', () => {
  const ok = { p1_name: 'Lucas', p2_name: 'Léa', questions_per_day: '3', report_period_days: '7', report_start: '2026-11-02' };
  it('envoyé seulement s’il change', () => {
    expect(settingsPatch({ ...ok, spicy: '1' }, true, { spicy: 1 }).patch.spicy).toBeUndefined();
    expect(settingsPatch({ ...ok, spicy: '2' }, true, { spicy: 1 }).patch.spicy).toBe(2);
    expect(settingsPatch({ ...ok, spicy: '0' }, true, {}).patch.spicy).toBe(0);
    expect(settingsPatch({ ...ok, spicy: '5' }, true, {}).error).toMatch(/coquines/);
  });

  it('mémoire : défaut 1, valeurs 0 à 2', async () => {
    const m = new Map();
    const api = createMemoryApi({ storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) } });
    await api.createRoom('Lucas');
    expect((await api.getRoom()).spicy).toBe(1);
    expect((await api.updateRoom({ spicy: 2 })).spicy).toBe(2);
    await expect(api.updateRoom({ spicy: 3 })).rejects.toMatchObject({ code: 'invalid_settings' });
  });

  it('supabase : repli propre si la colonne spicy n’existe pas encore (migration 005)', async () => {
    const calls = [];
    const createClient = () => ({
      rpc: () => Promise.resolve({ data: null, error: null }),
      from: () => {
        const call = { chain: [] };
        calls.push(call);
        const b = new Proxy({}, {
          get(_, prop) {
            if (prop === 'then') {
              const cols = call.chain.find((c) => c[0] === 'select')?.[1] || '';
              const res = cols.includes('spicy')
                ? { data: null, error: { code: '42703', message: 'column rooms.spicy does not exist' } }
                : { data: { id: 'r', p1_name: 'Lucas', questions_per_day: 3 }, error: null };
              return (ok, ko) => Promise.resolve(res).then(ok, ko);
            }
            return (...args) => { call.chain.push([prop, ...args]); return b; };
          },
        });
        return b;
      },
    });
    const api = await createSupabaseApi({ secret: 's', room_id: 'r', player: 1, createClient });
    expect(await api.getRoom()).toMatchObject({ id: 'r', spicy: 1 });
    expect(await api.updateRoom({ questions_per_day: 4 })).toMatchObject({ spicy: 1 });
    await expect(api.updateRoom({ spicy: 2 })).rejects.toMatchObject({ code: 'needs_migration' });
  });
});
