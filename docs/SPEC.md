# Duo Quiz — Cahier des charges

Jeu de questions pour **un couple** (elle 25 ans, lui 30 ans), **2 joueurs exactement**, chacun sur son téléphone (**lui : Samsung/Android Chrome**, **elle : iPhone/Safari**). Objectifs : **apprendre des choses sur l'autre** et **mesurer à quel point on se connaît**.

Chaque jour, des questions sont tirées (banque + questions écrites par les joueurs, **indiscernables**). Chacun répond **pour lui** et **devine la réponse de l'autre** → 1 point par bonne prédiction. Bilan hebdomadaire (période réglable) visible sur les 2 téléphones + **rapport de compatibilité amoureuse** (calcul en direct dans l'app + analyse rédigée chaque semaine par l'IA).

Langue : **français**, tutoiement. Installable en PWA sur Android ET iOS.

## 1. Stack (imposée)

- **Front** : HTML + CSS + JavaScript **vanilla, modules ES, sans build**, servi par **GitHub Pages** (`main`, racine). URL : `https://lucasdelpino.github.io/duo-quiz/` → tous les chemins **relatifs** (sous-dossier `/duo-quiz/`).
- **Backend** : **Supabase**. `supabase/schema.sql` puis `supabase/migrations/001_anonymat_et_analyses.sql` — **déjà exécutés en production**, testés. Ne pas modifier sans raison (voir §9).
- Client : `@supabase/supabase-js` v2 via `https://esm.sh/@supabase/supabase-js@2.45.4` (ré-exporté dans `js/vendor.js`).
- Polices : auto-hébergées dans `assets/fonts/` (woff2, via paquets npm `@fontsource/*` copiés par un script `npm run fonts`, fichiers commités). Pas de CDN de polices.
- **Tests** : Vitest (+ jsdom) ; Playwright (mode démo, aucun réseau) avec émulation **Galaxy S** (Chromium) et **iPhone** (viewport/UA iPhone sur Chromium ; WebKit si disponible). Chromium + Playwright préinstallés : ne pas lancer `playwright install`.

## 2. Architecture

```
index.html, manifest.webmanifest, sw.js
assets/            icônes PNG 180/192/512 + maskable, apple-touch-icon.png, polices, sons courts (optionnels, < 30 Ko chacun)
css/app.css        design system (§7)
js/config.js       URL + clé anon Supabase (publiques)
js/vendor.js       supabase-js
js/app.js          routeur hash : #/setup #/join/:code #/today #/round/:id #/add #/report #/love #/history #/settings #/link/:code
js/store.js        session locale (localStorage : room_id, player, secret, noms)
js/api/index.js    'supabase' si config renseignée, 'memory' sinon ; ?demo=1 force 'memory'
js/api/supabase.js adaptateur Supabase (en-tête x-player-secret)
js/api/memory.js   adaptateur mémoire reproduisant EXACTEMENT les règles SQL (anonymat, quota, max perso/jour, anti-triche)
js/logic/          normalize.js, scoring.js, draw.js, report.js, compat.js (fonctions pures)
js/ui/             composants (carte, boutons, confettis, toasts, compteur animé, jauge)
js/views/          un fichier par écran
data/questions.json banque
tests/unit, tests/e2e
```

**Interface commune des adaptateurs** (contrat testé) :
```
createRoom(name) -> {room_id, secret, player, invite_code}
joinRoom(code, name) -> {room_id, secret, player}
getRoom() / updateRoom(patch)            // p1_name, p2_name, questions_per_day, report_period_days, report_start
usedBankIds() -> string[]                // RPC used_bank_ids
ensureRounds(dateISO, candidates) -> Round[]   // Round = {id, room_id, play_date, text, kind, options, category, created_at}
listRounds({from, to}) -> Round[]
listAnswers(roundIds) / submitAnswer(roundId, self, guess)
listJudgments(roundIds) / judge(roundId, correct)
addCustomQuestion({text, kind, options, category}) / listMyPendingCustom()
listAnalyses() -> Analysis[]             // rapports IA (table analyses)
createDeviceLink() -> code / claimDeviceLink(code) -> {room_id, secret, player}
dayProgress(dateISO) -> [{player, answered, total, last_answer_at}]   // RPC day_progress (migration 002) : compteurs seulement
```

Supabase : `createClient(URL, KEY, { global: { headers: { 'x-player-secret': secret } } })`. Le secret vient du serveur, reste dans le localStorage, **jamais** dans le dépôt ni les logs. **Colonnes explicites** dans chaque `select` : `rounds` n'expose plus `source`, `author`, `bank_id` (un `select('*')` échoue). Erreurs `invalid_invite`, `unauthorized`, `invalid_date` → messages français.

## 3. Règles du jeu

| kind | Réponse | Prédiction correcte si |
|---|---|---|
| `choice` | une des `options` (2–6) | identique (via `normalize`) |
| `scale` | entier 1 à 5 (libellés aux extrémités dans la question, ex. « 1 = pas du tout, 5 = énormément ») | identique |
| `text` | texte libre ≤ 500 car. | **l'autre valide** (« Bien vu ✅ / Raté ❌ »), table `judgments` (`judge` = celui dont la réponse sert de référence) |

### Tirage quotidien
- Date locale **Europe/Paris** (`YYYY-MM-DD`), y compris si le téléphone est dans un autre fuseau.
- Ouverture de « Aujourd'hui » : `usedBankIds()` → ~20 candidates mélangées non utilisées (`draw.js`, en variant les catégories) → `ensureRounds`. Le serveur complète jusqu'à `questions_per_day` (défaut 3 ; **0 = Illimité** : 3 questions de base, puis bouton « Encore des questions 🎲 » — RPC `draw_more`, migration 003 — dès que le joueur a répondu à toutes celles du jour, lots de 3, sans limite), avec **au plus max(1, n/2) questions perso par jour**, et renvoie les questions **dans un ordre aléatoire** : l'app les affiche dans l'ordre reçu (tri par `id`), **jamais** par `created_at`.
- Les rounds non répondus des jours précédents restent jouables (« En retard »).

### Anonymat des questions perso (exigence forte)
Rien dans l'interface ne doit permettre de savoir si une question vient de la banque ou de l'autre : même carte, même style, même catégorie affichable, pas de badge, pas d'ordre révélateur, pas de mention dans l'historique ni dans les rapports. Le formulaire « Ajouter » **normalise** le texte (majuscule initiale, espaces, « ? » final) et propose les mêmes catégories que la banque. L'auteur voit seulement la liste de **ses** questions en attente (« 3 questions surprises en réserve »).

### Rythme commun (intégrité du bilan — migration 004)
- Écart = réponses du joueur − réponses de l'autre, toutes questions confondues (RPC `pace()`).
- **Retard > 10** : pop-up « Tu es en retard ! » à l'ouverture (max 1 fois / 30 min), prioritaire sur « Qui a joué ? ».
- **Avance > 10** : bandeau d'information ; **avance ≥ 15** : bloqué (trigger SQL `too_far_ahead` sur `answers` + `draw_more`) jusqu'au rattrapage ; écran de réponse verrouillé.
- Le bilan et le rapport IA ne comptent que les questions jouées par les deux ; le bilan affiche ce qui reste en attente de chaque côté.

### Déroulé d'un round
1. Étape 1/2 « Toi » : ma réponse. Étape 2/2 « Et {nom} ? » : ma prédiction. Envoi unique, définitif.
2. Attente : « {nom} n'a pas encore répondu 🤫 » (réponse de l'autre invisible, garanti côté serveur).
3. Révélation animée (cartes qui se retournent) : ma réponse / sa réponse / ma prédiction / sa prédiction + points (+1 avec confettis, raté avec petite animation drôle).
4. `text` : chacun valide la prédiction de l'autre ; badge « à valider » tant que ce n'est pas fait.

### Score et bilan (`report.js`)
- Point = 1 si prédiction correcte, 0 sinon, `null` si en attente.
- Bilan de période : points par joueur, rounds complets, précision %, gagnant / égalité (titre fun : « {nom} te connaît par cœur 👑 »), meilleure/pire catégorie de chacun, série de jours joués, top 3 « tu ne l'aurais jamais deviné », évolution vs période précédente.
- Période : `report_period_days` jours à partir de `report_start` (défaut 7, clôture dimanche soir ; 1 = bilan quotidien, chaque jour à minuit). Réglage **commun à la partie** : modifiable par l'un ou l'autre dans Réglages, s'applique aux deux téléphones ; l'autre joueur voit un toast « {nom} a changé la période du bilan ». Le rapport IA reste hebdomadaire quel que soit ce réglage. Sélecteur : en cours / précédente / personnalisée / depuis le début.
- **Visible et identique sur les 2 téléphones** (calculé depuis les mêmes données serveur). Bouton « Partager » (Web Share API sur Android et iOS, repli copier).

## 4. Compatibilité amoureuse

### 4.1 Score en direct (`compat.js`, déterministe, fonctions pures testées)
Sur les rounds complets de la période (et global) :
- **Accords** (40 %) : `choice` identiques = 1 ; `scale` = 1 − |a−b|/4 ; `text` exclu.
- **Connaissance mutuelle** (40 %) : moyenne des précisions de prédiction des deux.
- **Équilibre** (20 %) : 1 − |précision A − précision B| (on se connaît autant l'un que l'autre).
- Pondération par **facette** (§5) : `valeurs`, `futur`, `amour` comptent ×2, `fun` ×0,5.
- Résultat 0–100 %, affiché seulement à partir de 5 rounds complets (sinon « encore X questions pour débloquer »). Libellés : < 40 « Des opposés qui s'attirent », 40–60 « Belle complémentarité », 60–80 « Très complices », > 80 « Âmes sœurs ».
- Détail par facette (barres) + **portrait** de chacun généré à partir des réponses : « Ce qu'il/elle aime », « Ce qu'il/elle n'aime pas », « Ses rêves », « Ce qui compte pour lui/elle » (regroupement des réponses perso par facette, sans interprétation inventée).

### 4.2 Rapport IA hebdomadaire (table `analyses`)
Le Love report affiche, sur chaque téléphone, le **portrait de personnalité de l'AUTRE joueur** (`players.N.portrait` : resume, traits, comportement, emotions, en_couple, besoins, points_forts, vigilance, conseil) — bilan psychologique et comportemental ludique, non clinique, rédigé par l'IA à partir de toutes les réponses.
Une seconde Routine Claude lit les réponses chaque dimanche soir (RPC `analyst_export`) et écrit un rapport (RPC `analyst_save`). L'app ne fait que **l'afficher** (lecture `analyses`). Format `content` (JSON) :
```json
{
  "summary": "2-3 phrases",
  "compatibility": 0-100,
  "compatibility_explained": "pourquoi ce score",
  "players": {
    "1": { "aime": ["…"], "naime_pas": ["…"], "ressenti": "ce qu'il/elle semble ressentir en ce moment (prudence, formulé avec douceur)", "a_savoir": ["choses que l'autre ignorait"], "surprises": ["…"] },
    "2": { "...": "même structure" }
  },
  "points_communs": ["…"], "differences": ["…"],
  "a_faire_ensemble": ["idées concrètes tirées des réponses"],
  "questions_a_se_poser": ["pistes de discussion"],
  "evolution": "vs semaines précédentes, ou null"
}
```
Écran **« Love report » (#/love)** : jauge animée du % (rapport IA le plus récent, sinon score direct), sections ci-dessus en cartes, historique des rapports (courbe de compatibilité semaine par semaine), mention discrète « Analyse ludique, pas une vérité scientifique ». Les champs manquants/inattendus ne doivent jamais casser l'affichage (validation défensive).

## 5. Banque de questions (`data/questions.json`)

≥ **1 000 questions** originales (1 270 au 01/11/2026, dont 250 « coquin »), pensées pour un **couple de 25 et 30 ans** : bienveillantes, drôles ou profondes, qui font **apprendre des choses** (goûts, enfance, souvenirs du couple, rêves, peurs légères, façons d'aimer, projets, petits travers, et-si). Pas de questions sur l'argent personnel, la santé ou les ex en détail. Catégorie **« Coquin 🔥 »** (250 questions sur l'intimité, suggestives sans être crues) réservée à ce sujet : le vocabulaire intime est interdit ailleurs (`scripts/bank-rules.mjs`). Dosage par le réglage commun `rooms.spicy` (migration 005) : 0 = désactivées, 1 = de temps en temps (≈ 1/11), 2 = souvent (≈ 1 question sur 3). Questions neutres en genre (« ton/ta partenaire » → utiliser le prénom de l'autre via `{autre}` remplacé à l'affichage).
Répartition : `choice` 50 %, `scale` 25 %, `text` 25 %.
Format : `{"id":"q001","text":"…","kind":"choice","options":["…"],"category":"gouts","facet":"aime"}` — `id` stable.
Catégories (affichées) : `gouts`, `souvenirs`, `quotidien`, `reves`, `valeurs`, `couple`, `voyage`, `humour`, `et-si`, `enfance`.
Facettes (pour l'analyse) : `aime`, `naime_pas`, `ressenti`, `valeurs`, `futur`, `amour`, `souvenir`, `fun`.
Le formulaire perso demande aussi la facette (libellé simple : « Ça parle de… ce qu'on aime / ce qu'on n'aime pas / … »). Test de validation du fichier.

## 6. Écrans
- **Setup** : Créer (prénom → code + lien `#/join/CODE` + Partager) / Rejoindre. Écran « Installer l'app » adapté à l'appareil : Android → bouton `beforeinstallprompt` ; iPhone → tuto illustré « Partager → Sur l'écran d'accueil ».
- **Aujourd'hui** : en haut, toutes les questions qui attendent une action (du jour puis retards) ; dessous, historique tournant des **5 dernières réponses** (la plus récente en premier, trié par l'heure de MA réponse — `js/logic/home.js`). Chaque carte a à droite un rectangle coupé en diagonale par une barre jaune : un triangle par joueur (prénom affiché), vert = prédiction juste, rouge = fausse, gris = en attente / pas répondu.
- **Round** : après avoir répondu, bouton « Question suivante → » (prochaine question à jouer ; en illimité, tire un nouveau lot si besoin).
- **Round**, **Ajouter**, **Bilan**, **Love report**, **Historique** (filtrable par catégorie), **Réglages** (prénoms, questions/jour 1–10 ou Illimité, période 1–90 j, date de départ, sons on/off, quitter sur cet appareil, mode démo).
- **Pop-up « Qui a joué ? » à chaque ouverture de l'app** (et au retour au premier plan, max 1 fois / 30 min) via `dayProgress(aujourd'hui)` : pour chaque joueur, nombre de questions répondues sur le total du jour + « il y a 2 h ». Messages motivants selon l'état, ex. « {autre} a déjà répondu à 2/3 questions 👀 — à toi de jouer ! », « Vous avez tout fini aujourd'hui 🎉 Révélations dispo », « Personne n'a encore joué… lance la partie ! », « Tu as fini, {autre} pas encore 🤫 ». Bouton principal « Jouer » (ou « Voir les révélations »), fermeture par glisser/croix. Version compacte permanente dans le bandeau d'« Aujourd'hui » (2 avatars + mini-barres de progression). Si la RPC est absente (migration non exécutée) : ne rien afficher, pas d'erreur.
- Navigation par barre d'onglets en bas (Aujourd'hui · Ajouter · Bilan · Love · Plus).
- Rafraîchissement à l'ouverture, au retour au premier plan (`visibilitychange`), bouton/tirer-pour-rafraîchir.

## 7. Design — « jeu télé de couple »
- Ambiance **ludique et chaleureuse** façon quiz show : fond dégradé profond (nuit violette → magenta), cartes « plateau de jeu » arrondies, accents corail, jaune or (points), turquoise. Mode sombre par défaut.
- Typo ronde et grasse pour les titres (ex. Fredoka / Baloo 2), lisible pour le texte (ex. Nunito).
- Micro-interactions : carte qui se retourne à la révélation, confettis (canvas maison < 3 Ko) sur bonne réponse, compteur de points animé, jauge de compatibilité qui se remplit, petits emojis réactions, vibration courte sur Android (`navigator.vibrate`, ignoré sur iOS), sons optionnels (désactivés par défaut).
- Gros boutons tactiles (≥ 48 px), une question plein écran, transitions douces ; `prefers-reduced-motion` respecté (animations coupées).
- Accessibilité AA, focus visibles, labels.

## 8. iPhone + Samsung (exigences)
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`, `theme-color`, `apple-touch-icon` **PNG 180×180** (iOS ignore le SVG).
- Marges `env(safe-area-inset-*)` (encoche, barre home), hauteur `100dvh`, pas de `100vh` seul.
- Champs : `font-size ≥ 16px` (évite le zoom auto iOS), clavier adapté (`inputmode`, `enterkeyhint`).
- Le localStorage d'une PWA iOS installée est **séparé** de Safari : l'écran Setup doit permettre de rejoindre à nouveau via le lien/code depuis l'app installée (le code d'invitation de P1 reste consultable dans Réglages tant que P2 n'a pas rejoint ; pour changer d'appareil : Réglages → « Connecter un autre appareil » appelle la RPC `create_device_link()` (code 8 caractères, 15 min, affiché en grand + lien `#/link/CODE`) ; le nouvel appareil appelle `claim_device_link(code)` et reçoit un nouveau secret (l'ancien appareil est déconnecté — le dire clairement). Erreur `invalid_link` → message français).
- Pas de dépendance à des API absentes de Safari (pas de `beforeinstallprompt` sur iOS, Web Share OK, Vibration absente).
- Tests e2e lancés en émulation Galaxy S et iPhone.

## 9. Tests, qualité, évolutions SQL
- `npm test` (Vitest), `npm run e2e` (Playwright démo), `npm run check` = tout + validation banque. Couverture ≥ 90 % sur `js/logic/` et `js/api/memory.js`.
- Contrat testé sur l'adaptateur mémoire : anonymat (aucun champ source/author exposé), max perso/jour, ordre aléatoire, anti-triche, jugement uniquement `text` après 2 réponses, pas de double réponse.
- E2E : 2 contextes (Galaxy + iPhone) = 2 joueurs : créer/rejoindre, ajouter une question perso, jouer, vérifier révélation, scores, bilan identique, Love report (avec un rapport IA factice injecté en démo).
- Évolution SQL : nouvelle migration **idempotente** `supabase/migrations/NNN_*.sql` testée sur Postgres local (`/usr/lib/postgresql/16/bin`, rôles `anon`/`authenticated` + schéma `extensions` à créer), et section « À exécuter par Lucas » dans le README. L'app doit rester fonctionnelle tant que la migration n'est pas exécutée (dégradation propre).
- Repli si l'en-tête `x-player-secret` est bloqué par CORS en production : RPC `security definer` prenant `p_secret`, sans changer l'interface JS.
- Lighthouse mobile ≥ 90, JS applicatif < 120 Ko hors supabase-js.
