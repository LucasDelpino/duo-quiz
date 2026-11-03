// Notifications push : abonnement du téléphone, désabonnement, état.
// L'envoi est fait par l'Edge Function « notify-partner » (toutes les 3 réponses du partenaire).
import { VAPID_PUBLIC_KEY } from './config.js';
import { detectPlatform, isStandalone } from './ui/platform.js';

export const PUSH_PROMPT_KEY = 'duo-quiz:push-prompt-dismissed';

export function urlB64ToUint8Array(b64) {
  const s = String(b64 || '');
  const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** 'ok' | 'ios-install' (iPhone : installer l'app d'abord) | 'unsupported' | 'not-configured'. */
export function pushSupport(win = globalThis) {
  if (!VAPID_PUBLIC_KEY) return 'not-configured';
  const ok = 'serviceWorker' in (win.navigator || {}) && 'PushManager' in win && 'Notification' in win;
  if (ok) return 'ok';
  return detectPlatform() === 'ios' && !isStandalone(win) ? 'ios-install' : 'unsupported';
}

export const permission = (win = globalThis) => (win.Notification ? win.Notification.permission : 'default');

async function registration(win = globalThis) {
  return win.navigator.serviceWorker.ready;
}

export async function currentSubscription(win = globalThis) {
  if (pushSupport(win) !== 'ok') return null;
  return (await registration(win)).pushManager.getSubscription();
}

/** Demande l'autorisation (à appeler depuis un geste utilisateur), s'abonne et enregistre l'abonnement. */
export async function enablePush(api, win = globalThis) {
  if (pushSupport(win) !== 'ok') throw new Error('unsupported');
  const perm = await win.Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await registration(win);
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const { endpoint, keys } = sub.toJSON();
  await api.savePushSubscription(endpoint, keys.p256dh, keys.auth);
  return sub;
}

export async function disablePush(api, win = globalThis) {
  const sub = await currentSubscription(win);
  if (!sub) return;
  await api.deletePushSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Au démarrage : ré-enregistre silencieusement un abonnement existant (il peut changer). */
export async function syncPush(api, win = globalThis) {
  try {
    if (permission(win) !== 'granted') return false;
    const sub = await currentSubscription(win);
    if (!sub) return false;
    const { endpoint, keys } = sub.toJSON();
    await api.savePushSubscription(endpoint, keys.p256dh, keys.auth);
    return true;
  } catch {
    return false;
  }
}
