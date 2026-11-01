// Construction d'une question perso au format EXACT de la banque (anonymat) + validation.
import { normalizeQuestionText, normalizeOptions } from './normalize.js';
import { CATEGORIES, encodeCategory } from './category.js';
import { FACETS } from './compat.js';

export const FACET_LABELS = {
  aime: 'ce qu’on aime',
  naime_pas: 'ce qu’on n’aime pas',
  ressenti: 'ce qu’on ressent',
  valeurs: 'nos valeurs',
  futur: 'l’avenir, les rêves',
  amour: 'l’amour, notre couple',
  souvenir: 'un souvenir',
  fun: 'juste pour rire',
};

export const KIND_LABELS = { choice: 'Choix multiple', scale: 'Échelle de 1 à 5', text: 'Réponse libre' };

const cleanLabel = (s) => String(s ?? '').replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Texte final : « Question (1 = …, 5 = …) ? » pour une échelle, comme dans la banque. */
export function buildText({ text, kind, low, high }) {
  const base = normalizeQuestionText(text);
  if (!base) return '';
  if (kind !== 'scale') return base;
  const l1 = cleanLabel(low) || 'pas du tout';
  const l5 = cleanLabel(high) || 'énormément';
  const stem = base.replace(/ \?$/, '').replace(/\s*\(1 = [^)]*\)$/, '');
  return normalizeQuestionText(`${stem} (1 = ${l1}, 5 = ${l5})`);
}

/** → { question, errors } ; `question` est prêt pour addCustomQuestion. */
export function buildCustomQuestion({ text, kind, options = [], low, high, category, facet }) {
  const errors = [];
  const finalText = buildText({ text, kind, low, high });
  if ([...finalText].length < 3) errors.push('Écris ta question (au moins 3 caractères).');
  if ([...finalText].length > 300) errors.push('Ta question est trop longue (300 caractères maximum).');
  if (!['choice', 'scale', 'text'].includes(kind)) errors.push('Choisis un type de réponse.');
  const opts = kind === 'choice' ? normalizeOptions(options) : null;
  if (kind === 'choice' && (opts.length < 2 || opts.length > 6)) errors.push('Propose entre 2 et 6 choix différents.');
  if (opts && opts.some((o) => [...o].length > 100)) errors.push('Un choix est trop long (100 caractères maximum).');
  if (!CATEGORIES.includes(category)) errors.push('Choisis une catégorie.');
  if (!FACETS.includes(facet)) errors.push('Dis de quoi parle ta question.');
  if (/\{(?!autre\})[^}]*\}/.test(finalText)) errors.push('Seul {autre} est permis entre accolades.');
  return {
    errors,
    question: errors.length ? null : { text: finalText, kind, options: opts, category: encodeCategory(category, facet) },
  };
}
