import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryApi, injectAnalysis, DB_KEY } from '../../js/api/memory.js';
import { ApiError, messageFor, MESSAGES } from '../../js/api/errors.js';
import { seededRng } from '../../js/logic/draw.js';
import { createApi } from '../../js/api/index.js';

function makeStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

const NOW = new Date('2026-11-01T10:00:00Z');
const TODAY = '2026-11-01';
const bank = (n, kind = 'choice') => Array.from({ length: n }, (_, i) => ({
  id: `q${i}`, text: `Question ${i} ?`, kind, options: kind === 'choice' ? ['Oui', 'Non'] : null, category: 'gouts:aime',
}));

async function couple(opts = {}) {
  const storage = makeStorage();
  let t = NOW.getTime();
  const now = opts.now || (() => new Date((t += 1000)));
  const rng = seededRng(opts.seed || 3);
  const p1 = createMemoryApi({ storage, now, rng });
  const p2 = createMemoryApi({ storage, now, rng });
  const created = await p1.createRoom('  Lucas ');
  const joined = await p2.joinRoom(created.invite_code.toLowerCase(), 'Léa');
  return { storage, p1, p2, created, joined, now, rng };
}

const code = async (p) => { try { await p; } catch (e) { return e.code; } return 'ok'; };

describe('adaptateur mémoire — contrat', () => {
  let c;
  beforeEach(async () => { c = await couple(); });

  it('créer / rejoindre', async () => {
    expect(c.created).toMatchObject({ player: 1, room_id: expect.any(String), secret: expect.any(String), invite_code: expect.stringMatching(/^[0-9A-F]{8}$/) });
    expect(c.joined).toMatchObject({ player: 2, room_id: c.created.room_id, invite_code: null });
    expect(c.joined.secret).not.toBe(c.created.secret);
    const room = await c.p1.getRoom();
    expect(room).toMatchObject({ p1_name: 'Lucas', p2_name: 'Léa', invite_code: null, questions_per_day: 3, report_period_days: 7, report_start: TODAY });
    expect(Object.keys(room).some((k) => k.includes('secret'))).toBe(false);
    // le code ne sert qu'une fois
    const p3 = createMemoryApi({ storage: c.storage });
    expect(await code(p3.joinRoom(c.created.invite_code, 'Intrus'))).toBe('invalid_invite');
    expect(await code(p3.getRoom())).toBe('unauthorized');
    expect(await code(c.p1.createRoom(''))).toBe('invalid_name');
    expect(await code(c.p1.createRoom('x'.repeat(31)))).toBe('invalid_name');
  });

  it('rejoindre avec un prénom invalide', async () => {
    const s = makeStorage();
    const a = createMemoryApi({ storage: s });
    const { invite_code } = await a.createRoom('A');
    expect(await code(createMemoryApi({ storage: s }).joinRoom(invite_code, '  '))).toBe('invalid_name');
  });

  it('réglages : champs autorisés et bornes', async () => {
    expect(await c.p2.updateRoom({ questions_per_day: 5, report_period_days: 14, report_start: '2026-10-26', p2_name: ' Léa B ' })).toMatchObject({ questions_per_day: 5, report_period_days: 14, p2_name: 'Léa B' });
    expect((await c.p1.getRoom()).questions_per_day).toBe(5);
    for (const bad of [{ questions_per_day: 0 }, { questions_per_day: 11 }, { questions_per_day: 2.5 }, { report_period_days: 91 }, { report_start: 'demain' }, { invite_code: 'X' }]) {
      expect(await code(c.p1.updateRoom(bad))).toBe('invalid_settings');
    }
    expect(await code(c.p1.updateRoom({ p1_name: '' }))).toBe('invalid_name');
    expect(await code(c.p1.updateRoom({ p2_name: '' }))).toBe('invalid_name');
  });

  it('tirage : quota, sans doublon entre les 2 téléphones, date valide', async () => {
    const r1 = await c.p1.ensureRounds(TODAY, bank(20));
    const r2 = await c.p2.ensureRounds(TODAY, bank(20).reverse());
    expect(r1).toHaveLength(3);
    expect(r2.map((r) => r.id)).toEqual(r1.map((r) => r.id));
    expect(await c.p1.usedBankIds()).toHaveLength(3);
    // le lendemain, pas de reprise des questions déjà tirées
    const next = await c.p1.ensureRounds('2026-11-02', bank(4));
    expect(next).toHaveLength(1);
    expect(await code(c.p1.ensureRounds('2026-11-03', bank(1)))).toBe('invalid_date');
    expect(await code(c.p1.ensureRounds('2026-10-30', bank(1)))).toBe('invalid_date');
    expect(await code(c.p1.ensureRounds('n/a', bank(1)))).toBe('invalid_date');
    expect(await c.p1.ensureRounds('2026-10-31')).toEqual([]);
    expect(await c.p1.ensureRounds('2026-10-31', 'pas un tableau')).toEqual([]);
  });

  it('tirage : candidates invalides ignorées', async () => {
    const r = await c.p1.ensureRounds(TODAY, [
      { id: 'a', text: 'Q ?', kind: 'bidon' }, { id: 'b', text: 'Hi', kind: 'text' }, null,
      { id: 'c', text: 'x'.repeat(301), kind: 'text' }, { id: 'd', text: 'Bonne question ?', kind: 'scale' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ text: 'Bonne question ?', kind: 'scale', options: null, category: 'perso' });
  });

  it('anonymat : aucun champ source / author / bank_id exposé', async () => {
    await c.p2.addCustomQuestion({ text: 'Ma question perso ?', kind: 'text', category: 'gouts:aime' });
    const rounds = await c.p1.ensureRounds(TODAY, bank(5));
    const all = [...rounds, ...(await c.p1.listRounds({}))];
    for (const r of all) expect(Object.keys(r).sort()).toEqual(['category', 'created_at', 'id', 'kind', 'options', 'play_date', 'room_id', 'text']);
    expect(rounds.map((r) => r.text)).toContain('Ma question perso ?');
    // l'auteur voit seulement SES questions en attente ; plus rien une fois tirée
    expect(await c.p2.listMyPendingCustom()).toEqual([]);
    expect(await c.p1.listMyPendingCustom()).toEqual([]);
  });

  it('max perso par jour = max(1, n/2), priorité aux plus anciennes', async () => {
    for (let i = 0; i < 6; i++) await c.p1.addCustomQuestion({ text: `Perso ${i} ?`, kind: 'scale', category: 'reves:futur' });
    const day1 = await c.p1.ensureRounds(TODAY, bank(10));
    expect(day1.filter((r) => r.text.startsWith('Perso'))).toHaveLength(1); // 3/2 → 1
    await c.p1.updateRoom({ questions_per_day: 6 });
    const more = await c.p1.ensureRounds(TODAY, bank(10));
    expect(more).toHaveLength(6);
    expect(more.filter((r) => r.text.startsWith('Perso')).map((r) => r.text).sort()).toEqual(['Perso 0 ?', 'Perso 1 ?', 'Perso 2 ?']);
    expect(await c.p1.listMyPendingCustom()).toHaveLength(3);
    await c.p1.updateRoom({ questions_per_day: 1 });
    const d2 = await c.p1.ensureRounds('2026-11-02', []);
    expect(d2).toHaveLength(1); // max(1, 0) = 1 perso même avec 1 question/jour
  });

  it('ordre aléatoire (par id), indépendant de l’ordre de création', async () => {
    const orders = new Set();
    for (let seed = 1; seed <= 8; seed++) {
      const k = await couple({ seed });
      await k.p1.addCustomQuestion({ text: 'Perso ?', kind: 'text', category: 'couple:amour' });
      await k.p1.updateRoom({ questions_per_day: 4 });
      const r = await k.p1.ensureRounds(TODAY, bank(10));
      const ids = r.map((x) => x.id);
      expect(ids).toEqual([...ids].sort());
      orders.add(r.findIndex((x) => x.text === 'Perso ?'));
    }
    expect(orders.size).toBeGreaterThan(1); // la question perso n'est pas toujours au même rang
  });

  it('anti-triche : réponse de l’autre invisible avant d’avoir répondu', async () => {
    const [r] = await c.p1.ensureRounds(TODAY, bank(3));
    await c.p2.submitAnswer(r.id, 'Oui', 'Non');
    expect(await c.p1.listAnswers([r.id])).toEqual([]);
    expect(await c.p2.listAnswers([r.id])).toHaveLength(1);
    await c.p1.submitAnswer(r.id, 'Non', 'Oui');
    const seen = await c.p1.listAnswers([r.id]);
    expect(seen.map((a) => a.player).sort()).toEqual([1, 2]);
    expect(Object.keys(seen[0]).sort()).toEqual(['created_at', 'guess_other', 'player', 'round_id', 'self_answer']);
  });

  it('pas de double réponse, validations', async () => {
    const [r] = await c.p1.ensureRounds(TODAY, bank(3));
    await c.p1.submitAnswer(r.id, 'Oui', 'Oui');
    expect(await code(c.p1.submitAnswer(r.id, 'Non', 'Non'))).toBe('already_answered');
    expect(await code(c.p2.submitAnswer(r.id, '', 'x'))).toBe('invalid_answer');
    expect(await code(c.p2.submitAnswer(r.id, 'x', 'y'.repeat(501)))).toBe('invalid_answer');
    expect(await code(c.p2.submitAnswer(r.id, null, 'x'))).toBe('invalid_answer');
    expect(await code(c.p2.submitAnswer('inconnu', 'x', 'y'))).toBe('not_found');
  });

  it('jugement : uniquement text, après 2 réponses, par soi-même, modifiable', async () => {
    const rounds = await c.p1.ensureRounds(TODAY, [...bank(1, 'text'), ...bank(2).map((q) => ({ ...q, id: 'c' + q.id }))]);
    const t = rounds.find((r) => r.kind === 'text');
    const ch = rounds.find((r) => r.kind === 'choice');
    await c.p1.submitAnswer(t.id, 'Mer', 'Montagne');
    expect(await code(c.p1.judge(t.id, true))).toBe('not_allowed');
    await c.p2.submitAnswer(t.id, 'Montagne', 'Mer');
    expect(await c.p1.judge(t.id, true)).toMatchObject({ judge: 1, correct: true });
    expect(await c.p1.judge(t.id, false)).toMatchObject({ judge: 1, correct: false });
    expect(await c.p2.listJudgments([t.id])).toHaveLength(1);
    await c.p1.submitAnswer(ch.id, 'Oui', 'Oui');
    await c.p2.submitAnswer(ch.id, 'Oui', 'Oui');
    expect(await code(c.p1.judge(ch.id, true))).toBe('not_allowed');
    expect(await code(c.p1.judge('zzz', true))).toBe('not_allowed');
    expect(await c.p1.listJudgments()).toEqual([]);
    expect(await c.p1.listAnswers()).toEqual([]);
  });

  it('questions perso : validation', async () => {
    expect(await code(c.p1.addCustomQuestion({ text: 'Hi', kind: 'text' }))).toBe('invalid_question');
    expect(await code(c.p1.addCustomQuestion({ text: 'Choix ?', kind: 'choice', options: ['A'] }))).toBe('invalid_question');
    expect(await code(c.p1.addCustomQuestion({ text: 'Choix ?', kind: 'choice', options: ['1', '2', '3', '4', '5', '6', '7'] }))).toBe('invalid_question');
    expect(await code(c.p1.addCustomQuestion({ text: 'Quoi ?', kind: 'autre' }))).toBe('invalid_question');
    expect(await code(c.p1.addCustomQuestion())).toBe('invalid_question');
    const q = await c.p1.addCustomQuestion({ text: 'Choix ?', kind: 'choice', options: ['A', 'B'] });
    expect(q).toMatchObject({ text: 'Choix ?', options: ['A', 'B'], category: 'perso' });
    expect(Object.keys(q)).not.toContain('author');
    expect(await c.p1.listMyPendingCustom()).toHaveLength(1);
    expect(await c.p2.listMyPendingCustom()).toHaveLength(0); // surprise pour l'autre
  });

  it('listRounds : filtre par dates, tri jour puis id', async () => {
    await c.p1.ensureRounds('2026-10-31', bank(3));
    await c.p1.ensureRounds(TODAY, bank(6));
    const all = await c.p2.listRounds();
    expect(all).toHaveLength(6);
    expect(all.map((r) => r.play_date)).toEqual(['2026-10-31', '2026-10-31', '2026-10-31', TODAY, TODAY, TODAY]);
    expect(await c.p2.listRounds({ from: TODAY, to: TODAY })).toHaveLength(3);
    expect(await c.p2.listRounds({ to: '2026-10-31' })).toHaveLength(3);
  });

  it('rapports IA', async () => {
    expect(await c.p1.listAnalyses()).toEqual([]);
    injectAnalysis(c.storage, { id: 'b', room_id: c.created.room_id, period_start: '2026-10-26', period_end: '2026-11-01', compatibility: 70, content: {} });
    injectAnalysis(c.storage, { id: 'a', room_id: c.created.room_id, period_start: '2026-10-19', period_end: '2026-10-25', compatibility: 60, content: {} });
    injectAnalysis(c.storage, { id: 'x', room_id: 'autre', period_start: '2026-10-19', period_end: '2026-10-25', compatibility: 1, content: {} });
    expect((await c.p2.listAnalyses()).map((a) => a.id)).toEqual(['a', 'b']);
    const s = makeStorage();
    injectAnalysis(s, { id: 'z' });
    expect(JSON.parse(s.getItem(DB_KEY)).analyses).toHaveLength(1);
  });

  it('reconnexion d’un appareil : nouveau secret, ancien déconnecté, code à usage unique', async () => {
    const code1 = await c.p2.createDeviceLink();
    const code2 = await c.p2.createDeviceLink(); // remplace le précédent
    expect(code2).toMatch(/^[0-9A-F]{8}$/);
    const phone = createMemoryApi({ storage: c.storage });
    expect(await code(phone.claimDeviceLink(code1))).toBe('invalid_link');
    const res = await phone.claimDeviceLink(` ${code2.toLowerCase()} `);
    expect(res).toMatchObject({ room_id: c.created.room_id, player: 2 });
    expect(phone.secret).toBe(res.secret);
    expect((await phone.getRoom()).p2_name).toBe('Léa');
    expect(await code(c.p2.getRoom())).toBe('unauthorized');
    expect(await code(phone.claimDeviceLink(code2))).toBe('invalid_link');
    const c1 = await c.p1.createDeviceLink();
    const ph1 = createMemoryApi({ storage: c.storage });
    expect((await ph1.claimDeviceLink(c1)).player).toBe(1);
  });

  it('lien expiré après 15 min', async () => {
    let t = NOW.getTime();
    const storage = makeStorage();
    const a = createMemoryApi({ storage, now: () => new Date(t) });
    await a.createRoom('A');
    const link = await a.createDeviceLink();
    t += 15 * 60000 + 1;
    expect(await code(createMemoryApi({ storage, now: () => new Date(t) }).claimDeviceLink(link))).toBe('invalid_link');
  });

  it('secret absent ou base corrompue', async () => {
    const storage = makeStorage();
    const a = createMemoryApi({ storage });
    expect(await code(a.listRounds())).toBe('unauthorized');
    storage.setItem(DB_KEY, '{oups');
    expect(await code(a.joinRoom('X', 'Y'))).toBe('invalid_invite');
    a.setSecret('n/a');
    expect(await code(a.getRoom())).toBe('unauthorized');
  });
});

describe('mode démo : partenaire simulé', () => {
  it('le partenaire répond après moi et valide mes textes', async () => {
    const storage = makeStorage();
    const me = createMemoryApi({ storage, now: () => NOW, rng: seededRng(9) });
    const res = await me.startDemo('Lucas');
    expect(res).toMatchObject({ player: 1, invite_code: null });
    const room = await me.getRoom();
    expect(room.p2_name).toBe('Alex');
    expect(await me.listAnalyses()).toHaveLength(1);
    await me.updateRoom({ questions_per_day: 4 });
    const rounds = await me.ensureRounds(TODAY, [...bank(2, 'text').map((q) => ({ ...q, id: 't' + q.id })), ...bank(2, 'scale').map((q) => ({ ...q, id: 's' + q.id })), ...bank(2)]);
    expect(rounds).toHaveLength(4);
    const ids = rounds.map((r) => r.id);
    expect(await me.listAnswers(ids)).toEqual([]); // le partenaire n'a rien dévoilé
    for (const r of rounds) await me.submitAnswer(r.id, r.kind === 'scale' ? '3' : 'Oui', r.kind === 'scale' ? '4' : 'Non');
    const answers = await me.listAnswers(ids);
    expect(answers.filter((a) => a.player === 2)).toHaveLength(4);
    for (const a of answers.filter((x) => x.player === 2)) expect(a.self_answer.length).toBeGreaterThan(0);
    const texts = rounds.filter((r) => r.kind === 'text').map((r) => r.id);
    const judgments = await me.listJudgments(texts);
    expect(judgments.filter((j) => j.judge === 2)).toHaveLength(texts.length);
  });

  it('une partie normale n’a pas de partenaire simulé', async () => {
    const c = await couple();
    const [r] = await c.p1.ensureRounds(TODAY, bank(3));
    await c.p1.submitAnswer(r.id, 'Oui', 'Oui');
    expect(await c.p1.listAnswers([r.id])).toHaveLength(1);
  });
});

describe('erreurs et sélection d’adaptateur', () => {
  it('messages français', () => {
    expect(new ApiError('invalid_invite').message).toMatch(/invitation/);
    expect(new ApiError('nimporte').code).toBe('unknown');
    expect(new ApiError('network', new Error('x')).cause).toBeInstanceOf(Error);
    expect(messageFor(new ApiError('invalid_link'))).toBe(MESSAGES.invalid_link);
    expect(messageFor(new Error('boom'))).toBe(MESSAGES.unknown);
  });

  it('createApi en démo renvoie l’adaptateur mémoire', async () => {
    const api = await createApi({ search: '?demo=1', secret: 's' });
    expect(api.mode).toBe('memory');
    expect(api.secret).toBe('s');
  });

  it('stockage par défaut : localStorage, sinon mémoire', async () => {
    localStorage.clear();
    const a = createMemoryApi();
    await a.createRoom('A');
    expect(localStorage.getItem(DB_KEY)).toContain('"rooms"');
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('bloqué'); } });
    try {
      const b = createMemoryApi();
      expect((await b.createRoom('B')).player).toBe(1);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', desc);
    }
  });
});
