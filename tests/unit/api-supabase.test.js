import { describe, it, expect, vi } from 'vitest';
import { createSupabaseApi, translateError, ROUND_COLS } from '../../js/api/supabase.js';
import { ApiError } from '../../js/api/errors.js';

/** Faux client supabase-js : enregistre les appels et répond via `respond(call)`. */
function fakeSupabase(respond = () => ({ data: null, error: null })) {
  const clients = [];
  const calls = [];
  const createClient = vi.fn((url, key, opts) => {
    const client = { url, key, opts };
    const builder = (table) => {
      const call = { table, chain: [], headers: opts.global.headers };
      calls.push(call);
      const b = new Proxy({}, {
        get(_, prop) {
          if (prop === 'then') {
            return (ok, ko) => Promise.resolve().then(() => respond(call)).then(ok, ko);
          }
          return (...args) => { call.chain.push([prop, ...args]); return b; };
        },
      });
      return b;
    };
    client.from = (t) => builder(t);
    client.rpc = (name, args) => {
      const call = { rpc: name, args, chain: [], headers: opts.global.headers };
      calls.push(call);
      return Promise.resolve().then(() => respond(call));
    };
    clients.push(client);
    return client;
  });
  return { createClient, calls, clients };
}

const session = { secret: 'sekret', room_id: 'room-1', player: 2 };
const methods = (call) => call.chain.map((c) => c[0]);
const arg = (call, m) => call.chain.find((c) => c[0] === m)?.slice(1);

describe('adaptateur Supabase (client mocké)', () => {
  it('en-tête x-player-secret, sans session persistée', async () => {
    const f = fakeSupabase(() => ({ data: [], error: null }));
    const api = await createSupabaseApi({ ...session, url: 'https://x.supabase.co', key: 'anon', createClient: f.createClient });
    await api.listRounds();
    const [url, key, opts] = f.createClient.mock.calls[0];
    expect([url, key]).toEqual(['https://x.supabase.co', 'anon']);
    expect(opts.global.headers).toEqual({ 'x-player-secret': 'sekret' });
    expect(opts.auth.persistSession).toBe(false);
    expect(api.mode).toBe('supabase');
    expect(api.secret).toBe('sekret');
  });

  it('createRoom / joinRoom / claimDeviceLink : adopte le nouveau secret (nouveau client)', async () => {
    const f = fakeSupabase((c) => {
      if (c.rpc === 'create_room') return { data: { room_id: 'r', secret: 's1', player: 1, invite_code: 'ABCD1234' }, error: null };
      if (c.rpc === 'join_room') return { data: { room_id: 'r', secret: 's2', player: 2, invite_code: null }, error: null };
      if (c.rpc === 'claim_device_link') return { data: { room_id: 'r', secret: 's3', player: 2 }, error: null };
      return { data: [], error: null };
    });
    const api = await createSupabaseApi({ createClient: f.createClient });
    expect(await api.createRoom(' Lucas ')).toMatchObject({ player: 1, invite_code: 'ABCD1234' });
    expect(f.calls[0]).toMatchObject({ rpc: 'create_room', args: { p_name: 'Lucas' }, headers: {} });
    await api.listRounds();
    expect(f.calls.at(-1).headers).toEqual({ 'x-player-secret': 's1' });
    await api.joinRoom(' abcd1234 ', 'Léa');
    expect(f.calls.at(-1)).toMatchObject({ rpc: 'join_room', args: { p_code: 'ABCD1234', p_name: 'Léa' } });
    await api.claimDeviceLink('ef01');
    expect(f.calls.at(-1).args).toEqual({ p_code: 'EF01' });
    await api.submitAnswer('r1', 'a', 'b');
    expect(f.calls.at(-1).headers).toEqual({ 'x-player-secret': 's3' });
    expect(api.secret).toBe('s3');
    await expect(api.createRoom('  ')).rejects.toMatchObject({ code: 'invalid_name' });
    await expect(api.joinRoom('X', 'y'.repeat(31))).rejects.toMatchObject({ code: 'invalid_name' });
  });

  it('colonnes explicites : jamais source / author / bank_id ni *', async () => {
    const f = fakeSupabase((c) => (c.chain.some((x) => x[0] === 'maybeSingle') ? { data: { id: 'room-1' }, error: null } : { data: [], error: null }));
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    await api.getRoom();
    await api.listRounds({ from: '2026-10-01', to: '2026-10-31' });
    await api.listAnswers(['a']);
    await api.listJudgments(['a']);
    await api.listMyPendingCustom();
    await api.listAnalyses();
    for (const call of f.calls) {
      const cols = arg(call, 'select')[0];
      expect(cols).not.toMatch(/\*|source|author|bank_id|secret/);
    }
    const rounds = f.calls.find((c) => c.table === 'rounds');
    expect(arg(rounds, 'select')).toEqual([ROUND_COLS]);
    expect(arg(rounds, 'gte')).toEqual(['play_date', '2026-10-01']);
    expect(arg(rounds, 'lte')).toEqual(['play_date', '2026-10-31']);
    expect(rounds.chain.filter((c) => c[0] === 'order').map((c) => c[1])).toEqual(['play_date', 'id']);
    expect(arg(f.calls.find((c) => c.table === 'custom_questions'), 'eq')).toEqual(['used', false]);
  });

  it('listes vides sans appel réseau, données nulles → []', async () => {
    const f = fakeSupabase(() => ({ data: null, error: null }));
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    expect(await api.listAnswers([])).toEqual([]);
    expect(await api.listJudgments()).toEqual([]);
    expect(f.calls).toHaveLength(0);
    expect(await api.listRounds()).toEqual([]);
    expect(await api.listAnswers(['x'])).toEqual([]);
    expect(await api.listJudgments(['x'])).toEqual([]);
    expect(await api.listMyPendingCustom()).toEqual([]);
    expect(await api.listAnalyses()).toEqual([]);
    expect(await api.usedBankIds()).toEqual([]);
    expect(await api.ensureRounds('2026-11-01')).toEqual([]);
    await expect(api.getRoom()).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('usedBankIds et ensureRounds (ordre par id)', async () => {
    const f = fakeSupabase((c) => {
      if (c.rpc === 'used_bank_ids') return { data: ['q1', { used_bank_ids: 'q2' }, { bank_id: 'q3' }, null], error: null };
      return { data: [{ id: 'c' }, { id: 'a' }, { id: 'b' }], error: null };
    });
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    expect(await api.usedBankIds()).toEqual(['q1', 'q2', 'q3']);
    const cands = [{ id: 'q9', text: 'T ?', kind: 'text', options: null, category: 'gouts:aime' }];
    expect((await api.ensureRounds('2026-11-01', cands)).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(f.calls.at(-1)).toMatchObject({ rpc: 'ensure_rounds', args: { p_date: '2026-11-01', p_candidates: cands } });
  });

  it('écritures : réponse, question perso, réglages', async () => {
    const f = fakeSupabase(() => ({ data: { ok: true }, error: null }));
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    await api.submitAnswer('r1', 'Oui', 'Non');
    expect(arg(f.calls[0], 'insert')[0]).toEqual({ round_id: 'r1', room_id: 'room-1', player: 2, self_answer: 'Oui', guess_other: 'Non' });
    await api.addCustomQuestion({ text: 'Perso ?', kind: 'scale', category: 'reves:futur' });
    expect(arg(f.calls[1], 'insert')[0]).toEqual({ room_id: 'room-1', author: 2, text: 'Perso ?', kind: 'scale', options: null, category: 'reves:futur' });
    await api.addCustomQuestion({ text: 'Perso ?', kind: 'text' });
    expect(arg(f.calls[2], 'insert')[0].category).toBe('perso');
    await api.updateRoom({ questions_per_day: 4 });
    expect(methods(f.calls[3])).toEqual(['update', 'eq', 'select', 'single']);
    expect(arg(f.calls[3], 'eq')).toEqual(['id', 'room-1']);
    await expect(api.updateRoom({ invite_code: 'x' })).rejects.toMatchObject({ code: 'invalid_settings' });
    await expect(api.submitAnswer('r1', '', 'x')).rejects.toMatchObject({ code: 'invalid_answer' });
    await expect(api.addCustomQuestion({ text: 'Q ?', kind: 'choice', options: ['a'] })).rejects.toMatchObject({ code: 'invalid_question' });
    await expect(api.addCustomQuestion()).rejects.toMatchObject({ code: 'invalid_question' });
    expect(f.calls).toHaveLength(4);
  });

  it('écritures impossibles sans session', async () => {
    const f = fakeSupabase();
    const api = await createSupabaseApi({ createClient: f.createClient });
    await expect(api.submitAnswer('r', 'a', 'b')).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(api.updateRoom({})).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(api.judge('r', true)).rejects.toMatchObject({ code: 'unauthorized' });
    await expect(api.addCustomQuestion({})).rejects.toMatchObject({ code: 'unauthorized' });
    api.setSession(session);
    await api.submitAnswer('r', 'a', 'b');
    expect(f.calls[0].headers).toEqual({ 'x-player-secret': 'sekret' });
  });

  it('jugement : met à jour, sinon insère', async () => {
    let existing = false;
    const f = fakeSupabase((c) => {
      if (methods(c)[0] === 'update') return { data: existing ? [{ round_id: 'r', judge: 2, correct: false }] : [], error: null };
      return { data: { round_id: 'r', judge: 2, correct: true }, error: null };
    });
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    expect(await api.judge('r', 1)).toMatchObject({ correct: true });
    expect(arg(f.calls[0], 'update')[0]).toEqual({ correct: true });
    expect(f.calls[0].chain.filter((c) => c[0] === 'eq').map((c) => c.slice(1))).toEqual([['round_id', 'r'], ['judge', 2]]);
    expect(arg(f.calls[1], 'insert')[0]).toEqual({ round_id: 'r', room_id: 'room-1', judge: 2, correct: true });
    existing = true;
    expect(await api.judge('r', false)).toMatchObject({ correct: false });
    expect(f.calls).toHaveLength(3);
  });

  it('jugement refusé (RLS) → not_allowed', async () => {
    const f = fakeSupabase((c) => (methods(c)[0] === 'update' ? { data: [], error: null } : { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }));
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    await expect(api.judge('r', true)).rejects.toMatchObject({ code: 'not_allowed' });
    const g = fakeSupabase((c) => (methods(c)[0] === 'update' ? { data: [], error: null } : { data: null, error: { message: 'bizarre' } }));
    const api2 = await createSupabaseApi({ ...session, createClient: g.createClient });
    await expect(api2.judge('r', true)).rejects.toMatchObject({ code: 'not_allowed' });
    const h = fakeSupabase(() => Promise.reject(new TypeError('Failed to fetch')));
    const api3 = await createSupabaseApi({ ...session, createClient: h.createClient });
    await expect(api3.judge('r', true)).rejects.toMatchObject({ code: 'network' });
  });

  it('réglage hors bornes (contrainte SQL) → invalid_settings', async () => {
    const f = fakeSupabase(() => ({ data: null, error: { code: '23514', message: 'violates check constraint "rooms_questions_per_day_check"' } }));
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    await expect(api.updateRoom({ questions_per_day: 42 })).rejects.toMatchObject({ code: 'invalid_settings' });
    const g = fakeSupabase(() => ({ data: null, error: { message: 'unauthorized' } }));
    const api2 = await createSupabaseApi({ ...session, createClient: g.createClient });
    await expect(api2.updateRoom({ questions_per_day: 4 })).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('device link', async () => {
    const f = fakeSupabase(() => ({ data: 'AB12CD34', error: null }));
    const api = await createSupabaseApi({ ...session, createClient: f.createClient });
    expect(await api.createDeviceLink()).toBe('AB12CD34');
    expect(f.calls[0].rpc).toBe('create_device_link');
  });

  it('traduction des erreurs SQL en français', async () => {
    const cases = [
      [{ message: 'invalid_invite', code: 'P0001' }, 'invalid_invite'],
      [{ message: 'unauthorized' }, 'unauthorized'],
      [{ message: 'invalid_date' }, 'invalid_date'],
      [{ message: 'x', details: 'invalid_link' }, 'invalid_link'],
      [{ code: '23505', message: 'duplicate key value violates unique constraint "answers_pkey"' }, 'already_answered'],
      [{ code: 'PGRST301', message: 'JWT' }, 'not_allowed'],
      [new TypeError('Failed to fetch'), 'network'],
      [{ message: 'Load failed' }, 'network'],
      [{ message: 'autre chose' }, 'unknown'],
      [undefined, 'unknown'],
    ];
    for (const [err, code] of cases) expect(translateError(err).code).toBe(code);
    const e = new ApiError('invalid_link');
    expect(translateError(e)).toBe(e);
    expect(translateError({ message: 'invalid_invite' }).message).toMatch(/invitation/);
    for (const rpc of ['join_room', 'claim_device_link']) {
      const f = fakeSupabase(() => ({ data: null, error: { message: rpc === 'join_room' ? 'invalid_invite' : 'invalid_link' } }));
      const api = await createSupabaseApi({ createClient: f.createClient });
      const p = rpc === 'join_room' ? api.joinRoom('X', 'Léa') : api.claimDeviceLink('X');
      await expect(p).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('createApi choisit Supabase hors démo (import paresseux de vendor.js évité par injection)', async () => {
    vi.resetModules();
    vi.doMock('../../js/api/supabase.js', () => ({ createSupabaseApi: vi.fn(async (o) => ({ mode: 'supabase', o })) }));
    const { createApi } = await import('../../js/api/index.js');
    const api = await createApi({ search: '', session });
    expect(api).toMatchObject({ mode: 'supabase', o: { secret: 'sekret', room_id: 'room-1', player: 2 } });
    vi.doUnmock('../../js/api/supabase.js');
  });
});
