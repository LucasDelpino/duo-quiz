# Duo Quiz — Cahier des charges

Jeu pour **2 joueurs exactement**, pour mieux se connaître. Chaque jour, des questions sont tirées (banque aléatoire + questions créées par les joueurs). Chacun répond **pour lui** et **devine la réponse de l'autre**. 1 point par bonne prédiction. Bilan hebdomadaire (période réglable) : qui connaît le mieux l'autre ?

Langue de l'interface : **français**. Cible : **smartphone** (chacun le sien), installable en PWA.

## 1. Stack (imposée)

- **Front** : HTML + CSS + JavaScript **vanilla, modules ES, sans build**. Servi tel quel par **GitHub Pages** (branche `main`, racine `/`).
- **Backend** : **Supabase** (Postgres + PostgREST). Schéma : `supabase/schema.sql` (déjà testé, ne pas modifier sans raison — voir §6).
- Client : `@supabase/supabase-js` v2 importé depuis `https://esm.sh/@supabase/supabase-js@2` (version figée dans `js/vendor.js`).
- **Tests** : Vitest (+ jsdom) pour la logique ; Playwright pour un test e2e en **mode démo** (aucun réseau). Chromium + Playwright sont préinstallés dans l'environnement Claude : ne pas lancer `playwright install`.
- Aucune dépendance runtime autre que supabase-js. `package.json` ne sert qu'aux tests.

## 2. Architecture des fichiers

```
index.html            shell unique, <main id="app">
manifest.webmanifest  PWA (nom "Duo Quiz", icônes SVG/PNG dans assets/)
sw.js                 service worker : cache des assets statiques, réseau d'abord pour Supabase
css/app.css           thème sombre, mobile-first, variables CSS, contrastes AA
js/config.js          SUPABASE_URL + SUPABASE_ANON_KEY (publiques) — fourni par Lucas
js/vendor.js          ré-export de supabase-js
js/app.js             routeur (hash : #/setup, #/today, #/round/:id, #/add, #/report, #/history, #/settings)
js/store.js           session locale (localStorage : room_id, player, secret, noms)
js/api/index.js       choisit l'adaptateur : 'supabase' si config renseignée, sinon 'memory' ; `?demo=1` force 'memory'
js/api/supabase.js    adaptateur Supabase (en-tête x-player-secret)
js/api/memory.js      adaptateur en mémoire qui reproduit EXACTEMENT les règles du schéma (anti-triche, quota, surprises)
js/logic/scoring.js   fonctions pures de score
js/logic/report.js    fonctions pures de bilan
js/logic/draw.js      mélange/sélection des candidates de la banque
js/logic/normalize.js normalisation des réponses
js/views/*.js         une vue par écran
data/questions.json   banque de questions
tests/unit/*.test.js  Vitest
tests/e2e/*.spec.js   Playwright (mode démo, 2 contextes navigateur = 2 joueurs)
```

**Les deux adaptateurs exposent la même interface** (contrat testé sur les deux) :

```
createRoom(name) -> {room_id, secret, player, invite_code}
joinRoom(code, name) -> {room_id, secret, player}
getRoom() -> {id, p1_name, p2_name, invite_code, questions_per_day, report_period_days, report_start}
updateRoom(patch)                       // colonnes autorisées seulement
ensureRounds(dateISO, candidates) -> Round[]
listRounds({from, to}) -> Round[]
listAnswers(roundIds) -> Answer[]       // filtrées par la règle anti-triche
submitAnswer(roundId, self, guess)
listJudgments(roundIds) -> Judgment[]
judge(roundId, correct)                 // upsert
addCustomQuestion({text, kind, options, category})
listMyPendingCustom() -> CustomQuestion[]
```

### Accès Supabase

`createClient(URL, ANON_KEY, { global: { headers: { 'x-player-secret': secret } } })`. Le secret est généré par le serveur (`create_room` / `join_room`), stocké uniquement dans le localStorage du téléphone, **jamais** dans le dépôt ni dans les logs. Toutes les requêtes passent par la RLS (`my_room()` / `my_player()` lisent l'en-tête).
Sélectionner des colonnes explicites. Les erreurs `invalid_invite`, `unauthorized`, `invalid_date` sont traduites en messages français clairs.

## 3. Règles du jeu

### Types de questions
| kind | Réponse | Prédiction correcte si |
|---|---|---|
| `choice` | une des `options` (2–6) | identique à la réponse de l'autre |
| `scale` | entier 1 à 5 (`options` = null) | identique |
| `text` | texte libre ≤ 500 car. | **l'autre valide** (« Bien vu ✅ / Raté ❌ ») — table `judgments`, `judge` = joueur dont la réponse est la référence |

Comparaison `choice`/`scale` via `normalize()` (trim, casse, accents).

### Tirage quotidien
- Date = date locale **Europe/Paris** (format `YYYY-MM-DD`).
- À l'ouverture de « Aujourd'hui », appeler `ensureRounds(date, candidates)` avec ~20 candidates mélangées de la banque, en excluant les `bank_id` déjà tirés. Le serveur complète jusqu'à `questions_per_day` (défaut 3), **questions perso d'abord** (FIFO), de façon atomique.
- Les rounds non répondus des jours précédents restent jouables (section « En retard »).

### Déroulé d'un round
1. Le joueur saisit **sa réponse** puis **sa prédiction pour l'autre** (2 étapes, un seul envoi). Réponse définitive (pas de modification).
2. Tant que l'autre n'a pas répondu : « En attente de {nom} ». La réponse de l'autre est invisible (garanti côté serveur).
3. Quand les deux ont répondu : révélation côte à côte (ma réponse / ta réponse / ma prédiction / ta prédiction) + points.
4. Question `text` : chaque joueur valide la prédiction de l'autre sur lui ; score « en attente de validation » sinon.

### Questions perso
Écran « Ajouter » : texte, type, options (si `choice`), catégorie. Elles restent **secrètes** pour l'autre jusqu'au tirage. Liste de mes questions en attente.

### Score et bilan (`report.js`, fonctions pures)
- Point d'un joueur sur un round = 1 si sa prédiction est correcte, 0 sinon, `null` si en attente (autre pas répondu ou validation manquante).
- Bilan sur une période [début, fin] : points par joueur, rounds complets, précision %, gagnant / égalité, meilleure catégorie de chacun, **taux de complicité** (% de rounds où les deux réponses perso sont identiques — info, pas un score), série de jours joués, top 3 « surprises » (prédictions ratées), évolution vs période précédente.
- Période par défaut : 7 jours glissants depuis `report_start` (périodes successives de `report_period_days`), bilan qui se clôt le **dimanche soir** en hebdo. Sélecteur : cette période / précédente / personnalisée (dates libres) / depuis le début.
- Bilan **partageable** : bouton « Partager » (Web Share API, repli copier) avec un résumé texte.

## 4. Écrans (UX)

- **Setup** : « Créer une partie » (prénom → affiche code d'invitation + lien `…/#/join/CODE` + bouton partager) ou « Rejoindre » (code + prénom). Le lien pré-remplit le code.
- **Aujourd'hui** (accueil) : cartes des questions du jour avec état (à jouer / en attente / révélée / à valider), score de la période en bandeau, badge des retards.
- **Round** : une question plein écran, gros boutons tactiles (≥ 48 px), progression 1/2 → 2/2.
- **Bilan**, **Historique** (liste filtrable par catégorie, révélations), **Réglages** (prénoms, questions/jour 1–10, période 1–90 j, date de départ, quitter la partie sur cet appareil, mode démo).
- Rafraîchissement : à l'ouverture, au retour au premier plan (`visibilitychange`) et tirer-pour-rafraîchir/bouton. (Realtime Supabase = bonus, non requis.)
- Accessibilité : labels, focus visibles, `prefers-reduced-motion`, contraste AA. Hors-ligne : message clair, assets en cache.
- Performance : Lighthouse mobile ≥ 90 (perf, a11y, best practices), aucune image lourde, JS total < 100 Ko hors supabase-js.

## 5. Banque de questions (`data/questions.json`)

≥ **300 questions** originales en français, tutoiement, bienveillantes, jamais intrusives sur la santé/sexualité/finances. Répartition indicative : `choice` 50 %, `scale` 25 %, `text` 25 %.
Catégories : `gouts`, `souvenirs`, `quotidien`, `reves`, `valeurs`, `couple`, `voyage`, `humour`, `travail`, `et-si`.
Format : `{"id":"q001","text":"…","kind":"choice","options":["…","…"],"category":"gouts"}` — `id` unique et stable (ne jamais renuméroter). Test unitaire de validation du fichier (ids uniques, kinds valides, options cohérentes, longueurs 3–300).

## 6. Tests et qualité

- `npm test` = Vitest (unitaires) ; `npm run e2e` = Playwright mode démo ; `npm run check` = les deux + validation banque.
- Couverture visée ≥ 90 % sur `js/logic/` et `js/api/memory.js`.
- Le **contrat d'API** est testé sur l'adaptateur mémoire : anti-triche, quota, priorité perso, surprises, jugement uniquement sur `text` après 2 réponses, pas de double réponse.
- E2E : 2 contextes = 2 joueurs, créer/rejoindre, répondre aux 3 questions, vérifier révélation + scores + bilan.
- `supabase/schema.sql` est validé ; s'il doit changer : modification **idempotente** + fichier `supabase/migrations/NNN_*.sql` + mention dans le README (Lucas doit l'exécuter à la main). Test SQL local possible : Postgres 16 est dans `/usr/lib/postgresql/16/bin` (voir `tests/sql/README.md` si créé).
- Repli si l'en-tête personnalisé est bloqué par CORS en production : ajouter des RPC `security definer` prenant `p_secret` en paramètre (migration), sans changer l'interface JS.
