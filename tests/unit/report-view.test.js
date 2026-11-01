import { describe, it, expect } from 'vitest';
import { readQuery, choosePeriod } from '../../js/views/report.js';

const room = { report_start: '2026-10-26', report_period_days: 7 };

describe('vue bilan : période', () => {
  it('lit la query du hash', () => {
    expect(readQuery('#/report')).toEqual({ p: 'current', from: null, to: null, cat: null });
    expect(readQuery('#/report?p=custom&from=2026-10-01&to=2026-10-05')).toMatchObject({ p: 'custom', from: '2026-10-01', to: '2026-10-05' });
    expect(readQuery('#/history?cat=gouts').cat).toBe('gouts');
  });

  it('période + comparaison', () => {
    expect(choosePeriod(room, { p: 'current' }, '2026-11-03')).toEqual({ period: { from: '2026-11-02', to: '2026-11-08' }, previous: { from: '2026-10-26', to: '2026-11-01' } });
    expect(choosePeriod(room, { p: 'previous' }, '2026-11-03')).toEqual({ period: { from: '2026-10-26', to: '2026-11-01' }, previous: { from: '2026-10-19', to: '2026-10-25' } });
    expect(choosePeriod(room, { p: 'all' }, '2026-11-03')).toEqual({ period: { from: null, to: '2026-11-03' }, previous: null });
    expect(choosePeriod(room, { p: 'custom', from: '2026-10-01', to: '2026-10-05' }, '2026-11-03')).toEqual({ period: { from: '2026-10-01', to: '2026-10-05' }, previous: null });
    // personnalisée invalide → en cours
    expect(choosePeriod(room, { p: 'custom', from: '2026-10-09', to: '2026-10-05' }, '2026-11-03').period.from).toBe('2026-11-02');
  });
});
