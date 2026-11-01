// Catégorie stockée côté serveur sous la forme « categorie:facette » pour la banque ET les questions perso
// (le schéma n'a pas de colonne facette ; même format partout = anonymat préservé).

export const CATEGORIES = ['gouts', 'souvenirs', 'quotidien', 'reves', 'valeurs', 'couple', 'voyage', 'humour', 'et-si', 'enfance', 'coquin'];

/** Catégorie « Coquin » : dosée par le réglage commun `spicy` (0 = désactivée, 1 = de temps en temps, 2 = souvent). */
export const SPICY = 'coquin';

export const CATEGORY_LABELS = {
  gouts: 'Goûts', souvenirs: 'Souvenirs', quotidien: 'Quotidien', reves: 'Rêves', valeurs: 'Valeurs',
  couple: 'Couple', voyage: 'Voyage', humour: 'Humour', 'et-si': 'Et si…', enfance: 'Enfance', coquin: 'Coquin 🔥',
};

export function encodeCategory(category, facet) {
  return facet ? `${category}:${facet}` : category;
}

export function decodeCategory(raw) {
  const [category = '', facet = null] = String(raw ?? '').split(':');
  return { category, facet: facet || null };
}

export const categoryLabel = (raw) => {
  const { category } = decodeCategory(raw);
  return CATEGORY_LABELS[category] || 'Divers';
};
