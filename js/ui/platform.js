// Détection de l'appareil pour adapter le tuto d'installation.

export function detectPlatform(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints || 0) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function isStandalone(win = globalThis) {
  try {
    return Boolean(win.navigator?.standalone || win.matchMedia?.('(display-mode: standalone)').matches);
  } catch {
    return false;
  }
}

// beforeinstallprompt (Android/Chrome uniquement, jamais sur iOS) : capturé tôt, utilisé plus tard.
let deferred = null;
const listeners = new Set();

export function captureInstallPrompt(win = globalThis) {
  win.addEventListener?.('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((fn) => fn(true));
  });
  win.addEventListener?.('appinstalled', () => {
    deferred = null;
    listeners.forEach((fn) => fn(false));
  });
}

export const canPromptInstall = () => deferred !== null;

export function onInstallAvailability(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Affiche la boîte d'installation native ; renvoie 'accepted' | 'dismissed' | 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null;
  await e.prompt();
  const choice = await e.userChoice;
  return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
}
