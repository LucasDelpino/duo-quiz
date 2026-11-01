// Normalisation des textes : comparaison de réponses et mise en forme des questions.
// Les questions perso ET la banque suivent exactement la même forme (anonymat).

const collapse = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Forme de comparaison : minuscules, sans accents, espaces et ponctuation finale ignorés. */
export function normalizeAnswer(s) {
  return collapse(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[\s.!?…]+$/u, '')
    .trim();
}

export function sameAnswer(a, b) {
  const x = normalizeAnswer(a);
  return x !== '' && x === normalizeAnswer(b);
}

const capitalize = (s) => s.charAt(0).toLocaleUpperCase('fr-FR') + s.slice(1);

/** « tu préfères quoi?? » → « Tu préfères quoi ? » (apostrophe typographique, espace avant « ? »). */
export function normalizeQuestionText(s) {
  const t = collapse(s).replace(/'/g, '’').replace(/[\s?.!]+$/u, '');
  return t ? `${capitalize(t)} ?` : '';
}

/** Options d'un QCM : nettoyées, majuscule initiale, sans vides ni doublons. */
export function normalizeOptions(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const o = collapse(raw).replace(/'/g, '’');
    const key = normalizeAnswer(o);
    if (!o || seen.has(key)) continue;
    seen.add(key);
    out.push(capitalize(o));
  }
  return out;
}

/** Remplace {autre} par le prénom de l'autre joueur. */
export function fillOther(text, name) {
  return String(text ?? '').replaceAll('{autre}', name || 'ton/ta partenaire');
}
