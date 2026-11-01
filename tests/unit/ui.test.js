import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { button } from '../../js/ui/buttons.js';
import { card, flipCard, reveal } from '../../js/ui/card.js';
import { confetti } from '../../js/ui/confetti.js';
import { toast } from '../../js/ui/toast.js';
import { animateCount } from '../../js/ui/counter.js';
import { gauge, setGauge, clampPct } from '../../js/ui/gauge.js';
import { prefersReducedMotion, vibrate, waitFor } from '../../js/ui/motion.js';

function setReducedMotion(on) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: on });
}

describe('ui', () => {
  beforeEach(() => setReducedMotion(true));
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('motion : préférence, vibration absente (iOS), attente', async () => {
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = () => { throw new Error('x'); };
    expect(prefersReducedMotion()).toBe(false);
    expect(vibrate()).toBe(false);
    navigator.vibrate = vi.fn(() => true);
    expect(vibrate(20)).toBe(true);
    delete navigator.vibrate;
    const el = document.createElement('div');
    const p = waitFor(el, 'transitionend', 1000);
    el.dispatchEvent(new Event('transitionend'));
    await expect(p).resolves.toBeUndefined();
    await waitFor(el, 'never', 5);
  });

  it('bouton : classes et clic', () => {
    const onClick = vi.fn();
    const b = button('OK', { variant: 'coral', block: true, size: 'lg', onClick, 'data-x': 1 });
    expect(b.className).toBe('btn btn--coral btn--block btn--lg');
    expect(b.type).toBe('button');
    b.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('carte et carte qui se retourne', async () => {
    expect(card('x', { variant: 'gold' }).className).toBe('card card--gold');
    expect(card('x').className).toBe('card');
    const f = flipCard({ back: 'Pizza' });
    expect(f.querySelector('.flip-back').getAttribute('aria-hidden')).toBe('true');
    await reveal(f);
    expect(f.classList.contains('is-flipped')).toBe(true);
    expect(f.querySelector('.flip-back').getAttribute('aria-hidden')).toBe('false');
    await reveal(f); // idempotent
  });

  it('carte : attend la transition quand le mouvement est permis', async () => {
    setReducedMotion(false);
    const f = flipCard({ back: 'x' });
    const p = reveal(f);
    f.querySelector('.flip-inner').dispatchEvent(new Event('transitionend'));
    await p;
    expect(f.classList.contains('is-flipped')).toBe(true);
  });

  it('confettis : rien en mouvement réduit ni sans canvas', async () => {
    expect(await confetti()).toBe(false);
    setReducedMotion(false);
    HTMLCanvasElement.prototype.getContext = () => null;
    expect(await confetti()).toBe(false);
  });

  it('confettis : anime puis retire le canvas', async () => {
    setReducedMotion(false);
    const ctx = { clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {} };
    HTMLCanvasElement.prototype.getContext = () => ctx;
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb((now += 400)), 0);
    const done = await confetti({ count: 5, duration: 800 });
    expect(done).toBe(true);
    expect(document.querySelector('.confetti-canvas')).toBeNull();
  });

  it('confettis : fichier < 3 Ko', () => {
    expect(readFileSync('js/ui/confetti.js').length).toBeLessThan(3072);
  });

  it('toast : apparaît puis disparaît', () => {
    vi.useFakeTimers();
    const t = toast('Salut', { type: 'success', duration: 100 });
    expect(document.getElementById('toasts').getAttribute('aria-live')).toBe('polite');
    expect(t.className).toBe('toast toast--success');
    toast('Deux');
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
    vi.advanceTimersByTime(500);
    expect(document.body.contains(t)).toBe(false);
  });

  it('compteur : valeur finale immédiate en mouvement réduit', async () => {
    const el = document.createElement('span');
    el.textContent = '2';
    expect(await animateCount(el, 5)).toBe(5);
    expect(el.textContent).toBe('5');
    expect(el.classList.contains('score-bump')).toBe(true);
    await animateCount(el, 3, { duration: 0 });
    expect(el.textContent).toBe('3');
  });

  it('compteur : animation progressive', async () => {
    setReducedMotion(false);
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const seen = [];
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => { now += 100; cb(now); seen.push(el.textContent); }, 0);
    const el = document.createElement('span');
    el.textContent = '0';
    await animateCount(el, 10, { duration: 300 });
    expect(el.textContent).toBe('10');
    expect(seen.some((v) => v !== '10')).toBe(true);
  });

  it('jauge : borne et met à jour', () => {
    expect(clampPct(140)).toBe(100);
    expect(clampPct(-3)).toBe(0);
    expect(clampPct('abc')).toBe(0);
    const g = gauge({ value: 42, label: 'Belle complémentarité' });
    expect(g.getAttribute('role')).toBe('meter');
    expect(g.getAttribute('aria-valuenow')).toBe('42');
    expect(g.querySelector('strong').textContent).toBe('42 %');
    expect(setGauge(g, 100)).toBe(100);
    expect(Number(g.querySelector('.gauge-bar').getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
    expect(gauge().getAttribute('aria-label')).toBe('Compatibilité');
  });

  it('jauge : animée via requestAnimationFrame', async () => {
    setReducedMotion(false);
    globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    const g = gauge({ value: 50 });
    await new Promise((r) => setTimeout(r, 10));
    expect(Number(g.querySelector('.gauge-bar').getAttribute('stroke-dashoffset'))).toBeGreaterThan(0);
  });
});
