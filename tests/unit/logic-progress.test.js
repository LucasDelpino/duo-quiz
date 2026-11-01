import { describe, it, expect, vi } from 'vitest';
import { progressSummary, progressMessage, ago, shouldShowPopup, POPUP_EVERY_MS } from '../../js/logic/progress.js';
import { createMemoryApi } from '../../js/api/memory.js';
import { createSupabaseApi } from '../../js/api/supabase.js';

const rows = (a1, a2, total = 3) => [
  { player: 1, answered: a1, total, last_answer_at: a1 ? '2026-11-01T08:00:00Z' : null },
  { player: 2, answered: a2, total, last_answer_at: a2 ? '2026-11-01T09:00:00Z' : null },
];
const names = { 1: 'Lucas', 2: 'Léa' };

describe('progression du jour — logique', () => {
  it('états selon les compteurs, vus par chaque joueur', () => {
    expect(progressSummary(rows(0, 0), 1).state).toBe('none');
    expect(progressSummary(rows(0, 2), 1).state).toBe('them_started');
    expect(progressSummary(rows(0, 3), 1).state).toBe('them_done');
    expect(progressSummary(rows(1, 0), 1).state).toBe('me_started');
    expect(progressSummary(rows(3, 1), 1).state).toBe('me_done');
    expect(progressSummary(rows(3, 3), 1).state).toBe('all_done');
    expect(progressSummary(rows(3, 1), 2).state).toBe('them_done');
    const s = progressSummary(rows(1, 2), 2);
    expect(s.me.answered).toBe(2);
    expect(s.them.answered).toBe(1);
  });

  it('entrées inexploitables → null, valeurs bornées', () => {
    expect(progressSummary(null, 1)).toBeNull();
    expect(progressSummary([], 1)).toBeNull();
    expect(progressSummary(rows(0, 0, 0), 1)).toBeNull();
    expect(progressSummary(rows(1, 1), 3)).toBeNull();
    expect(progressSummary(rows(9, -2), 1)).toMatchObject({ me: { answered: 3 }, them: { answered: 0 } });
  });

  it('messages motivants avec le prénom de l’autre', () => {
    const m = (a1, a2) => progressMessage(progressSummary(rows(a1, a2), 1), names, 1);
    expect(m(0, 2)).toMatchObject({ title: 'Léa a commencé !', cta: 'play' });
    expect(m(0, 2).text).toContain('2/3');
    expect(m(0, 3).text).toContain('encore 3 questions');
    expect(m(2, 3).text).toContain('encore 1 question.');
    expect(m(3, 1)).toMatchObject({ cta: null });
    expect(m(3, 3)).toMatchObject({ cta: 'reveal' });
    expect(m(0, 0).title).toBe('Personne n’a encore joué');
    expect(m(1, 0).text).toContain('1/3');
    expect(progressMessage(null, names, 1)).toBeNull();
    expect(progressMessage(progressSummary(rows(0, 1), 1), {}, 1).title).toContain('ton/ta partenaire');
  });

  it('ago() lisible', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    expect(ago('2026-11-01T11:59:40Z', now)).toBe('à l’instant');
    expect(ago('2026-11-01T11:48:00Z', now)).toBe('il y a 12 min');
    expect(ago('2026-11-01T09:00:00Z', now)).toBe('il y a 3 h');
    expect(ago('2026-10-31T10:00:00Z', now)).toBe('hier');
    expect(ago('2026-10-28T12:00:00Z', now)).toBe('il y a 4 j');
    expect(ago('nope', now)).toBeNull();
  });

  it('pop-up au plus toutes les 30 min', () => {
    expect(shouldShowPopup(null, 1e12)).toBe(true);
    expect(shouldShowPopup(String(1e12), 1e12 + 60_000)).toBe(false);
    expect(shouldShowPopup(String(1e12), 1e12 + POPUP_EVERY_MS)).toBe(true);
  });
});

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('dayProgress — adaptateurs', () => {
  it('mémoire : compteurs des deux joueurs sans révéler les réponses', async () => {
    const storage = makeStorage();
    let t = Date.parse('2026-11-01T10:00:00Z');
    const now = () => new Date((t += 1000));
    const p1 = createMemoryApi({ storage, now });
    const p2 = createMemoryApi({ storage, now });
    const { invite_code } = await p1.createRoom('Lucas');
    await p2.joinRoom(invite_code, 'Léa');
    const bank = [1, 2, 3].map((i) => ({ id: `b${i}`, text: `Question ${i} ?`, kind: 'text', options: null, category: 'gouts:aime' }));
    const rounds = await p2.ensureRounds('2026-11-01', bank);
    await p2.submitAnswer(rounds[0].id, 'a', 'b');
    await p2.submitAnswer(rounds[1].id, 'a', 'b');
    const prog = await p1.dayProgress('2026-11-01');
    expect(prog).toEqual([
      { player: 1, answered: 0, total: 3, last_answer_at: null },
      { player: 2, answered: 2, total: 3, last_answer_at: expect.any(String) },
    ]);
    expect(JSON.stringify(prog)).not.toContain('"a"');
    expect(await p1.listAnswers(rounds.map((r) => r.id))).toEqual([]);
    expect((await p1.dayProgress('2026-10-31'))[1]).toMatchObject({ answered: 0, total: 0 });
  });

  it('supabase : RPC day_progress, null si la migration manque', async () => {
    const calls = [];
    const createClient = (url, key, opts) => ({
      from: () => ({}),
      rpc: (name, args) => {
        calls.push({ name, args, headers: opts.global.headers });
        return Promise.resolve(args.p_date === 'missing'
          ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
          : { data: rows(1, 2), error: null });
      },
    });
    const api = await createSupabaseApi({ secret: 's', room_id: 'r', player: 1, createClient });
    expect(await api.dayProgress('2026-11-01')).toEqual(rows(1, 2));
    expect(calls[0]).toMatchObject({ name: 'day_progress', args: { p_date: '2026-11-01' }, headers: { 'x-player-secret': 's' } });
    expect(await api.dayProgress('missing')).toBeNull();
    const broken = await createSupabaseApi({ secret: 's', room_id: 'r', player: 1, createClient: () => ({ rpc: vi.fn(() => { throw new Error('réseau'); }) }) });
    expect(await broken.dayProgress('2026-11-01')).toBeNull();
  });
});
