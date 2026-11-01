// « Réglages » (onglet Plus) : prénoms, rythme, période, sons, appareils, démo, quitter.
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { field, errorBox, busy } from '../ui/form.js';
import { toast } from '../ui/toast.js';
import { share, copy } from '../ui/share.js';
import { messageFor } from '../api/errors.js';
import { getApi, leave, go, appBaseUrl, refreshNames } from '../context.js';
import { loadPrefs, savePrefs } from '../store.js';
import { players } from '../game.js';
import { isISODate } from '../logic/dates.js';
import { invitePanel } from './setup.js';

/** Valide le formulaire ; renvoie { patch } ou { error }. */
export function settingsPatch({ p1_name, p2_name, questions_per_day, report_period_days, report_start }, hasPartner) {
  const n1 = String(p1_name ?? '').trim();
  const n2 = String(p2_name ?? '').trim();
  if (n1.length < 1 || n1.length > 30 || (hasPartner && (n2.length < 1 || n2.length > 30))) return { error: 'Les prénoms doivent faire entre 1 et 30 caractères.' };
  const q = Number(questions_per_day);
  if (!Number.isInteger(q) || q < 0 || q > 10) return { error: 'Questions par jour : entre 1 et 10, ou Illimité.' };
  const d = Number(report_period_days);
  if (!Number.isInteger(d) || d < 1 || d > 90) return { error: 'Durée du bilan : entre 1 et 90 jours.' };
  if (!isISODate(report_start)) return { error: 'Date de départ invalide.' };
  const patch = { p1_name: n1, questions_per_day: q, report_period_days: d, report_start };
  if (hasPartner) patch.p2_name = n2;
  return { patch };
}

/** Questions par jour : 1 à 10, ou « Illimité » (0). */
function perDayField(value) {
  const options = [h('option', { value: '0', selected: value === 0 }, 'Illimité ♾️'),
    ...Array.from({ length: 10 }, (_, i) => h('option', { value: String(i + 1), selected: value === i + 1 }, String(i + 1)))];
  return h('div', { class: 'field' },
    h('label', { for: 'questions_per_day' }, 'Questions par jour'),
    h('select', { id: 'questions_per_day', name: 'questions_per_day', class: 'input', 'data-testid': 'questions-per-day', 'aria-describedby': 'questions_per_day-hint' }, options),
    h('small', { class: 'muted', id: 'questions_per_day-hint' }, 'Illimité : 3 questions par jour, puis « Encore des questions » dès que tu as tout répondu.'));
}

function roomForm(room) {
  const err = errorBox();
  const hasPartner = Boolean(room.p2_name);
  const f = h('form', { id: 'settings-form', class: 'stack', novalidate: true },
    field({ id: 'p1_name', label: 'Prénom du joueur 1', value: room.p1_name, maxlength: 30, autocomplete: 'off' }),
    hasPartner ? field({ id: 'p2_name', label: 'Prénom du joueur 2', value: room.p2_name, maxlength: 30, autocomplete: 'off' }) : null,
    perDayField(room.questions_per_day),
    field({ id: 'report_period_days', label: 'Durée du bilan, en jours (1 à 90)', type: 'number', inputmode: 'numeric', min: 1, max: 90, step: 1, value: room.report_period_days, hint: '7 = un bilan par semaine.' }),
    field({ id: 'report_start', label: 'Date de départ des bilans', type: 'date', value: room.report_start, hint: 'Choisis un lundi pour un bilan clôturé le dimanche soir.' }),
    err,
    button('Enregistrer', { type: 'submit', block: true, 'data-testid': 'save-settings' }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.show(null);
    const { patch, error } = settingsPatch(Object.fromEntries(new FormData(f)), hasPartner);
    if (error) return err.show(error);
    try {
      await busy(f.querySelector('[type="submit"]'), async () => (await getApi()).updateRoom(patch));
      await refreshNames().catch(() => {});
      toast('Réglages enregistrés ✅', { type: 'success' });
    } catch (error2) {
      err.show(messageFor(error2));
    }
  });
  return card([h('h2', {}, 'Votre partie'), f], { 'data-testid': 'room-settings' });
}

function soundsCard() {
  const input = h('input', { type: 'checkbox', id: 'sounds', role: 'switch', checked: loadPrefs().sounds, 'data-testid': 'sounds' });
  input.addEventListener('change', () => {
    savePrefs({ sounds: input.checked });
    toast(input.checked ? 'Sons activés 🔊' : 'Sons coupés 🔇');
  });
  return card([h('label', { class: 'switch-row', for: 'sounds' }, h('span', {}, h('strong', {}, 'Sons'), h('br'), h('span', { class: 'small muted' }, 'Petits jingles à la révélation')), input)]);
}

function deviceCard() {
  const err = errorBox();
  const out = h('div', { 'data-testid': 'device-link', hidden: true });
  const btn = button('Connecter un autre appareil', { variant: 'teal', block: true, 'data-testid': 'make-link' });
  btn.addEventListener('click', async () => {
    err.show(null);
    try {
      const code = await busy(btn, async () => (await getApi()).createDeviceLink());
      const url = `${appBaseUrl()}#/link/${code}`;
      out.replaceChildren(
        h('p', { class: 'code', 'data-testid': 'link-code' }, code),
        h('p', { class: 'small' }, 'Sur le nouvel appareil : ouvre ce lien ou saisis le code dans « Retrouver notre partie ». Valable 15 minutes.'),
        h('p', { class: 'notice' }, 'Attention : cet appareil-ci sera alors déconnecté de la partie.'),
        h('div', { class: 'row' },
          button('Partager le lien', { variant: 'ghost', onClick: () => share({ text: 'Connexion à Duo Quiz', url }) }),
          button('Copier', { variant: 'ghost', onClick: () => copy(url) })));
      out.hidden = false;
    } catch (error) {
      err.show(messageFor(error));
    }
  });
  return card([
    h('h2', {}, 'Changer d’appareil'),
    h('p', { class: 'small muted' }, 'Nouveau téléphone, ou app installée sur iPhone (elle ne partage pas la mémoire de Safari) : génère un code ici.'),
    btn, err, out,
  ]);
}

function leaveCard(mode) {
  const btn = button('Quitter la partie sur cet appareil', { variant: 'ghost', block: true, 'data-testid': 'leave' });
  let armed = false;
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = 'Confirmer : quitter sur cet appareil';
      btn.classList.replace('btn--ghost', 'btn--coral');
      return;
    }
    leave();
    go('#/setup');
  });
  return card([
    h('h2', {}, mode === 'memory' ? 'Mode démo' : 'Autres options'),
    mode === 'memory'
      ? h('a', { class: 'btn btn--ghost btn--block', href: './', 'data-testid': 'exit-demo' }, 'Quitter le mode démo')
      : h('a', { class: 'btn btn--ghost btn--block', href: '?demo=1#/setup', 'data-testid': 'open-demo' }, 'Essayer le mode démo'),
    h('a', { class: 'btn btn--ghost btn--block', href: '#/install' }, 'Installer l’app'),
    h('p', { class: 'small muted' }, 'Quitter efface la partie de ce téléphone seulement. Sans autre appareil connecté, tu ne pourras plus y revenir.'),
    btn,
  ]);
}

export async function render({ mode }) {
  let room;
  try {
    room = await refreshNames();
  } catch (error) {
    return h('section', { class: 'view stack', 'data-view': 'settings' }, h('h1', {}, 'Réglages'),
      card([h('p', { role: 'alert' }, messageFor(error))]), leaveCard(mode));
  }
  const { me } = players();
  return h('section', { class: 'view stack', 'data-view': 'settings' },
    h('h1', {}, 'Plus'),
    h('a', { class: 'card nav-card', href: '#/history', 'data-testid': 'to-history' }, h('span', { 'aria-hidden': 'true' }, '📜'), h('span', {}, 'Historique des questions')),
    !room.p2_name && room.invite_code && me === 1 ? invitePanel(room.invite_code, { onboarding: false }) : null,
    roomForm(room),
    soundsCard(),
    deviceCard(),
    leaveCard(mode));
}
