// Adaptateur mémoire : reproduit EXACTEMENT les règles SQL (schema.sql + migration 001).
// La « base » est partagée via un stockage clé/valeur (localStorage en démo) ; chaque instance
// représente un appareil identifié par son secret, comme l'en-tête x-player-secret.
import { BLOCK_AT, WARN_AFTER } from '../logic/pace.js';
import { ApiError } from './errors.js';
import { todayParis, addDays } from '../logic/dates.js';
import { DEMO_PARTNER, PARTNER_TEXTS, PARTNER_QUESTIONS, fakeAnalysis } from './demo-data.js';

export const DB_KEY = 'duo-quiz:demo-db';
const ROUND_COLUMNS = ['id', 'room_id', 'play_date', 'text', 'kind', 'options', 'category', 'created_at'];
/** Mode illimité : questions de base par jour avant « Encore des questions ». */
export const UNLIMITED_BASE = 3;
const ROOM_COLUMNS = ['id', 'p1_name', 'p2_name', 'invite_code', 'questions_per_day', 'report_period_days', 'report_start', 'created_at', 'spicy'];
const KINDS = ['choice', 'scale', 'text'];
const emptyDb = () => ({ rooms: [], custom_questions: [], rounds: [], answers: [], judgments: [], analyses: [], device_links: [] });

const pick = (row, cols) => Object.fromEntries(cols.map((c) => [c, row[c] ?? null]));
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const len = (s) => [...String(s ?? '')].length;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function defaultStorage() {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch { /* indisponible */ }
  return memoryStorage();
}

export function createMemoryApi({ storage = defaultStorage(), secret = null, now = () => new Date(), rng = Math.random } = {}) {
  let mySecret = secret;

  const hex = (n) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join('');
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
  const nowISO = () => now().toISOString();
  // Le serveur ne stocke que le hash du secret ; ici une empreinte simple suffit (démo locale).
  const hash = (s) => `h:${s}`;

  function load() {
    try {
      return { ...emptyDb(), ...(JSON.parse(storage.getItem(DB_KEY)) || {}) };
    } catch {
      return emptyDb();
    }
  }
  const save = (db) => storage.setItem(DB_KEY, JSON.stringify(db));

  /** Équivalent de my_room() / my_player(). */
  function me(db) {
    if (!mySecret) throw new ApiError('unauthorized');
    const h = hash(mySecret);
    const room = db.rooms.find((r) => r.p1_secret_hash === h || r.p2_secret_hash === h);
    if (!room) throw new ApiError('unauthorized');
    return { room, player: room.p1_secret_hash === h ? 1 : 2 };
  }

  const validName = (n) => typeof n === 'string' && len(n.trim()) >= 1 && len(n.trim()) <= 30;

  // ---------- Partenaire simulé (démo solo) ----------
  function simulatePartner(db, room) {
    if (!room.simulated) return;
    const rounds = db.rounds.filter((r) => r.room_id === room.id);
    for (const r of rounds) {
      const mine = db.answers.find((a) => a.round_id === r.id && a.player === 1);
      if (!mine) continue;
      if (!db.answers.some((a) => a.round_id === r.id && a.player === 2)) {
        const self = partnerAnswer(r);
        const guess = rng() < 0.6 ? mine.self_answer : partnerAnswer(r);
        db.answers.push({ round_id: r.id, room_id: room.id, player: 2, self_answer: self, guess_other: guess, created_at: nowISO() });
      }
      if (r.kind === 'text' && !db.judgments.some((j) => j.round_id === r.id && j.judge === 2)) {
        db.judgments.push({ round_id: r.id, room_id: room.id, judge: 2, correct: rng() < 0.6, created_at: nowISO() });
      }
    }
  }

  function partnerAnswer(r) {
    if (r.kind === 'scale') return String(1 + Math.floor(rng() * 5));
    if (r.kind === 'choice' && Array.isArray(r.options) && r.options.length) return r.options[Math.floor(rng() * r.options.length)];
    return PARTNER_TEXTS[Math.floor(rng() * PARTNER_TEXTS.length)];
  }

  /** Lecture authentifiée + simulation éventuelle, puis persistance. */
  function withMe(fn, { write = false } = {}) {
    const db = load();
    const ctx = me(db);
    const before = ctx.room.simulated ? JSON.stringify(db) : null;
    if (ctx.room.simulated) simulatePartner(db, ctx.room);
    const res = fn(db, ctx);
    if (write || (before !== null && before !== JSON.stringify(db))) {
      if (ctx.room.simulated) simulatePartner(db, ctx.room);
      save(db);
    }
    return clone(res);
  }

  function checkDate(date) {
    const today = todayParis(now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || date > addDays(today, 1) || date < addDays(today, -1)) {
      throw new ApiError('invalid_date');
    }
  }

  /** Équivalent de fill_rounds : complète jusqu'à `want` questions dont au plus `maxCustom` perso. */
  function fill(db, room, date, want, maxCustom, candidates) {
    const ofDay = () => db.rounds.filter((r) => r.room_id === room.id && r.play_date === date);
    let n = ofDay().length;
    let nCustom = ofDay().filter((r) => r.source === 'custom').length;
    const base = { room_id: room.id, play_date: date };
    while (n < want && nCustom < maxCustom) {
      const cq = db.custom_questions
        .filter((c) => c.room_id === room.id && !c.used)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))[0];
      if (!cq) break;
      cq.used = true;
      db.rounds.push({ ...base, id: uuid(), source: 'custom', bank_id: null, author: cq.author, text: cq.text, kind: cq.kind, options: cq.options ?? null, category: cq.category, created_at: nowISO() });
      n += 1;
      nCustom += 1;
    }
    for (const c of Array.isArray(candidates) ? candidates : []) {
      if (n >= want) break;
      const ok = c && KINDS.includes(c.kind) && len(c.text) >= 3 && len(c.text) <= 300
        && !db.rounds.some((r) => r.room_id === room.id && r.bank_id === c.id);
      if (!ok) continue;
      db.rounds.push({ ...base, id: uuid(), source: 'bank', bank_id: c.id, author: null, text: c.text, kind: c.kind, options: c.options ?? null, category: c.category ?? 'perso', created_at: nowISO() });
      n += 1;
    }
    return ofDay().sort((a, b) => (a.id < b.id ? -1 : 1)).map((r) => pick(r, ROUND_COLUMNS));
  }

  /** Avance d'un joueur (réponses à lui − réponses de l'autre), comme lead_of(). */
  function leadOf(db, room, player) {
    const mine = db.answers.filter((a) => a.room_id === room.id && a.player === player).length;
    const theirs = db.answers.filter((a) => a.room_id === room.id && a.player !== player).length;
    return mine - theirs;
  }

  const api = {
    mode: 'memory',

    get secret() { return mySecret; },
    setSecret(s) { mySecret = s; },

    async createRoom(name) {
      if (!validName(name)) throw new ApiError('invalid_name');
      const db = load();
      const s = hex(48);
      const room = {
        id: uuid(), p1_name: name.trim(), p2_name: null, p1_secret_hash: hash(s), p2_secret_hash: null,
        invite_code: hex(8).toUpperCase(), questions_per_day: 3, report_period_days: 7, spicy: 1,
        report_start: todayParis(now()), created_at: nowISO(),
      };
      db.rooms.push(room);
      save(db);
      mySecret = s;
      return { room_id: room.id, secret: s, player: 1, invite_code: room.invite_code };
    },

    async joinRoom(code, name) {
      const db = load();
      const c = String(code ?? '').trim().toUpperCase();
      const room = db.rooms.find((r) => r.invite_code && r.invite_code === c && !r.p2_secret_hash);
      if (!room) throw new ApiError('invalid_invite');
      if (!validName(name)) throw new ApiError('invalid_name');
      const s = hex(48);
      Object.assign(room, { p2_name: name.trim(), p2_secret_hash: hash(s), invite_code: null });
      save(db);
      mySecret = s;
      return { room_id: room.id, secret: s, player: 2, invite_code: null };
    },

    /** Démo solo : crée la partie et fait rejoindre un partenaire simulé. */
    async startDemo(name) {
      const res = await api.createRoom(name);
      const db = load();
      const room = db.rooms.find((r) => r.id === res.room_id);
      Object.assign(room, { p2_name: DEMO_PARTNER, p2_secret_hash: hash(hex(48)), invite_code: null, simulated: true });
      for (const q of PARTNER_QUESTIONS) {
        db.custom_questions.push({ id: uuid(), room_id: room.id, author: 2, ...q, used: false, created_at: nowISO() });
      }
      const end = addDays(room.report_start, -1);
      db.analyses.push(fakeAnalysis(room.id, addDays(end, -6), end));
      save(db);
      return { ...res, invite_code: null };
    },

    async getRoom() {
      return withMe((db, { room }) => pick(room, ROOM_COLUMNS));
    },

    async updateRoom(patch = {}) {
      return withMe((db, { room }) => {
        const allowed = ['p1_name', 'p2_name', 'questions_per_day', 'report_period_days', 'report_start', 'spicy'];
        for (const [k, v] of Object.entries(patch)) {
          if (!allowed.includes(k)) throw new ApiError('invalid_settings');
          if (k === 'p1_name' && !validName(v)) throw new ApiError('invalid_name');
          if (k === 'p2_name' && v !== null && !validName(v)) throw new ApiError('invalid_name');
          if (k === 'questions_per_day' && !(Number.isInteger(v) && v >= 0 && v <= 10)) throw new ApiError('invalid_settings');
          if (k === 'spicy' && !(Number.isInteger(v) && v >= 0 && v <= 2)) throw new ApiError('invalid_settings');
          if (k === 'report_period_days' && !(Number.isInteger(v) && v >= 1 && v <= 90)) throw new ApiError('invalid_settings');
          if (k === 'report_start' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new ApiError('invalid_settings');
        }
        for (const [k, v] of Object.entries(patch)) room[k] = typeof v === 'string' && k.endsWith('_name') ? v.trim() : v;
        return pick(room, ROOM_COLUMNS);
      }, { write: true });
    },

    async usedBankIds() {
      return withMe((db, { room }) => db.rounds.filter((r) => r.room_id === room.id && r.bank_id).map((r) => r.bank_id));
    },

    async ensureRounds(date, candidates = []) {
      return withMe((db, { room }) => {
        checkDate(date);
        const target = room.questions_per_day === 0 ? UNLIMITED_BASE : room.questions_per_day;
        return fill(db, room, date, target, Math.max(1, Math.floor(target / 2)), candidates);
      }, { write: true });
    },

    /** Mode illimité (questions_per_day = 0) : comme la RPC draw_more. */
    async drawMore(date, candidates = [], count = 3) {
      return withMe((db, { room, player }) => {
        checkDate(date);
        if (room.questions_per_day !== 0) throw new ApiError('not_unlimited');
        if (leadOf(db, room, player) >= BLOCK_AT) throw new ApiError('too_far_ahead');
        const day = db.rounds.filter((r) => r.room_id === room.id && r.play_date === date);
        if (day.some((r) => !db.answers.some((a) => a.round_id === r.id && a.player === player))) throw new ApiError('finish_first');
        const cnt = Math.min(10, Math.max(1, Number.isInteger(count) ? count : 3));
        const nCustom = day.filter((r) => r.source === 'custom').length;
        return fill(db, room, date, day.length + cnt, nCustom + Math.max(1, Math.floor(cnt / 2)), candidates);
      }, { write: true });
    },

    async listRounds({ from = null, to = null } = {}) {
      return withMe((db, { room }) => db.rounds
        .filter((r) => r.room_id === room.id && (!from || r.play_date >= from) && (!to || r.play_date <= to))
        .sort((a, b) => (a.play_date < b.play_date ? -1 : a.play_date > b.play_date ? 1 : a.id < b.id ? -1 : 1))
        .map((r) => pick(r, ROUND_COLUMNS)));
    },

    async listAnswers(roundIds = []) {
      return withMe((db, { room, player }) => {
        const ids = new Set(roundIds);
        const answered = new Set(db.answers.filter((a) => a.room_id === room.id && a.player === player).map((a) => a.round_id));
        // Anti-triche : la réponse de l'autre n'est visible qu'après avoir répondu soi-même.
        return db.answers
          .filter((a) => a.room_id === room.id && ids.has(a.round_id) && (a.player === player || answered.has(a.round_id)))
          .map(({ round_id, player: p, self_answer, guess_other, created_at }) => ({ round_id, player: p, self_answer, guess_other, created_at }));
      });
    },

    async submitAnswer(roundId, self, guess) {
      return withMe((db, { room, player }) => {
        const round = db.rounds.find((r) => r.id === roundId && r.room_id === room.id);
        if (!round) throw new ApiError('not_found');
        if (db.answers.some((a) => a.round_id === roundId && a.player === player)) throw new ApiError('already_answered');
        if (leadOf(db, room, player) >= BLOCK_AT) throw new ApiError('too_far_ahead');
        const s = String(self ?? '');
        const g = String(guess ?? '');
        if (len(s) < 1 || len(s) > 500 || len(g) < 1 || len(g) > 500) throw new ApiError('invalid_answer');
        const row = { round_id: roundId, room_id: room.id, player, self_answer: s, guess_other: g, created_at: nowISO() };
        db.answers.push(row);
        return { round_id: roundId, player, self_answer: s, guess_other: g, created_at: row.created_at };
      }, { write: true });
    },

    async listJudgments(roundIds = []) {
      return withMe((db, { room }) => {
        const ids = new Set(roundIds);
        return db.judgments.filter((j) => j.room_id === room.id && ids.has(j.round_id))
          .map(({ round_id, judge, correct, created_at }) => ({ round_id, judge, correct, created_at }));
      });
    },

    async judge(roundId, correct) {
      return withMe((db, { room, player }) => {
        const round = db.rounds.find((r) => r.id === roundId && r.room_id === room.id);
        const both = db.answers.filter((a) => a.round_id === roundId).length === 2;
        if (!round || round.kind !== 'text' || !both) throw new ApiError('not_allowed');
        let j = db.judgments.find((x) => x.round_id === roundId && x.judge === player);
        if (j) j.correct = Boolean(correct);
        else db.judgments.push((j = { round_id: roundId, room_id: room.id, judge: player, correct: Boolean(correct), created_at: nowISO() }));
        return { round_id: roundId, judge: player, correct: j.correct, created_at: j.created_at };
      }, { write: true });
    },

    async addCustomQuestion({ text, kind, options = null, category } = {}) {
      return withMe((db, { room, player }) => {
        const okChoice = kind !== 'choice' || (Array.isArray(options) && options.length >= 2 && options.length <= 6);
        if (len(text) < 3 || len(text) > 300 || !KINDS.includes(kind) || !okChoice) throw new ApiError('invalid_question');
        const row = { id: uuid(), room_id: room.id, author: player, text, kind, options: kind === 'choice' ? options : options ?? null, category: category || 'perso', used: false, created_at: nowISO() };
        db.custom_questions.push(row);
        return pick(row, ['id', 'text', 'kind', 'options', 'category', 'created_at']);
      }, { write: true });
    },

    async listMyPendingCustom() {
      return withMe((db, { room, player }) => db.custom_questions
        .filter((c) => c.room_id === room.id && c.author === player && !c.used)
        .map((c) => pick(c, ['id', 'text', 'kind', 'options', 'category', 'created_at'])));
    },

    async listAnalyses() {
      return withMe((db, { room }) => db.analyses.filter((a) => a.room_id === room.id)
        .sort((a, b) => (a.period_end < b.period_end ? -1 : 1))
        .map((a) => pick(a, ['id', 'room_id', 'period_start', 'period_end', 'compatibility', 'content', 'created_at'])));
    },

    /** Équivalent de pace() : compteurs de réponses des deux joueurs. */
    async pace() {
      return withMe((db, { room, player }) => ({
        me: db.answers.filter((a) => a.room_id === room.id && a.player === player).length,
        them: db.answers.filter((a) => a.room_id === room.id && a.player !== player).length,
        warn_after: WARN_AFTER,
        block_at: BLOCK_AT,
      }));
    },

    /** Équivalent de day_progress : compteurs seulement (anti-triche préservé). */
    async dayProgress(date) {
      return withMe((db, { room }) => {
        const ids = new Set(db.rounds.filter((r) => r.room_id === room.id && r.play_date === date).map((r) => r.id));
        return [1, 2].map((p) => {
          const mine = db.answers.filter((a) => a.room_id === room.id && a.player === p);
          const last = mine.reduce((m, a) => (!m || a.created_at > m ? a.created_at : m), null);
          return { player: p, answered: mine.filter((a) => ids.has(a.round_id)).length, total: ids.size, last_answer_at: last };
        });
      });
    },

    async createDeviceLink() {
      return withMe((db, { room, player }) => {
        const t = now().getTime();
        db.device_links = db.device_links.filter((l) => Date.parse(l.expires_at) >= t && !(l.room_id === room.id && l.player === player));
        const code = hex(8).toUpperCase();
        db.device_links.push({ code, room_id: room.id, player, expires_at: new Date(t + 15 * 60000).toISOString() });
        return code;
      }, { write: true });
    },

    async claimDeviceLink(code) {
      const db = load();
      const c = String(code ?? '').trim().toUpperCase();
      const link = db.device_links.find((l) => l.code === c && Date.parse(l.expires_at) > now().getTime());
      if (!link) throw new ApiError('invalid_link');
      db.device_links = db.device_links.filter((l) => l !== link);
      const room = db.rooms.find((r) => r.id === link.room_id);
      const s = hex(48);
      room[link.player === 1 ? 'p1_secret_hash' : 'p2_secret_hash'] = hash(s); // l'ancien appareil est déconnecté
      save(db);
      mySecret = s;
      return { room_id: room.id, secret: s, player: link.player };
    },
  };
  return api;
}

/** Injecte un rapport IA factice (tests e2e / démo). */
export function injectAnalysis(storage, analysis) {
  const db = JSON.parse(storage.getItem(DB_KEY) || 'null') || emptyDb();
  db.analyses.push(analysis);
  storage.setItem(DB_KEY, JSON.stringify(db));
}
