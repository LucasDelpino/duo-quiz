// Actions d'entrée dans une partie (partagées par Setup, Rejoindre et Connexion d'appareil).
import { getApi, adoptSession, refreshNames } from '../context.js';
import { clearSession } from '../store.js';

async function adoptAndName(res, names) {
  adoptSession(res, names);
  try {
    await refreshNames();
  } catch {
    /* les prénoms seront rafraîchis plus tard */
  }
  return res;
}

export async function createGame(name) {
  const api = await getApi();
  const res = await api.createRoom(name);
  return adoptAndName(res, { 1: name.trim() });
}

export async function joinGame(code, name) {
  const api = await getApi();
  const res = await api.joinRoom(code, name);
  return adoptAndName(res, { 2: name.trim() });
}

export async function claimLink(code) {
  clearSession(); // le nouvel appareil prend la place de l'ancien
  const api = await getApi();
  const res = await api.claimDeviceLink(code);
  return adoptAndName(res);
}

export async function startSoloDemo(name) {
  const api = await getApi();
  const res = await api.startDemo(name);
  return adoptAndName(res, { 1: name.trim() });
}

export const cleanCode = (s) => String(s ?? '').replace(/\s+/g, '').toUpperCase();
