# Duo Quiz 💞

Le jeu à deux pour mieux se connaître : chaque jour, vous répondez aux mêmes questions **et** vous devinez la réponse de l'autre. Chaque bonne prédiction rapporte 1 point. Chaque semaine : bilan, gagnant et rapport de compatibilité.

👉 **https://lucasdelpino.github.io/duo-quiz/**

## Comment on joue

1. **Une personne crée la partie** (son prénom → un code de 8 caractères et un lien).
2. **L'autre la rejoint** en ouvrant le lien (ou en tapant le code) sur son téléphone.
3. **Chaque jour**, l'onglet *Aujourd'hui* propose 3 questions (réglable de 1 à 10) :
   - étape 1 : **ta** réponse ;
   - étape 2 : **ce que l'autre a répondu, selon toi** ;
   - l'envoi est définitif. Tant que l'autre n'a pas répondu, sa réponse reste cachée 🤫 ;
   - quand vous avez répondu tous les deux : révélation, +1 point par bonne prédiction.
4. **Questions à réponse libre** : c'est la personne qui a répondu qui valide la prédiction de l'autre (« Bien vu ✅ / Raté ❌ »).
5. **Ajouter** : écris tes propres questions. Elles sont glissées au hasard parmi celles du jour, sans aucun signe distinctif : l'autre ne saura pas qu'elles viennent de toi. Utilise le bouton « + prénom de l'autre » plutôt que « je » ou « moi ».
6. Les questions non jouées des jours précédents restent disponibles (« En retard »).

**Bilan** : points, précision, catégorie forte/faible, séries, « tu ne l'aurais jamais deviné », sur la période de ton choix — identique sur les deux téléphones, partageable.
**Love** : jauge de compatibilité (score en direct dès 5 questions jouées à deux, puis analyse rédigée chaque semaine), portraits, idées à faire ensemble. C'est un jeu, pas une vérité scientifique 😉

## Installer l'app sur le téléphone

### Samsung / Android (Chrome)
1. Ouvre le lien dans **Chrome**.
2. Touche **Installer** quand l'app le propose, ou menu **⋮** → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
3. Ouvre Duo Quiz depuis l'écran d'accueil.

### iPhone (Safari)
1. Ouvre le lien dans **Safari**, crée ou rejoins la partie.
2. ⚠️ L'app installée ne partage pas la mémoire de Safari : sur l'écran « Installer l'app », touche **Générer un code pour l'app installée** (valable 15 min).
3. Touche **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
4. Ouvre Duo Quiz depuis l'écran d'accueil → « Retrouver notre partie sur ce téléphone » → saisis le code.

### Changer de téléphone
*Plus* → **Connecter un autre appareil** : un code (15 min) à saisir sur le nouveau téléphone. L'ancien est alors déconnecté.

## Mode démo
Ajoute `?demo=1` à l'adresse : tout reste sur le téléphone, rien n'est envoyé sur Internet, avec un partenaire simulé et un rapport d'analyse d'exemple.

## Mise en ligne (une seule fois)
1. Supabase → SQL Editor : exécuter `supabase/schema.sql`, puis `supabase/migrations/001_anonymat_et_analyses.sql`.
2. Copier *Project URL* et la clé **anon public** dans `js/config.js` (clés publiques par conception ; ne jamais y mettre la clé `service_role`).
3. GitHub : Settings → Pages → *Deploy from a branch* → `main` / `(root)`.

## Développement
- `npm ci` puis `npm run check` (validation de la banque + Vitest avec couverture + Playwright en émulation Galaxy S et iPhone, mode démo, sans réseau).
- `npm run serve` → http://127.0.0.1:4173/duo-quiz/?demo=1
- `npm run fonts` (polices auto-hébergées), `npm run icons` (icônes PNG, nécessite `sharp`), `npm run bank` (valide `data/questions.json`).
- Vanilla JS (modules ES), sans build ; cahier des charges : [`docs/SPEC.md`](docs/SPEC.md) ; avancement : [`ROADMAP.md`](ROADMAP.md).

## À exécuter par Lucas (Supabase → SQL Editor)
- [x] `supabase/migrations/001_anonymat_et_analyses.sql` — anonymat des questions perso, rapports IA, reconnexion d'appareil (déjà exécutée en production d'après la SPEC).
- Aucune nouvelle migration requise : la facette des questions est stockée dans `category` (« gouts:aime ») pour la banque comme pour les questions perso.
- [x] `supabase/migrations/003_questions_illimitees.sql` — option « Illimité » pour les questions par jour.
- [ ] `supabase/migrations/004_rythme_commun.sql` — rythme commun : alerte au-delà de 10 réponses de retard, blocage à 15 d’avance.
