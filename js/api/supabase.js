// Adaptateur Supabase. Chaque appareil s'identifie par l'en-tête x-player-secret (jamais journalisé).
// Colonnes toujours explicites : `rounds` n'expose plus source / author / bank_id (un select('*') échoue).
import { ApiError, MESSAGES } from './errors.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const ROUND_COLS = 'id, room_id, play_date, text, kind, options, category, created_at';
export const ROOM_COLS = 'id, p1_name, p2_name, invite_code, questions_per_day, report_period_days, report_start, created_at, spicy';
/** Sans la colonne `spicy` (migration 005 pas encore exécutée) : on retombe sur « de temps en temps ». */
export const ROOM_COLS_LEGACY = 'id, p1_name, p2_name, invite_code, questions_per_day, report_period_days, report_start, created_at';
const missingSpicy = (e) => /spicy/.test(`${e?.message ?? ''} ${e?.cause?.message ?? ''}`) || e?.cause?.code === '42703' || e?.code === '42703';
export const ANSWER_COLS = 'round_id, player, self_answer, guess_other, created_at';
export const JUDGMENT_COLS = 'round_id, judge, correct, created_at';
export const CUSTOM_COLS = 'id, text, kind, options, category, created_at';
export const ANALYSIS_COLS = 'id, room_id, period_start, period_end, compatibility, content, created_at';

const KNOWN = Object.keys(MESSAGES);
const len = (s) => [...String(s ?? '')].length;

/** Erreur Supabase/PostgREST/réseau → ApiError avec message français. */
export function translateError(err) {
  if (err instanceof ApiError) return err;
  const text = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.hint ?? ''}`;
  const known = KNOWN.find((k) => new RegExp(`\\b${k}\\b`).test(text));
  if (known) return new ApiError(known, err);
  if (err?.name === 'TypeError' || /fetch|network|Failed to fetch|Load failed/i.test(text)) return new ApiError('network', err);
  if (err?.code === '23505') return new ApiError('already_answered', err);
  if (err?.code === '23514') return new ApiError('invalid_settings', err);
  if (err?.code === '42501' || err?.code === 'PGRST301') return new ApiError('not_allowed', err);
  return new ApiError('unknown', err);
}

async function run(promise) {
  let res;
  try {
    res = await promise;
  } catch (e) {
    throw translateError(e);
  }
  if (res?.error) throw translateError(res.error);
  return res?.data;
}

const byId = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);

export async function createSupabaseApi({
  secret = null, room_id = null, player = null,
  url = SUPABASE_URL, key = SUPABASE_ANON_KEY, createClient,
} = {}) {
  const make = createClient ?? (await import('../vendor.js')).createClient;
  const session = { secret, room_id, player };
  let client = null;

  const db = () => (client ??= make(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: session.secret ? { 'x-player-secret': session.secret } : {} },
  }));
  const adopt = (res) => {
    Object.assign(session, { secret: res.secret, room_id: res.room_id, player: res.player });
    client = null; // l'en-tête change : nouveau client
    return res;
  };
  const needSession = () => {
    if (!session.secret || !session.room_id || !session.player) throw new ApiError('unauthorized');
  };

  return {
    mode: 'supabase',
    get secret() { return session.secret; },
    setSession(s) { Object.assign(session, s); client = null; },

    async createRoom(name) {
      if (len(String(name ?? '').trim()) < 1 || len(String(name).trim()) > 30) throw new ApiError('invalid_name');
      return adopt(await run(db().rpc('create_room', { p_name: name.trim() })));
    },

    async joinRoom(code, name) {
      if (len(String(name ?? '').trim()) < 1 || len(String(name).trim()) > 30) throw new ApiError('invalid_name');
      return adopt(await run(db().rpc('join_room', { p_code: String(code ?? '').trim().toUpperCase(), p_name: name.trim() })));
    },

    async getRoom() {
      let room;
      try {
        room = await run(db().from('rooms').select(ROOM_COLS).maybeSingle());
      } catch (e) {
        if (!missingSpicy(e)) throw e;
        room = await run(db().from('rooms').select(ROOM_COLS_LEGACY).maybeSingle());
        if (room) room = { ...room, spicy: 1 };
      }
      if (!room) throw new ApiError('unauthorized');
      return room;
    },

    async updateRoom(patch = {}) {
      needSession();
      const allowed = ['p1_name', 'p2_name', 'questions_per_day', 'report_period_days', 'report_start', 'spicy'];
      if (Object.keys(patch).some((k) => !allowed.includes(k))) throw new ApiError('invalid_settings');
      const update = (cols) => run(db().from('rooms').update(patch).eq('id', session.room_id).select(cols).single());
      try {
        return await update(ROOM_COLS);
      } catch (e) {
        if (e.cause?.code === '23514') throw new ApiError('invalid_settings', e.cause);
        if (!missingSpicy(e)) throw e;
        if ('spicy' in patch) throw new ApiError('needs_migration', e.cause);
        return { ...(await update(ROOM_COLS_LEGACY)), spicy: 1 };
      }
    },

    async usedBankIds() {
      const ids = await run(db().rpc('used_bank_ids'));
      return (ids || []).map((x) => (typeof x === 'string' ? x : x?.used_bank_ids ?? x?.bank_id)).filter(Boolean);
    },

    async ensureRounds(date, candidates = []) {
      const rows = await run(db().rpc('ensure_rounds', { p_date: date, p_candidates: candidates }));
      return [...(rows || [])].sort(byId);
    },

    /** Mode illimité : tire `count` questions de plus (après avoir tout répondu). */
    async drawMore(date, candidates = [], count = 3) {
      const rows = await run(db().rpc('draw_more', { p_date: date, p_candidates: candidates, p_count: count }));
      return [...(rows || [])].sort(byId);
    },

    async listRounds({ from = null, to = null } = {}) {
      let q = db().from('rounds').select(ROUND_COLS);
      if (from) q = q.gte('play_date', from);
      if (to) q = q.lte('play_date', to);
      return (await run(q.order('play_date', { ascending: true }).order('id', { ascending: true }))) || [];
    },

    async listAnswers(roundIds = []) {
      if (!roundIds.length) return [];
      return (await run(db().from('answers').select(ANSWER_COLS).in('round_id', roundIds))) || [];
    },

    async submitAnswer(roundId, self, guess) {
      needSession();
      const s = String(self ?? '');
      const g = String(guess ?? '');
      if (len(s) < 1 || len(s) > 500 || len(g) < 1 || len(g) > 500) throw new ApiError('invalid_answer');
      return run(db().from('answers')
        .insert({ round_id: roundId, room_id: session.room_id, player: session.player, self_answer: s, guess_other: g })
        .select(ANSWER_COLS).single());
    },

    async listJudgments(roundIds = []) {
      if (!roundIds.length) return [];
      return (await run(db().from('judgments').select(JUDGMENT_COLS).in('round_id', roundIds))) || [];
    },

    async judge(roundId, correct) {
      needSession();
      // Pas d'upsert : seul `correct` est modifiable (droit UPDATE limité à cette colonne).
      const updated = await run(db().from('judgments').update({ correct: Boolean(correct) })
        .eq('round_id', roundId).eq('judge', session.player).select(JUDGMENT_COLS));
      if (updated?.length) return updated[0];
      try {
        return await run(db().from('judgments')
          .insert({ round_id: roundId, room_id: session.room_id, judge: session.player, correct: Boolean(correct) })
          .select(JUDGMENT_COLS).single());
      } catch (e) {
        throw e.code === 'not_allowed' || e.code === 'unknown' ? new ApiError('not_allowed', e.cause) : e;
      }
    },

    async addCustomQuestion({ text, kind, options = null, category } = {}) {
      needSession();
      const okChoice = kind !== 'choice' || (Array.isArray(options) && options.length >= 2 && options.length <= 6);
      if (len(text) < 3 || len(text) > 300 || !['choice', 'scale', 'text'].includes(kind) || !okChoice) throw new ApiError('invalid_question');
      return run(db().from('custom_questions')
        .insert({ room_id: session.room_id, author: session.player, text, kind, options: options ?? null, category: category || 'perso' })
        .select(CUSTOM_COLS).single());
    },

    async listMyPendingCustom() {
      return (await run(db().from('custom_questions').select(CUSTOM_COLS).eq('used', false).order('created_at', { ascending: true }))) || [];
    },

    async listAnalyses() {
      return (await run(db().from('analyses').select(ANALYSIS_COLS).order('period_end', { ascending: true }))) || [];
    },

    /** Notifications push (migration 006). */
    async savePushSubscription(endpoint, p256dh, auth) {
      return run(db().rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth }));
    },

    async deletePushSubscription(endpoint) {
      return run(db().rpc('delete_push_subscription', { p_endpoint: endpoint }));
    },

    /** Prévient l'Edge Function après une réponse ; elle décide s'il faut notifier le partenaire. Non bloquant. */
    async notifyPartner(fetcher = globalThis.fetch) {
      if (!session.secret || !url) return null;
      try {
        const res = await fetcher(`${url}/functions/v1/notify-partner`, {
          method: 'POST',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'x-player-secret': session.secret },
        });
        return res.ok ? await res.json().catch(() => null) : null;
      } catch {
        return null;
      }
    },

    /** Rythme commun (migration 004) : { me, them, warn_after, block_at }. Non critique : null si indisponible. */
    async pace() {
      try {
        const { data, error } = await db().rpc('pace');
        return error ? null : (data || null);
      } catch {
        return null;
      }
    },

    /** Compteurs du jour (migration 002). Non critique : null si indisponible. */
    async dayProgress(date) {
      try {
        const { data, error } = await db().rpc('day_progress', { p_date: date });
        return error ? null : (data || []);
      } catch {
        return null;
      }
    },

    async createDeviceLink() {
      return run(db().rpc('create_device_link'));
    },

    async claimDeviceLink(code) {
      return adopt(await run(db().rpc('claim_device_link', { p_code: String(code ?? '').trim().toUpperCase() })));
    },
  };
}
