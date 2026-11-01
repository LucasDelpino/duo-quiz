# Instructions pour Claude (Routine autonome)

Tu développes **Duo Quiz** en totale autonomie. Lucas ne répondra pas pendant la session : ne pose aucune question, prends la décision la plus raisonnable conforme à `docs/SPEC.md` et note-la dans le Journal de `ROADMAP.md`.

## À chaque session
1. Lis `docs/SPEC.md` puis `ROADMAP.md`.
2. `npm ci` (ou `npm install` si pas de lockfile), puis `npm run check` pour vérifier l'état de départ. Si c'est rouge, **répare d'abord**.
3. Prends la première étape non cochée. Implémente-la complètement, avec ses tests.
4. `npm run check` doit être **vert** avant de commit. Ne jamais commit des tests désactivés/`skip` pour faire passer.
5. Coche l'étape, ajoute une ligne au Journal (date, étape, résumé, tests).
6. Commit clair en français (`feat: …`, `test: …`, `fix: …`) et push sur `main`.
7. S'il reste du temps et que tout est vert, enchaîne l'étape suivante.
8. Quand toutes les étapes sont cochées : session de **maintenance** — lancer `npm run check`, corriger, améliorer la banque de questions ou l'UX dans le respect de la SPEC, sans refonte.

## Règles
- Stack imposée : vanilla JS modules, sans build, servi par GitHub Pages. Pas de framework, pas de bundler.
- Ne jamais commit de secret. `js/config.js` contient seulement l'URL Supabase et la clé **anon** (publique par conception).
- Ne pas modifier les fichiers `.github/workflows/` (le jeton peut ne pas avoir le droit).
- Pas de réseau externe dans les tests : mode démo / mocks uniquement. Chromium + Playwright préinstallés : ne pas lancer `playwright install` ; si `@playwright/test` ne trouve pas le navigateur, utiliser `chromium.launch()` du paquet `playwright` global ou `executablePath` du Chromium système.
- Si le schéma SQL doit évoluer : migration idempotente dans `supabase/migrations/` + section « À exécuter par Lucas » dans le README.
- Code lisible, fonctions courtes, commentaires en français seulement quand c'est utile.
