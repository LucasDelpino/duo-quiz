// Confettis maison sur canvas (< 3 Ko). Ne fait rien si le mouvement est réduit.
import { prefersReducedMotion } from './motion.js';

const COLORS = ['#ffd166', '#ff6f61', '#2ec4b6', '#fff7fb', '#c77dff'];

export function confetti({ count = 90, duration = 1600 } = {}) {
  if (prefersReducedMotion() || typeof document === 'undefined') return Promise.resolve(false);
  const c = document.createElement('canvas');
  const ctx = c.getContext?.('2d');
  if (!ctx) return Promise.resolve(false);
  c.className = 'confetti-canvas';
  c.setAttribute('aria-hidden', 'true');
  const W = (c.width = innerWidth);
  const H = (c.height = innerHeight);
  document.body.append(c);
  const parts = Array.from({ length: count }, () => ({
    x: W / 2, y: H * 0.35,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
    s: Math.random() * 6 + 4, r: Math.random() * 6, vr: Math.random() * 0.4 - 0.2,
    c: COLORS[(Math.random() * COLORS.length) | 0],
  }));
  const t0 = performance.now();
  return new Promise((done) => {
    (function frame(t) {
      const k = (t - t0) / duration;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - k);
      for (const p of parts) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (k < 1) requestAnimationFrame(frame);
      else { c.remove(); done(true); }
    })(t0);
  });
}
