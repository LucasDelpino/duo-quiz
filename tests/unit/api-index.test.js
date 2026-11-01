import { describe, it, expect } from 'vitest';
import { apiMode, isDemoRequested } from '../../js/api/index.js';

describe('api/index', () => {
  it('détecte ?demo=1', () => {
    expect(isDemoRequested('?demo=1')).toBe(true);
    expect(isDemoRequested('?demo=true')).toBe(true);
    expect(isDemoRequested('?demo=0')).toBe(false);
    expect(isDemoRequested('')).toBe(false);
  });

  it('choisit memory ou supabase', () => {
    expect(apiMode({ search: '?demo=1' })).toBe('memory');
    expect(apiMode({ search: '', url: '', key: '' })).toBe('memory');
    expect(apiMode({ search: '', url: 'https://x.supabase.co', key: 'k' })).toBe('supabase');
  });
});
