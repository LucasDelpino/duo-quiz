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
  { text: 'Quel petit geste de {autre} te fait le plus plaisir ?', kind: 'text', options: null, category: 'couple:amour' },
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
        1: { portrait: { resume: 'Un tempérament calme et loyal, qui avance à son rythme mais toujours avec cœur.', traits: ['Fiable', 'Pudique', 'Drôle à froid'], comportement: 'Observe avant d’agir, préfère les plans simples et bien faits.', emotions: 'Garde ses émotions pour lui, les montre par des gestes plutôt que par des mots.', en_couple: 'Protecteur et attentionné, il a besoin de sentir qu’on compte sur lui.', besoins: ['Du calme après le travail', 'De la reconnaissance'], points_forts: ['Constance', 'Humour'], vigilance: ['Peut se refermer quand il est fatigué'], conseil: 'Proposer plutôt que demander : il adore qu’on l’embarque dans une surprise.' }, aime: ['Les week-ends improvisés'], naime_pas: ['Se lever tôt'], ressenti: 'Semble avoir besoin de calme en ce moment.', a_savoir: ['Rêve d’apprendre le piano'], surprises: ['Préfère la montagne à la mer'] },
        2: { portrait: { resume: 'Une énergie solaire et curieuse, qui vit les choses intensément.', traits: ['Enthousiaste', 'Sensible', 'Spontanée'], comportement: 'Fonce, s’emballe vite pour de nouveaux projets et entraîne les autres.', emotions: 'Exprime ce qu’elle ressent facilement, a besoin d’être entendue.', en_couple: 'Très démonstrative, elle nourrit la relation de petites attentions.', besoins: ['Des mots doux', 'Des projets à deux'], points_forts: ['Générosité', 'Optimisme'], vigilance: ['Peut se sentir délaissée sans signes d’attention'], conseil: 'Un petit message dans la journée vaut de l’or pour elle.' }, aime: ['Les petits mots doux'], naime_pas: ['Les retards'], ressenti: 'Paraît enthousiaste et plein·e de projets.', a_savoir: ['Aimerait vivre un an à l’étranger'], surprises: ['Adore les films d’horreur'] },
      },
      points_communs: ['L’amour des voyages', 'Le goût des soirées tranquilles'],
      differences: ['Rythme du matin', 'Rapport au rangement'],
      a_faire_ensemble: ['Un week-end surprise en montagne', 'Un cours de cuisine à deux'],
      questions_a_se_poser: ['Où vous voyez-vous dans 5 ans ?'],
      evolution: null,
    },
  };
}
