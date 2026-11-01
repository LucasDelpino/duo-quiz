import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectPlatform, isStandalone, captureInstallPrompt, canPromptInstall, promptInstall, onInstallAvailability } from '../../js/ui/platform.js';
import { share, copy } from '../../js/ui/share.js';
import { field, errorBox, busy } from '../../js/ui/form.js';

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

describe('platform', () => {
  it('détecte iPhone, iPad (Mac tactile), Android, autre', () => {
    expect(detectPlatform(IOS)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
    expect(detectPlatform(ANDROID)).toBe('android');
    expect(detectPlatform()).toBe('other');
  });

  it('mode standalone', () => {
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isStandalone({ get navigator() { throw new Error('x'); } })).toBe(false);
  });

  it('beforeinstallprompt capturé puis proposé une seule fois', async () => {
    const win = new EventTarget();
    captureInstallPrompt(win);
    const seen = [];
    const off = onInstallAvailability((v) => seen.push(v));
    expect(canPromptInstall()).toBe(false);
    expect(await promptInstall()).toBe('unavailable');
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = vi.fn();
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    win.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(canPromptInstall()).toBe(true);
    expect(await promptInstall()).toBe('accepted');
    expect(canPromptInstall()).toBe(false);
    const ev2 = new Event('beforeinstallprompt');
    ev2.prompt = vi.fn();
    ev2.userChoice = Promise.resolve({ outcome: 'dismissed' });
    win.dispatchEvent(ev2);
    win.dispatchEvent(new Event('appinstalled'));
    expect(canPromptInstall()).toBe(false);
    expect(seen).toEqual([true, true, false]);
    off();
    captureInstallPrompt({});
  });
});

describe('share / copy', () => {
  afterEach(() => { delete navigator.share; delete navigator.canShare; document.body.innerHTML = ''; });

  it('partage natif si disponible', async () => {
    navigator.share = vi.fn().mockResolvedValue();
    expect(await share({ text: 't', url: 'u' })).toBe('shared');
    expect(navigator.share).toHaveBeenCalledWith({ title: 'Duo Quiz', text: 't', url: 'u' });
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    expect(await share({ text: 't' })).toBe('cancelled');
  });

  it('repli sur la copie', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } });
    navigator.share = vi.fn();
    navigator.canShare = () => false;
    expect(await share({ text: 'a', url: 'b' })).toBe('copied');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('a\nb');
    navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('refus'));
    expect(await copy('x')).toBe('failed');
    expect(document.querySelector('.toast--error')).not.toBeNull();
    navigator.share = vi.fn().mockRejectedValue(new Error('autre'));
    navigator.canShare = undefined;
    expect(await share()).toBe('failed');
  });
});

describe('form', () => {
  it('champ, erreur, bouton occupé', async () => {
    const f = field({ id: 'x', label: 'Prénom', hint: 'aide', maxlength: 30 });
    expect(f.querySelector('label').getAttribute('for')).toBe('x');
    expect(f.querySelector('input').className).toBe('input');
    expect(field({ id: 't', label: 'T', textarea: true }).querySelector('textarea')).not.toBeNull();
    const e = errorBox();
    expect(e.hidden).toBe(true);
    e.show('Oups');
    expect([e.hidden, e.textContent, e.getAttribute('role')]).toEqual([false, 'Oups', 'alert']);
    e.show(null);
    expect(e.hidden).toBe(true);
    const b = document.createElement('button');
    b.textContent = 'OK';
    const res = await busy(b, async () => { expect(b.disabled).toBe(true); return 42; });
    expect([res, b.disabled, b.textContent]).toEqual([42, false, 'OK']);
    await expect(busy(b, async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(b.disabled).toBe(false);
  });
});
