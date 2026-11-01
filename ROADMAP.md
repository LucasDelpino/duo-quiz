# Roadmap — Duo Quiz

Chaque session de la Routine prend la **première étape non cochée**, la termine entièrement (code + tests verts), coche la case, ajoute une ligne au Journal, commit et push sur `main`. Si une étape est trop grosse, la découper en sous-cases ici avant de commencer.

- [x] **1. Socle** — `package.json` (vitest, jsdom, @playwright/test, @vitest/coverage-v8, @fontsource/*), configs Vitest/Playwright (serveur statique local + projets « Galaxy S » et « iPhone »), `.gitignore`, `index.html` (métas iOS/Android §8), `js/app.js` (routeur + barre d'onglets), `js/store.js`, `js/vendor.js`. Test : l'app charge en mode démo sans erreur console sur les 2 émulations.
- [x] **2. Design system** — `css/app.css` (§7 : palette, typo auto-hébergée, cartes, boutons, onglets, safe-areas), composants `js/ui/` (carte qui se retourne, confettis, toasts, compteur, jauge). Page démo interne `#/styleguide` (non liée dans la nav).
- [x] **3. Logique pure** — `normalize`, `scoring`, `draw`, `report`, `compat` + tests exhaustifs (égalité, validations manquantes, période vide, fuseau Europe/Paris, pondération facettes, seuil 5 rounds).
- [x] **4. Adaptateur mémoire** — contrat complet (anonymat, max perso/jour, ordre aléatoire, anti-triche), persistance localStorage, « partenaire simulé » en démo + rapport IA factice ; tests de contrat.
- [ ] **5. Adaptateur Supabase** — avec client mocké (en-tête, colonnes explicites sans source/author/bank_id, traduction des erreurs, `usedBankIds`, `listAnalyses`).
- [ ] **6. Banque de questions** — ≥ 300 questions couple (§5) avec catégories + facettes, `{autre}` ; test de validation.
- [ ] **7. Setup + installation** — créer/rejoindre (code + lien), tuto d'installation Android / iPhone, reconnexion d'un appareil.
- [ ] **8. Aujourd'hui + Round** — tirage, réponse en 2 étapes, attente, révélation animée, validation `text`, retards.
- [ ] **9. Questions perso** — formulaire normalisé (anonymat), facette, liste de mes questions en réserve.
- [ ] **10. Bilan + Historique** — sélecteur de période, stats, gagnant, partage, historique filtrable.
- [ ] **11. Love report** — jauge, score direct + portraits, rapport IA (affichage défensif), courbe d'évolution.
- [ ] **12. Réglages** — prénoms, questions/jour, période, date de départ, sons, quitter, démo.
- [ ] **13. PWA & finitions** — manifest, icônes PNG (dont apple-touch-icon 180), service worker, hors-ligne, accessibilité, états vides, `prefers-reduced-motion`.
- [ ] **14. E2E** — scénario 2 joueurs Galaxy + iPhone complet (§9).
- [ ] **15. Revue finale** — Lighthouse, audit anonymat (rien ne trahit une question perso), audit secrets, README utilisateur (installation sur Samsung et iPhone, règles), `npm run check` vert.

## Journal
<!-- AAAA-MM-JJ — étape — résumé court — résultat des tests -->
- 2026-11-01 — cadrage — SPEC v2 (couple, anonymat, iOS/Android, compatibilité + rapport IA), migration 001 testée en local — n/a
- 2026-11-01 — 1. Socle — package.json (Playwright épinglé 1.63.0 = Chromium préinstallé), serveur statique `scripts/serve.mjs` (racine + /duo-quiz/), routeur hash pur `js/router.js` (choix : séparé de app.js pour être testable), store, sélection d'adaptateur, index.html métas iOS/Android, onglet « Plus » → Réglages ; iPhone émulé sur Chromium (WebKit absent) — Vitest 16 ✓, Playwright 8 ✓ (Galaxy S9+ / iPhone 14)
- 2026-11-01 — 2. Design system — `css/app.css` (palette nuit→magenta, Fredoka/Nunito auto-hébergées via `npm run fonts`, cartes, boutons ≥ 52 px, onglets, safe-areas, fond fixe via `body::before` car `background-attachment: fixed` est ignoré sur iOS, reduced-motion), `js/ui/` (carte qui se retourne, confettis 1,5 Ko, toasts, compteur, jauge SVG, motion/vibration), `#/styleguide` — Vitest 28 ✓, Playwright 12 ✓
- 2026-11-01 — 3. Logique pure — `js/logic/` : dates (Europe/Paris, ajouté pour isoler le fuseau), normalize (forme commune banque/perso : majuscule, apostrophe ’, « ? » précédé d'une espace), scoring, draw (alternance de catégories, tri par id), report (périodes, gagnant au titre identique sur les 2 téléphones « X connaît Y par cœur 👑 », pas de « pire catégorie » si toutes se valent, séries, surprises, évolution, partage), compat (40/40/20 avec poids redistribués si une composante manque, facettes ×2/×0,5, facette déduite de la catégorie si absente, seuil 5, portraits). Seuil de couverture 90 % sur js/logic — Vitest 65 ✓ (logic 100 % lignes), Playwright 12 ✓
- 2026-11-01 — 4. Adaptateur mémoire — `js/api/memory.js` (base partagée `duo-quiz:demo-db` relue à chaque appel → 2 instances/2 contextes = 2 téléphones ; règles SQL reproduites : anonymat des colonnes, max(1, n/2) perso/jour, tri par id aléatoire, anti-triche, jugement text, double réponse, liens d'appareil 15 min), `startDemo()` = partie solo avec partenaire simulé « Alex » + rapport IA factice, `errors.js` (codes SQL → messages français), `createApi()`. Décision : la facette est encodée dans `category` (« gouts:aime ») pour la banque ET les questions perso → pas de migration SQL et anonymat intact (`js/logic/category.js`) — Vitest 90 ✓ (memory.js 100 % lignes), Playwright 12 ✓
