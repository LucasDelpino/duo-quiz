// Petits sons synthétisés (aucun fichier) — désactivés par défaut, activables dans Réglages.
import { loadPrefs } from '../store.js';

let ctx = null;

const TUNES = {
  win: [[523, 0], [659, 0.09], [784, 0.18]],
  miss: [[311, 0], [233, 0.14]],
  tap: [[880, 0]],
};

export function play(name, { prefs = loadPrefs(), AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  if (!prefs.sounds || !AudioCtx || !TUNES[name]) return false;
  try {
    ctx ??= new AudioCtx();
    const t0 = ctx.currentTime;
    for (const [freq, at] of TUNES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.18);
    }
    return true;
  } catch {
    return false;
  }
}
