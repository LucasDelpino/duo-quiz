// Compteur de points animé (easeOut). Valeur finale immédiate si mouvement réduit.
import { prefersReducedMotion } from './motion.js';

export function animateCount(el, to, { from = Number(el.textContent) || 0, duration = 800 } = {}) {
  const finish = () => {
    el.textContent = String(to);
    if (to > from) {
      el.classList.remove('score-bump');
      void el.offsetWidth; // relance l'animation CSS
      el.classList.add('score-bump');
    }
  };
  if (prefersReducedMotion() || duration <= 0 || from === to || typeof requestAnimationFrame !== 'function') {
    finish();
    return Promise.resolve(to);
  }
  const t0 = performance.now();
  return new Promise((done) => {
    requestAnimationFrame(function step(t) {
      const k = Math.min(1, (t - t0) / duration);
      el.textContent = String(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
      else { finish(); done(to); }
    });
  });
}
