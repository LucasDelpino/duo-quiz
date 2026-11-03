// Liens d'invitation : …/#/join/CODE?de=Lucas&n=Léa (prénoms facultatifs).
const CODE_RE = /^[0-9A-F]{8}$/;

export function buildInviteUrl(base, code, { from = '', to = '' } = {}) {
  const q = new URLSearchParams();
  if (String(from).trim()) q.set('de', String(from).trim().slice(0, 30));
  if (String(to).trim()) q.set('n', String(to).trim().slice(0, 30));
  const qs = q.toString();
  return `${base}#/join/${String(code).toUpperCase()}${qs ? `?${qs}` : ''}`;
}

/** Paramètres après « ? » dans le hash (#/join/X?de=…). */
export function hashQuery(hash = '') {
  const i = String(hash).indexOf('?');
  return new URLSearchParams(i >= 0 ? String(hash).slice(i + 1) : '');
}

/** Lit un lien d'invitation complet OU un code seul (collé, tapé). null si rien d'exploitable. */
export function parseInvite(text) {
  const s = String(text ?? '').trim();
  if (!s) return null;
  const m = s.match(/#\/join\/([0-9A-Za-z]{8})(\?[^\s#]*)?/);
  if (m) {
    const code = m[1].toUpperCase();
    if (!CODE_RE.test(code)) return null;
    const q = new URLSearchParams((m[2] || '').slice(1));
    return { code, from: q.get('de') || '', to: q.get('n') || '' };
  }
  const bare = s.replace(/\s+/g, '').toUpperCase();
  return CODE_RE.test(bare) ? { code: bare, from: '', to: '' } : null;
}
