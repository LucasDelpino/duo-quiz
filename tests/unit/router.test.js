import { describe, it, expect } from 'vitest';
import { parseHash, resolve, defaultHash, ROUTES, TABS } from '../../js/router.js';

describe('router', () => {
  it('reconnaît les routes simples et paramétrées', () => {
    expect(parseHash('#/today').route.name).toBe('today');
    expect(parseHash('#/join/AB12CD')).toMatchObject({ route: { name: 'join' }, params: { code: 'AB12CD' } });
    expect(parseHash('#/round/42').params).toEqual({ id: '42' });
    expect(parseHash('#/link/XY%2034').params.code).toBe('XY 34');
  });

  it('ignore la query après le hash', () => {
    expect(parseHash('#/report?p=prev').route.name).toBe('report');
  });

  it('renvoie null pour une route inconnue ou un encodage invalide', () => {
    expect(parseHash('#/inconnu')).toBeNull();
    expect(parseHash('#/join')).toBeNull();
    expect(parseHash('#/join/%E0%A4%A')).toBeNull();
    expect(parseHash('')).toBeNull();
  });

  it('redirige selon la présence d\'une session', () => {
    expect(defaultHash(false)).toBe('#/setup');
    expect(defaultHash(true)).toBe('#/today');
    expect(resolve('', false).route.name).toBe('setup');
    expect(resolve('#/zzz', true).route.name).toBe('today');
    expect(resolve('#/love', false).route.name).toBe('love');
  });

  it('chaque onglet pointe vers une route existante', () => {
    for (const tab of TABS) expect(parseHash(tab.href)).not.toBeNull();
    for (const r of ROUTES.filter((r) => r.tab)) expect(TABS.some((t) => t.id === r.tab)).toBe(true);
  });
});
