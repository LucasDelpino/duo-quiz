// Données du mode démo : partenaire simulé et rapport IA factice (format SPEC §4.2).

export const DEMO_PARTNER = 'Alex';

export const PARTNER_TEXTS = [
  'Un dimanche matin sans réveil, avec des croissants',
  'Partir sur un coup de tête, juste nous deux',
  'Quand tu ris à mes blagues nulles',
  'Le bruit de la pluie sur le toit',
  'Apprendre à faire du pain maison',
];

export const PARTNER_QUESTIONS = [
  { text: 'Quel petit geste de ma part te fait le plus plaisir ?', kind: 'text', options: null, category: 'couple:amour' },
  { text: 'Plutôt soirée jeux ou soirée film ?', kind: 'choice', options: ['Soirée jeux', 'Soirée film'], category: 'quotidien:aime' },
];

export function fakeAnalysis(room_id, period_start, period_end) {
  return {
    id: 'demo-analysis-1',
    room_id,
    period_start,
    period_end,
    compatibility: 78,
    created_at: period_end + 'T21:00:00Z',
    content: {
      summary: 'Une semaine pleine de complicité : vous vous devinez très bien sur le quotidien, un peu moins sur les rêves.',
      compatibility: 78,
      compatibility_explained: 'Beaucoup d’accords sur les valeurs et une connaissance mutuelle équilibrée.',
      players: {
        1: { aime: ['Les week-ends improvisés'], naime_pas: ['Se lever tôt'], ressenti: 'Semble avoir besoin de calme en ce moment.', a_savoir: ['Rêve d’apprendre le piano'], surprises: ['Préfère la montagne à la mer'] },
        2: { aime: ['Les petits mots doux'], naime_pas: ['Les retards'], ressenti: 'Paraît enthousiaste et plein·e de projets.', a_savoir: ['Aimerait vivre un an à l’étranger'], surprises: ['Adore les films d’horreur'] },
      },
      points_communs: ['L’amour des voyages', 'Le goût des soirées tranquilles'],
      differences: ['Rythme du matin', 'Rapport au rangement'],
      a_faire_ensemble: ['Un week-end surprise en montagne', 'Un cours de cuisine à deux'],
      questions_a_se_poser: ['Où vous voyez-vous dans 5 ans ?'],
      evolution: null,
    },
  };
}
