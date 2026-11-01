// Session locale de l'appareil (localStorage) : room_id, player, secret, noms, préférences.
// Le secret ne quitte jamais cet appareil (ni dépôt, ni logs).

const KEY = 'duo-quiz:session';
const PREFS_KEY = 'duo-quiz:prefs';
const DEFAULT_PREFS = { sounds: false };

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (navigation privée, iframe…)
  }
}

function readJSON(key) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function isValidSession(s) {
  return Boolean(
    s && typeof s.room_id === 'string' && s.room_id &&
    typeof s.secret === 'string' && s.secret &&
    (s.player === 1 || s.player === 2),
  );
}

export function loadSession() {
  const s = readJSON(KEY);
  return isValidSession(s) ? s : null;
}

export function saveSession({ room_id, player, secret, names = {} }) {
  const session = { room_id, player, secret, names: { ...names } };
  if (!isValidSession(session)) throw new Error('Session invalide');
  writeJSON(KEY, session);
  return session;
}

export function updateNames(names) {
  const s = loadSession();
  if (!s) return null;
  return saveSession({ ...s, names: { ...s.names, ...names } });
}

export function clearSession() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}

export function hasSession() {
  return loadSession() !== null;
}

export function loadPrefs() {
  return { ...DEFAULT_PREFS, ...(readJSON(PREFS_KEY) || {}) };
}

export function savePrefs(patch) {
  const prefs = { ...loadPrefs(), ...patch };
  writeJSON(PREFS_KEY, prefs);
  return prefs;
}

/** Prénom du joueur `n` (1 ou 2), avec repli neutre. */
export function playerName(session, n) {
  return session?.names?.[n] || (n === 1 ? 'Joueur 1' : 'Joueur 2');
}
