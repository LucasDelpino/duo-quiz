// Accès aux données de jeu (via l'adaptateur) + petits utilitaires d'affichage partagés.
import { getApi, currentSession, refreshNames } from './context.js';
import { drawCandidates } from './logic/draw.js';
import { todayParis } from './logic/dates.js';
import { fillOther } from './logic/normalize.js';
import { other } from './logic/scoring.js';
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
export async function ensureToday(today = todayParis()) {
  const api = await getApi();
  const [bank, used] = await Promise.all([loadBank(), api.usedBankIds()]);
  return api.ensureRounds(today, drawCandidates(bank, used, { count: 20 }));
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

