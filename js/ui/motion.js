// Préférences de mouvement et retour haptique (vibration ignorée sur iOS, absente de Safari).

export function prefersReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export function vibrate(pattern = 30) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') return navigator.vibrate(pattern);
  } catch {
    /* non supporté */
  }
  return false;
}

/** Résout quand l'événement `event` arrive sur `el`, ou après `timeout` ms (filet de sécurité). */
export function waitFor(el, event, timeout) {
  return new Promise((done) => {
    const t = setTimeout(finish, timeout);
    function finish() {
      clearTimeout(t);
      el.removeEventListener(event, finish);
      done();
    }
    el.addEventListener(event, finish, { once: true });
  });
}
