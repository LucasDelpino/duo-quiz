// Choix de l'adaptateur : 'supabase' si la config est renseignée, 'memory' sinon ; ?demo=1 force 'memory'.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export function isDemoRequested(search = globalThis.location?.search ?? '') {
  const v = new URLSearchParams(search).get('demo');
  return v === '1' || v === 'true';
}

export function apiMode({ search, url = SUPABASE_URL, key = SUPABASE_ANON_KEY } = {}) {
  if (isDemoRequested(search)) return 'memory';
  return url && key ? 'supabase' : 'memory';
}

/** Crée l'adaptateur adapté (supabase-js n'est chargé qu'en mode Supabase). */
export async function createApi({ session = null, search } = {}) {
  if (apiMode({ search }) === 'memory') {
    const { createMemoryApi } = await import('./memory.js');
    return createMemoryApi({ secret: session?.secret ?? null });
  }
  const { createSupabaseApi } = await import('./supabase.js');
  return createSupabaseApi({ secret: session?.secret, room_id: session?.room_id, player: session?.player });
}
