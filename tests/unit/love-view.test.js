import { describe, it, expect } from 'vitest';
import { curve } from '../../js/views/love.js';

describe('vue love : courbe', () => {
  it('rien avec moins de 2 rapports', () => {
    expect(curve([])).toBeNull();
    expect(curve([{ compatibility: 50, period_end: '2026-10-25' }])).toBeNull();
  });
  it('une polyline et un point par rapport', () => {
    const el = curve([{ compatibility: 0, period_end: '2026-10-18' }, { compatibility: 50, period_end: '2026-10-25' }, { compatibility: 100, period_end: '2026-11-01' }]);
    expect(el.querySelectorAll('circle')).toHaveLength(3);
    expect(el.querySelector('polyline').getAttribute('points')).toBe('16,104 150,60 284,16');
    expect(el.querySelector('svg').getAttribute('aria-label')).toBe('Évolution : 0 %, 50 %, 100 %');
    expect(el.textContent).toContain('18 oct.');
  });
});
