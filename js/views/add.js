// « Ajouter » : une question perso glissée en secret parmi celles du jour (indiscernable de la banque).
import { h, clear } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card } from '../ui/card.js';
import { field, errorBox, busy } from '../ui/form.js';
import { categoryChip } from '../ui/status.js';
import { toast } from '../ui/toast.js';
import { messageFor } from '../api/errors.js';
import { getApi } from '../context.js';
import { players, textFor } from '../game.js';
import { buildCustomQuestion, buildText, FACET_LABELS, KIND_LABELS } from '../logic/custom.js';
import { CATEGORIES, CATEGORY_LABELS, encodeCategory } from '../logic/category.js';
import { normalizeOptions } from '../logic/normalize.js';

function select(id, label, entries, value) {
  return h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('select', { id, name: id, class: 'select' },
      entries.map(([v, l]) => h('option', { value: v, selected: v === value }, l))));
}

function optionsEditor(onChange) {
  const list = h('div', { class: 'stack options-editor', 'data-testid': 'options-editor' });
  const add = button('+ Ajouter un choix', { variant: 'ghost', 'data-testid': 'add-option' });
  const row = (value = '') => {
    const input = h('input', { class: 'input', value, maxlength: 100, 'aria-label': 'Choix', placeholder: 'Un choix', enterkeyhint: 'next' });
    const rm = button('✕', { variant: 'ghost', 'aria-label': 'Retirer ce choix' });
    const el = h('div', { class: 'option-row' }, input, rm);
    input.addEventListener('input', onChange);
    rm.addEventListener('click', () => {
      if (list.children.length > 2) { el.remove(); refresh(); onChange(); }
    });
    return el;
  };
  const refresh = () => { add.hidden = list.children.length >= 6; };
  add.addEventListener('click', () => { list.append(row()); refresh(); list.lastChild.querySelector('input').focus(); });
  list.append(row(), row());
  const wrap = h('div', { class: 'stack' }, h('span', { class: 'label' }, 'Les choix (2 à 6)'), list, add);
  wrap.values = () => [...list.querySelectorAll('input')].map((i) => i.value);
  return wrap;
}

async function pendingList(container) {
  const { me, names } = players();
  clear(container);
  try {
    const pending = await (await getApi()).listMyPendingCustom();
    const n = pending.length;
    container.append(
      h('h2', { 'data-testid': 'pending-count' }, n === 0 ? 'Aucune question surprise en réserve' : `${n} question${n > 1 ? 's' : ''} surprise${n > 1 ? 's' : ''} en réserve 🤫`),
      n ? h('ul', { class: 'pending-list' }, pending.map((q) => h('li', {}, categoryChip(q.category), h('span', {}, textFor(q.text, me, names))))) : null,
      h('p', { class: 'small muted' }, 'Elles apparaîtront au hasard dans les questions du jour, au plus une sur deux.'));
  } catch (error) {
    container.append(h('p', { role: 'alert' }, messageFor(error)));
  }
}

export function render() {
  const { me, them, names } = players();
  const err = errorBox();
  const preview = h('div', { 'data-testid': 'preview' });
  const pending = card([], { 'data-testid': 'pending' });

  const textField = field({ id: 'q-text', label: 'Ta question', textarea: true, rows: 3, maxlength: 280, enterkeyhint: 'done', placeholder: 'Quel est ton plus beau souvenir avec {autre} ?' });
  const textarea = textField.querySelector('textarea');
  const insertOther = button(`+ prénom de l’autre`, { variant: 'ghost', 'data-testid': 'insert-other' });
  insertOther.addEventListener('click', () => {
    const at = textarea.selectionStart ?? textarea.value.length;
    textarea.value = `${textarea.value.slice(0, at)}{autre}${textarea.value.slice(at)}`;
    update();
    textarea.focus();
  });

  const kinds = h('div', { class: 'kind-picker', role: 'radiogroup', 'aria-label': 'Type de réponse' },
    Object.entries(KIND_LABELS).map(([k, l]) => h('label', { class: 'kind' },
      h('input', { type: 'radio', name: 'q-kind', value: k, checked: k === 'choice' }), h('span', {}, l))));
  const opts = optionsEditor(() => update());
  const scale = h('div', { class: 'stack', 'data-testid': 'scale-labels' },
    field({ id: 'q-low', label: '1 =', value: 'pas du tout', maxlength: 40 }),
    field({ id: 'q-high', label: '5 =', value: 'énormément', maxlength: 40 }));
  const category = select('q-category', 'Catégorie', CATEGORIES.map((c) => [c, CATEGORY_LABELS[c]]), 'couple');
  const facet = select('q-facet', 'Ça parle de…', Object.entries(FACET_LABELS), 'amour');

  const values = () => ({
    text: textarea.value,
    kind: kinds.querySelector('input:checked')?.value,
    options: opts.values(),
    low: scale.querySelector('#q-low').value,
    high: scale.querySelector('#q-high').value,
    category: category.querySelector('select').value,
    facet: facet.querySelector('select').value,
  });

  function update() {
    const v = values();
    opts.hidden = v.kind !== 'choice';
    scale.hidden = v.kind !== 'scale';
    const text = buildText(v);
    clear(preview).append(text
      ? card([
        categoryChip(encodeCategory(v.category, v.facet)),
        h('p', { class: 'q-text' }, textFor(text, me, names)),
        v.kind === 'choice' ? h('div', { class: 'options' }, normalizeOptions(v.options).map((o) => h('span', { class: 'option' }, textFor(o, me, names)))) : null,
      ], { variant: 'question' })
      : h('p', { class: 'small muted' }, 'L’aperçu de ta question apparaîtra ici.'));
  }

  const form = h('form', { id: 'add-form', class: 'stack', novalidate: true },
    textField, insertOther,
    h('p', { class: 'small muted' }, `Écris-la comme si l’app la posait, sans « je » ni « moi » : elle sera posée à vous deux. {autre} affichera le prénom de l’autre (${names[them]} pour toi, ${names[me]} pour ${names[them]}).`),
    h('fieldset', { class: 'stack plain' }, h('legend', { class: 'label' }, 'Type de réponse'), kinds),
    opts, scale, category, facet,
    h('h3', {}, 'Aperçu'), preview,
    err,
    button('Ajouter en secret', { type: 'submit', size: 'lg', block: true, 'data-testid': 'submit' }));
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.show(null);
    const { question, errors } = buildCustomQuestion(values());
    if (errors.length) return err.show(errors[0]);
    try {
      await busy(form.querySelector('[type="submit"]'), async () => (await getApi()).addCustomQuestion(question));
      toast('Question ajoutée en secret 🤫', { type: 'success' });
      textarea.value = '';
      opts.querySelectorAll('input').forEach((i) => { i.value = ''; });
      update();
      await pendingList(pending);
    } catch (error) {
      err.show(messageFor(error));
    }
  });

  update();
  pendingList(pending);
  return h('section', { class: 'view stack', 'data-view': 'add' },
    h('div', {}, h('h1', {}, 'Ajouter une question'),
      h('p', { class: 'muted' }, `Elle sera glissée parmi les questions du jour : ${names[them]} ne saura pas qu’elle vient de toi.`)),
    card(form),
    pending);
}
