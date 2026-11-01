// Contexte applicatif : session de l'appareil + adaptateur d'API correspondant.
import { createApi } from './api/index.js';
import { loadSession, saveSession, clearSession, updateNames } from './store.js';

let apiPromise = null;
let apiSecret = undefined;

/** Adaptateur pour la session courante (recréé si le secret change). */
export function getApi() {
  const session = loadSession();
  const secret = session?.secret ?? null;
  if (!apiPromise || apiSecret !== secret) {
    apiSecret = secret;
    apiPromise = createApi({ session });
  }
  return apiPromise;
}

export function currentSession() {
  return loadSession();
}

/** Enregistre la session renvoyée par createRoom / joinRoom / claimDeviceLink. */
export function adoptSession({ room_id, player, secret }, names = {}) {
  const s = saveSession({ room_id, player, secret, names });
  apiPromise = null;
  return s;
}

/** Met à jour les prénoms depuis le serveur (getRoom). */
export async function refreshNames() {
  const api = await getApi();
  const room = await api.getRoom();
  updateNames({ 1: room.p1_name, 2: room.p2_name || '' });
  return room;
}

export function leave() {
  clearSession();
  apiPromise = null;
}

/** Lien de base de l'app (garde ?demo=1 si présent, sans le hash). */
export function appBaseUrl(loc = location) {
  return loc.href.split('#')[0];
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
