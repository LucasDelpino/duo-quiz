// Jauge circulaire (SVG) qui se remplit : 0–100 %.
import { h } from './dom.js';
import { prefersReducedMotion } from './motion.js';

const NS = 'http://www.w3.org/2000/svg';
const R = 52;
const C = 2 * Math.PI * R;

function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}

export const clampPct = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

export function gauge({ value = 0, label = '' } = {}) {
  const bar = svg('circle', { class: 'gauge-bar', cx: 60, cy: 60, r: R, 'stroke-dasharray': C, 'stroke-dashoffset': C });
  const grad = svg('linearGradient', { id: 'gauge-grad', x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': '#2ec4b6' }),
    svg('stop', { offset: '60%', 'stop-color': '#ffd166' }),
    svg('stop', { offset: '100%', 'stop-color': '#ff6f61' }));
  const strong = h('strong', {}, '0 %');
  const el = h('div', { class: 'gauge', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0, 'aria-label': label || 'Compatibilité' },
    svg('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' }, svg('defs', {}, grad), svg('circle', { class: 'gauge-track', cx: 60, cy: 60, r: R }), bar),
    h('div', { class: 'gauge-value' }, strong, label ? h('span', {}, label) : null));
  setGauge(el, value);
  return el;
}

/** Met la jauge à `value` % (transition CSS sur stroke-dashoffset). */
export function setGauge(el, value) {
  const v = clampPct(value);
  const bar = el.querySelector('.gauge-bar');
  const apply = () => bar.setAttribute('stroke-dashoffset', String(C * (1 - v / 100)));
  if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') apply();
  else requestAnimationFrame(() => requestAnimationFrame(apply));
  el.setAttribute('aria-valuenow', String(v));
  el.querySelector('strong').textContent = `${v} %`;
  return v;
}
