# Roadmap — Duo Quiz

Chaque session de la Routine prend la **première étape non cochée**, la termine entièrement (code + tests verts), coche la case, ajoute une ligne au Journal, commit et push sur `main`. Si une étape est trop grosse, la découper en sous-cases ici avant de commencer.

- [ ] **1. Socle** — `package.json` (vitest, jsdom, @playwright/test, @vitest/coverage-v8), `vitest.config.js`, `playwright.config.js` (serveur statique local, ex. `npx http-server` ou script Node), `.gitignore`, `index.html`, `css/app.css` (thème + composants de base), `js/app.js` (routeur hash), `js/store.js`, `js/config.js` (vide si pas de clés), `js/vendor.js`. Test : l'app charge en mode démo sans erreur console.
- [ ] **2. Logique pure** — `normalize.js`, `scoring.js`, `draw.js`, `report.js` + tests unitaires exhaustifs (cas limites : égalité, validations manquantes, période vide, changement de période, fuseau Europe/Paris).
- [ ] **3. Adaptateur mémoire** — `js/api/memory.js` respectant le contrat et les règles du schéma ; persistance localStorage en mode démo ; « joueur simulé » en démo (l'autre répond automatiquement après quelques secondes) ; tests de contrat.
- [ ] **4. Adaptateur Supabase** — `js/api/supabase.js` + `js/api/index.js` ; tests avec client Supabase mocké (en-tête x-player-secret présent, colonnes explicites, traduction des erreurs).
- [ ] **5. Banque de questions** — `data/questions.json` ≥ 300 questions (§5 SPEC) + test de validation.
- [ ] **6. Écrans Setup + Aujourd'hui + Round** — création/jointure via code et lien, tirage, réponse en 2 étapes, attente, révélation, validation des questions texte, retards.
- [ ] **7. Questions perso** — écran Ajouter + liste de mes questions en attente.
- [ ] **8. Bilan + Historique** — sélecteur de période, stats, gagnant, partage, historique filtrable.
- [ ] **9. Réglages** — prénoms, questions/jour, période, date de départ, quitter, mode démo.
- [ ] **10. PWA & finitions** — manifest, icônes, service worker, hors-ligne, accessibilité, animations sobres, états vides.
- [ ] **11. E2E** — scénario 2 joueurs complet en mode démo (Playwright).
- [ ] **12. Revue finale** — audit Lighthouse (Playwright + mesures) et corrections, relecture sécurité (aucun secret commité), README utilisateur à jour (installation sur téléphone, déroulé du jeu), `npm run check` vert.

## Journal
<!-- AAAA-MM-JJ — étape — résumé court — résultat des tests -->
