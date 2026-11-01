// Erreurs de l'API (codes identiques à ceux levés par le SQL) et messages français.

export const MESSAGES = {
  invalid_invite: 'Ce code d’invitation est invalide ou a déjà été utilisé.',
  invalid_link: 'Ce code de connexion est invalide ou a expiré (15 min).',
  unauthorized: 'Cet appareil n’est plus connecté à votre partie. Rejoins-la à nouveau.',
  invalid_date: 'Date invalide : vérifie la date et l’heure du téléphone.',
  invalid_name: 'Le prénom doit faire entre 1 et 30 caractères.',
  invalid_answer: 'Ta réponse doit faire entre 1 et 500 caractères.',
  already_answered: 'Tu as déjà répondu à cette question.',
  invalid_question: 'Question invalide : 3 à 300 caractères, et 2 à 6 choix pour un QCM.',
  invalid_settings: 'Réglage invalide.',
  not_allowed: 'Action impossible pour le moment.',
  not_found: 'Introuvable.',
  network: 'Connexion impossible. Vérifie ton réseau et réessaie.',
  unknown: 'Oups, quelque chose s’est mal passé. Réessaie.',
};

export class ApiError extends Error {
  constructor(code, cause) {
    super(MESSAGES[code] || MESSAGES.unknown);
    this.name = 'ApiError';
    this.code = MESSAGES[code] ? code : 'unknown';
    if (cause) this.cause = cause;
  }
}

export const messageFor = (err) => (err instanceof ApiError ? err.message : MESSAGES.unknown);
