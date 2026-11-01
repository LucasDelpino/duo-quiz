// Règles de validation de la banque de questions (SPEC §5). Renvoie la liste des erreurs.
import { normalizeQuestionText, normalizeOptions, normalizeAnswer } from '../js/logic/normalize.js';
import { CATEGORIES } from '../js/logic/category.js';
import { FACETS } from '../js/logic/compat.js';

// Sujets exclus partout ; le vocabulaire intime n'est autorisé que dans la catégorie « coquin ».
const FORBIDDEN = /\bsalaire|\bton ex\b|\btes ex\b|\bmaladie|\bmédicament|\bton poids\b|\bcombien gagnes/i;
const INTIMATE = /\bsex|\bnu·?e?\b|lingerie|torride|strip|libido|coquin|faire l’amour|sous la couette/i;

export function validateBank(bank) {
  const errors = [];
  if (!Array.isArray(bank)) return ['La banque doit être un tableau'];
  if (bank.length < 300) errors.push(`Au moins 300 questions attendues (${bank.length})`);
  const ids = new Set();
  const texts = new Set();
  const kinds = { choice: 0, scale: 0, text: 0 };
  const perCat = {};
  const perFacet = {};
  for (const q of bank) {
    const where = q?.id ?? JSON.stringify(q);
    const err = (m) => errors.push(`${where} : ${m}`);
    if (!/^q\d{3,}$/.test(q?.id ?? '')) err('id invalide');
    if (ids.has(q.id)) err('id en double');
    ids.add(q.id);
    const keys = Object.keys(q).sort().join(',');
    if (keys !== 'category,facet,id,kind,options,text') err(`champs inattendus (${keys})`);
    if (typeof q.text !== 'string' || q.text !== normalizeQuestionText(q.text)) err('texte non normalisé (comme une question perso)');
    if ([...String(q.text)].length > 300) err('texte trop long');
    const key = normalizeAnswer(q.text);
    if (texts.has(key)) err('texte en double');
    texts.add(key);
    if ((String(q.text).match(/\{[^}]*\}/g) || []).some((t) => t !== '{autre}')) err('seul {autre} est autorisé');
    if (FORBIDDEN.test(q.text) || (q.options || []).some((o) => FORBIDDEN.test(o))) err('sujet exclu (argent personnel, santé, ex)');
    if (q.category !== 'coquin' && (INTIMATE.test(q.text) || (q.options || []).some((o) => INTIMATE.test(o)))) err('contenu intime hors de la catégorie « coquin »');
    if (!(q.kind in kinds)) err('kind invalide');
    else kinds[q.kind] += 1;
    if (!CATEGORIES.includes(q.category)) err('catégorie inconnue');
    if (!FACETS.includes(q.facet)) err('facette inconnue');
    perCat[q.category] = (perCat[q.category] || 0) + 1;
    perFacet[q.facet] = (perFacet[q.facet] || 0) + 1;
    if (q.kind === 'choice') {
      const ok = Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6;
      if (!ok) err('un QCM a 2 à 6 options');
      else if (JSON.stringify(normalizeOptions(q.options)) !== JSON.stringify(q.options)) err('options non normalisées ou en double');
      else if (q.options.some((o) => [...o].length > 500)) err('option trop longue');
    } else if (q.options !== null) err('options doit valoir null');
    if (q.kind === 'scale' && !/\(1 = [^,]+, 5 = [^)]+\) \?$/.test(q.text)) err('échelle sans libellés « (1 = …, 5 = …) »');
  }
  const n = bank.length || 1;
  const share = (k) => kinds[k] / n;
  if (Math.abs(share('choice') - 0.5) > 0.05) errors.push(`Répartition choice ≈ 50 % (${Math.round(share('choice') * 100)} %)`);
  if (Math.abs(share('scale') - 0.25) > 0.05) errors.push(`Répartition scale ≈ 25 % (${Math.round(share('scale') * 100)} %)`);
  if (Math.abs(share('text') - 0.25) > 0.05) errors.push(`Répartition text ≈ 25 % (${Math.round(share('text') * 100)} %)`);
  for (const c of CATEGORIES) if ((perCat[c] || 0) < 15) errors.push(`Catégorie ${c} trop peu fournie (${perCat[c] || 0})`);
  for (const f of FACETS) if (!perFacet[f]) errors.push(`Facette ${f} jamais utilisée`);
  return errors;
}
