import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import vm from 'node:vm';
import fs from 'node:fs';
import ece from 'http_ece';
import { urlB64ToUint8Array, pushSupport, enablePush, disablePush, syncPush } from '../../js/push.js';
import { VAPID_PUBLIC_KEY } from '../../js/config.js';
import { createSupabaseApi } from '../../js/api/supabase.js';
import * as edge from '../../supabase/functions/notify-partner/index.ts';

function fakeWin({ perm = 'granted', existing = null, ask = 'granted' } = {}) {
  const sub = existing ?? {
    endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
    toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }; },
    unsubscribe: vi.fn(async () => true),
  };
  const pm = { getSubscription: vi.fn(async () => existing), subscribe: vi.fn(async () => sub) };
  const Notification = { permission: perm, requestPermission: vi.fn(async () => { Notification.permission = ask; return ask; }) };
  return { win: { navigator: { serviceWorker: { ready: Promise.resolve({ pushManager: pm }) } }, PushManager: {}, Notification }, pm, sub, Notification };
}

describe('notifications : téléphone', () => {
  it('clé VAPID publique valide (point P-256 non compressé)', () => {
    const k = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
    expect(k).toHaveLength(65);
    expect(k[0]).toBe(4);
  });

  it('support détecté', () => {
    expect(pushSupport(fakeWin().win)).toBe('ok');
    expect(pushSupport({ navigator: {} })).toMatch(/unsupported|ios-install/);
  });

  it('activer : autorisation, abonnement avec la clé VAPID, enregistrement serveur', async () => {
    const { win, pm, Notification } = fakeWin({ perm: 'default' });
    const api = { savePushSubscription: vi.fn(async () => null) };
    await enablePush(api, win);
    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(pm.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
    expect(api.savePushSubscription).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/xyz', 'P'.repeat(87), 'A'.repeat(22));
  });

  it('refus : erreur « denied », rien d’enregistré', async () => {
    const { win, pm } = fakeWin({ perm: 'default', ask: 'denied' });
    const api = { savePushSubscription: vi.fn() };
    await expect(enablePush(api, win)).rejects.toThrow('denied');
    expect(pm.subscribe).not.toHaveBeenCalled();
    expect(api.savePushSubscription).not.toHaveBeenCalled();
  });

  it('désactiver et resynchroniser', async () => {
    const existing = { endpoint: 'https://e/1', toJSON: () => ({ endpoint: 'https://e/1', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn(async () => true) };
    const { win } = fakeWin({ existing });
    const api = { deletePushSubscription: vi.fn(async () => null), savePushSubscription: vi.fn(async () => null) };
    expect(await syncPush(api, win)).toBe(true);
    expect(api.savePushSubscription).toHaveBeenCalledWith('https://e/1', 'p', 'a');
    await disablePush(api, win);
    expect(api.deletePushSubscription).toHaveBeenCalledWith('https://e/1');
    expect(existing.unsubscribe).toHaveBeenCalled();
    expect(await syncPush(api, fakeWin({ perm: 'default', existing }).win)).toBe(false);
  });

  it('supabase : RPC d’abonnement et appel non bloquant de l’Edge Function', async () => {
    const calls = [];
    const createClient = () => ({ from: () => ({}), rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve({ data: null, error: null }); } });
    const api = await createSupabaseApi({ secret: 's3cret', room_id: 'r', player: 1, url: 'https://x.supabase.co', key: 'anon', createClient });
    await api.savePushSubscription('https://e', 'p', 'a');
    await api.deletePushSubscription('https://e');
    expect(calls).toEqual([
      { name: 'save_push_subscription', args: { p_endpoint: 'https://e', p_p256dh: 'p', p_auth: 'a' } },
      { name: 'delete_push_subscription', args: { p_endpoint: 'https://e' } },
    ]);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ notify: false }), { status: 200 }));
    expect(await api.notifyPartner(fetcher)).toEqual({ notify: false });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://x.supabase.co/functions/v1/notify-partner');
    expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon', 'x-player-secret': 's3cret' });
    expect(await api.notifyPartner(async () => { throw new Error('réseau'); })).toBeNull();
  });
});

describe('notifications : service worker', () => {
  function loadSw() {
    const handlers = {};
    const shown = [];
    const opened = [];
    const self = {
      addEventListener: (t, fn) => { handlers[t] = fn; },
      registration: { scope: 'https://lucasdelpino.github.io/duo-quiz/', showNotification: async (title, opts) => shown.push({ title, opts }) },
      clients: { matchAll: async () => [], openWindow: async (u) => opened.push(u), claim: async () => {} },
      skipWaiting: () => {},
    };
    vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), { self, caches: {}, fetch: () => {}, URL, Response, console });
    return { handlers, shown, opened };
  }
  it('affiche la notification reçue et ouvre l’app au toucher', async () => {
    const { handlers, shown, opened } = loadSw();
    let wait;
    handlers.push({ data: { json: () => ({ title: 'Duo Quiz 💞', body: 'Léa a répondu à 3 questions 👀 À toi de jouer !', url: './#/today' }) }, waitUntil: (p) => { wait = p; } });
    await wait;
    expect(shown[0]).toMatchObject({ title: 'Duo Quiz 💞', opts: { body: 'Léa a répondu à 3 questions 👀 À toi de jouer !', data: { url: './#/today' } } });
    handlers.notificationclick({ notification: { close: () => {}, data: { url: './#/today' } }, waitUntil: (p) => { wait = p; } });
    await wait;
    expect(opened).toEqual(['https://lucasdelpino.github.io/duo-quiz/#/today']);
  });
});

describe('notifications : Edge Function notify-partner', () => {
  const vapid = (() => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return { publicKey: e.getPublicKey('base64url'), privateKey: e.getPrivateKey('base64url') }; })();
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16).toString('base64url');
  const p256dh = ua.getPublicKey('base64url');
  const env = { url: 'https://x.supabase.co', serviceKey: 'service', vapidPublic: vapid.publicKey, vapidPrivate: vapid.privateKey, subject: 'https://lucasdelpino.github.io/duo-quiz/', every: 3 };

  it('chiffrement déchiffrable par la bibliothèque de référence (RFC 8291)', async () => {
    const body = await edge.encryptPayload('{"a":1}', p256dh, auth);
    expect(ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: ua, authSecret: auth }).toString()).toBe('{"a":1}');
  });

  it('signature VAPID ES256 valide', async () => {
    const h = await edge.vapidHeader('https://web.push.apple.com/abc', vapid.publicKey, vapid.privateKey, env.subject);
    const t = h.match(/t=([^,]+)/)[1];
    const [hd, pl, sg] = t.split('.');
    expect(JSON.parse(Buffer.from(pl, 'base64url')).aud).toBe('https://web.push.apple.com');
    const pub = Buffer.from(vapid.publicKey, 'base64url');
    const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(crypto.verify('sha256', Buffer.from(`${hd}.${pl}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sg, 'base64url'))).toBe(true);
  });

  it('parcours : claim, envoi, nettoyage des abonnements expirés', async () => {
    const calls = [];
    const fetcher = async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('push_claim')) return new Response(JSON.stringify({ notify: true, count: 3, from_name: 'Léa', subscriptions: [{ endpoint: 'https://push/ok', p256dh, auth }, { endpoint: 'https://push/gone', p256dh, auth }] }));
      if (String(url).endsWith('/gone')) return new Response(null, { status: 410 });
      return new Response(null, { status: 201 });
    };
    const res = await edge.handle(new Request('https://f', { method: 'POST', headers: { 'x-player-secret': 'abc' } }), env, fetcher);
    expect(await res.json()).toEqual({ notify: true, sent: 1, count: 3 });
    const sent = calls.find((c) => c.url === 'https://push/ok');
    expect(JSON.parse(ece.decrypt(Buffer.from(sent.init.body), { version: 'aes128gcm', privateKey: ua, authSecret: auth }).toString()).body)
      .toBe('Léa a répondu à 3 questions 👀 À toi de jouer !');
    expect(calls.some((c) => c.init.method === 'DELETE' && c.url.includes('push_subscriptions?endpoint=eq.'))).toBe(true);
    expect((await edge.handle(new Request('https://f', { method: 'OPTIONS' }), env, fetcher)).status).toBe(204);
    expect((await edge.handle(new Request('https://f', { method: 'POST' }), env, fetcher)).status).toBe(401);
  });
});
