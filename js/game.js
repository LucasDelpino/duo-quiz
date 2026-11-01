// Accès aux données de jeu (via l'adaptateur) + petits utilitaires d'affichage partagés.
import { getApi, currentSession, refreshNames } from './context.js';
import { drawCandidates } from './logic/draw.js';
import { todayParis } from './logic/dates.js';
import { fillOther } from './logic/normalize.js';
import { other, roundStatus } from './logic/scoring.js';
import { addDays } from './logic/dates.js';
import { playerName } from './store.js';

let bankPromise = null;

/** Banque de questions (chargée une fois, chemin relatif pour GitHub Pages). */
export function loadBank(fetcher = globalThis.fetch) {
  bankPromise ??= fetcher('data/questions.json').then((r) => {
    if (!r.ok) throw new Error('bank');
    return r.json();
  }).catch((e) => {
    bankPromise = null;
    throw e;
  });
  return bankPromise;
}

/** Tirage du jour : candidates non utilisées → le serveur complète le quota. */
/** Dosage des questions coquines (réglage commun de la partie). */
async function spicyLevel(api, room) {
  const r = room ?? (await api.getRoom().catch(() => null));
  const v = Number(r?.spicy);
  return [0, 1, 2].includes(v) ? v : 1;
}

export async function ensureToday(today = todayParis(), room = null) {
  const api = await getApi();
  const [bank, used, spicy] = await Promise.all([loadBank(), api.usedBankIds(), spicyLevel(api, room)]);
  return api.ensureRounds(today, drawCandidates(bank, used, { count: 20, spicy }));
}

/** Mode illimité : tire un nouveau lot de questions (après avoir tout répondu). */
export async function drawMoreToday(today = todayParis(), count = 3) {
  const api = await getApi();
  const [bank, used, spicy] = await Promise.all([loadBank(), api.usedBankIds(), spicyLevel(api)]);
  return api.drawMore(today, drawCandidates(bank, used, { count: 20, spicy }), count);
}

/** Rounds + réponses + validations visibles pour une plage de dates. */
export async function loadGame({ from = null, to = null } = {}) {
  const api = await getApi();
  const rounds = await api.listRounds({ from, to });
  const ids = rounds.map((r) => r.id);
  const [answers, judgments] = await Promise.all([api.listAnswers(ids), api.listJudgments(ids)]);
  return { rounds, answers, judgments };
}

/** Salle + prénoms à jour (le partenaire a pu rejoindre ou changer de prénom). */
export async function loadRoom() {
  const room = await refreshNames();
  return room;
}

/** Qui suis-je, qui est l'autre, leurs prénoms. */
export function players() {
  const s = currentSession();
  const me = s?.player ?? 1;
  const names = { 1: playerName(s, 1), 2: playerName(s, 2) };
  if (s && !s.names?.[2]) names[2] = 'ton/ta partenaire';
  return { me, them: other(me), names, session: s };
}

/** Texte vu par le joueur `viewer` : {autre} = le prénom de l'autre. */
export function textFor(text, viewer, names) {
  return fillOther(text, names[other(viewer)]);
}

/** Affichage d'une réponse donnée par `author` (échelle → « 4/5 »). */
export function answerLabel(round, value, author, names) {
  if (value == null || value === '') return '—';
  if (round.kind === 'scale') return `${value}/5`;
  return textFor(String(value), author, names);
}

/** Prochaine question qui attend une action de ma part (aujourd'hui d'abord, puis les retards). */
export async function nextRoundId(currentId = null, today = todayParis()) {
  await ensureToday(today).catch(() => {});
  const game = await loadGame({ from: addDays(today, -30), to: today });
  const { me } = players();
  const byId = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  const open = game.rounds.filter((r) => r.id !== currentId
    && ['todo', 'to_judge'].includes(roundStatus(r, game.answers, game.judgments, me)));
  const todays = open.filter((r) => r.play_date === today).sort(byId);
  const late = open.filter((r) => r.play_date < today).sort((a, b) => (a.play_date > b.play_date ? -1 : a.play_date < b.play_date ? 1 : byId(a, b)));
  return [...todays, ...late][0]?.id ?? null;
}
