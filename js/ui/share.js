import { toast } from './toast.js';

/** Partage natif (Android + iOS) ; repli : copie dans le presse-papiers. */
export async function share({ title = 'Duo Quiz', text = '', url } = {}) {
  const data = url ? { title, text, url } : { title, text };
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      await navigator.share(data);
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  return copy([text, url].filter(Boolean).join('\n'));
}

export async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Copié dans le presse-papiers 📋', { type: 'success' });
    return 'copied';
  } catch {
    toast('Copie impossible : sélectionne le texte à la main.', { type: 'error' });
    return 'failed';
  }
}
