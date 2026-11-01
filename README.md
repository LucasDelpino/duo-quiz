# Duo Quiz

Le jeu à deux pour mieux se connaître : chaque jour, répondez aux mêmes questions et devinez la réponse de l'autre. Bilan chaque semaine : qui connaît le mieux l'autre ?

- Cahier des charges : [`docs/SPEC.md`](docs/SPEC.md)
- Avancement : [`ROADMAP.md`](ROADMAP.md)
- Base de données : [`supabase/schema.sql`](supabase/schema.sql) (à exécuter une fois dans Supabase → SQL Editor)

## Mise en ligne (une seule fois)
1. Supabase : exécuter `supabase/schema.sql`, puis copier *Project URL* et *anon public key* dans `js/config.js`.
2. GitHub : Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
3. Ouvrir `https://lucasdelpino.github.io/duo-quiz/` sur chaque téléphone → « Ajouter à l'écran d'accueil ».

## Développement
`npm install` puis `npm run check`. Mode démo sans backend : ajouter `?demo=1` à l'URL.

## À exécuter par Lucas (Supabase → SQL Editor)
- [x] `supabase/migrations/001_anonymat_et_analyses.sql` — anonymat des questions perso, rapports IA, reconnexion d'appareil.
- [x] `supabase/migrations/002_progression_du_jour.sql` — indicateur « qui a joué aujourd'hui ».
