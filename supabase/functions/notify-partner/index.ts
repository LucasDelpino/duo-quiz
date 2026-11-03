// Edge Function Supabase « notify-partner » — Duo Quiz.
// Appelée par l'app après chaque réponse (en-tête x-player-secret). Toutes les N réponses (3 par défaut),
// envoie une notification push au partenaire. Web Push (RFC 8291 aes128gcm + VAPID RFC 8292)
// implémenté avec WebCrypto : aucune dépendance, un seul fichier à coller dans Supabase.
//
// Secrets à définir (Edge Functions → Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// Fournis automatiquement par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Optionnel : PUSH_EVERY (3 par défaut).

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Chiffre `payload` pour un abonnement (p256dh, auth) — contenu aes128gcm prêt à POSTer. */
export async function encryptPayload(payload: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const authSecret = b64urlToBytes(auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // délimiteur du dernier enregistrement
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** En-tête Authorization VAPID (JWT ES256) pour l'origine du point de terminaison. */
export async function vapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string, now = Date.now()): Promise<string> {
  const pub = b64urlToBytes(publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = bytesToB64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${bytesToB64url(sig)}, k=${publicKey}`;
}

type Sub = { endpoint: string; p256dh: string; auth: string };
type Env = { url: string; serviceKey: string; vapidPublic: string; vapidPrivate: string; subject: string; every: number };

export async function sendPush(sub: Sub, payload: string, env: Env, fetcher = fetch): Promise<number> {
  const body = await encryptPayload(payload, sub.p256dh, sub.auth);
  const res = await fetcher(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env.vapidPublic, env.vapidPrivate, env.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  });
  return res.status;
}

export function message(fromName: string, count: number) {
  const n = `${count} question${count > 1 ? 's' : ''}`;
  return { title: 'Duo Quiz 💞', body: `${fromName} a répondu à ${n} 👀 À toi de jouer !`, url: './#/today', tag: 'duo-quiz-partner' };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-player-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req: Request, env: Env, fetcher = fetch): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = req.headers.get('x-player-secret') || '';
  if (!secret) return json({ error: 'unauthorized' }, 401);
  if (!env.vapidPublic || !env.vapidPrivate || !env.serviceKey) return json({ error: 'not_configured' }, 500);

  const rest = (path: string, init: RequestInit) => fetcher(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

  const claimRes = await rest('rpc/push_claim', { method: 'POST', body: JSON.stringify({ p_secret: secret, p_every: env.every }) });
  if (!claimRes.ok) return json({ error: 'claim_failed', status: claimRes.status }, 502);
  const claim = await claimRes.json();
  if (!claim?.notify) return json({ notify: false, reason: claim?.reason ?? null, pending: claim?.pending ?? null });

  const payload = JSON.stringify(message(claim.from_name, claim.count));
  let sent = 0;
  for (const sub of (claim.subscriptions || []) as Sub[]) {
    try {
      const status = await sendPush(sub, payload, env, fetcher);
      if (status >= 200 && status < 300) sent += 1;
      else if (status === 404 || status === 410) {
        await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
      }
    } catch (_e) { /* un abonnement défaillant ne bloque pas les autres */ }
  }
  return json({ notify: true, sent, count: claim.count });
}

// Point d'entrée Supabase (Deno). Ignoré quand le fichier est importé par les tests (Node).
const D = (globalThis as any).Deno;
if (D?.serve) {
  D.serve((req: Request) => handle(req, {
    url: D.env.get('SUPABASE_URL') ?? '',
    serviceKey: D.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    vapidPublic: D.env.get('VAPID_PUBLIC_KEY') ?? '',
    vapidPrivate: D.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: D.env.get('VAPID_SUBJECT') ?? 'https://lucasdelpino.github.io/duo-quiz/',
    every: Number(D.env.get('PUSH_EVERY') ?? 3) || 3,
  }));
}
