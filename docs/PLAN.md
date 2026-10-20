# PLAN — Application Budget

Application Android personnelle de suivi de budget, en dinars (DA), utilisable hors ligne et synchronisée avec Supabase.

Ordre de travail : **1. squelette → 2. toutes les pages (UI seule, données factices) → 3+. intégration de la logique.**

---

## 1. Spec de référence

### Périmètre v1

- Connexion Google (Supabase Auth). La première connexion nécessite Internet ; la session reste valide hors ligne.
- Écran d'accueil centré sur un mois, avec navigation libre entre les mois (passés et futurs).
- Totaux du mois : Entrées et Dépenses (affichage seul, non cliquable).
- Graphique des dépenses par catégorie (affichage seul, non cliquable).
- Liste « Détail » : entrées + dépenses du mois, de la plus récente à la plus ancienne.
- Ajout / modification (appui) / suppression (glissement) d'entrées et de dépenses.
- Saisie en EUR possible : taux saisi manuellement (prérempli avec le dernier utilisé), stockage en DA.
- 9 catégories de dépenses (nom, couleur, icône), limite fixe de 9.
- Synchronisation en arrière-plan avec file d'attente hors ligne, état visible sur la page Compte.
- Export / import d'une sauvegarde JSON complète.
- Paiements réguliers (loyer, abonnements…) : à l'échéance, un encart rouge s'affiche sur l'accueil et y reste jusqu'au clic sur « J'ai payé » (avec modale de confirmation), ce qui enregistre la dépense.
- Suivi des erreurs avec Sentry.
- Gestion des dettes, indépendante du budget : ce que je dois / ce qu'on me doit, personne (noms mémorisés et proposés en autocomplétion), montant en DA ou EUR (taux du jour si EUR), date, note, remboursements partiels.
- Menu de navigation : icône burger en haut à gauche de la barre haute, ouvrant un tiroir qui glisse depuis la gauche avec 4 entrées : **Budget** (accueil / diagramme), **Paiements réguliers**, **Dettes**, **Mon compte**.

### Hors périmètre v1

iOS · multilingue / i18n (textes en français écrits en dur) · thème sombre · images (pas d'ImageKit) · trigger.dev · multi-appareils · Play Store · catégories pour les entrées.

### Écrans

| Écran                | Route                                                                    | Contenu                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connexion            | `/(auth)/login`                                                          | Logo, bouton « Continuer avec Google »                                                                                                                                                                                                                                                                                                                                              |
| Accueil              | `/(app)/index`                                                           | Barre haute (icône burger à gauche, logo centré, icône export), sélecteur de mois ‹ Mois Année ›, cartes Entrées / Dépenses, graphique par catégorie, section « Détail », 2 boutons flottants « Ajouter entrée » / « Ajouter dépense »                                                                                                                                              |
| Transaction          | `/(app)/transaction/new?type=income\|expense`, `/(app)/transaction/[id]` | Montant + devise (DA / EUR), taux si EUR, date (aujourd'hui par défaut), catégorie (dépense seulement), note facultative, bouton Enregistrer (+ Supprimer en modification)                                                                                                                                                                                                          |
| Compte               | `/(app)/account`                                                         | Profil Google, état de synchro (en attente / en cours % / à jour / erreur, dernière synchro, nb d'éléments en attente, bouton « Synchroniser »), lien Catégories, Exporter / Importer JSON, Déconnexion                                                                                                                                                                             |
| Catégories           | `/(app)/categories`                                                      | Liste des 9 catégories (icône, couleur, nom)                                                                                                                                                                                                                                                                                                                                        |
| Éditeur de catégorie | `/(app)/categories/[id]`                                                 | Nom, palette de couleurs (arc-en-ciel), grille d'icônes Material Community Icons (blanches sur fond de couleur)                                                                                                                                                                                                                                                                     |
| Paiements réguliers  | `/(app)/recurring`                                                       | Liste des paiements réguliers (nom, montant, catégorie, prochaine échéance), bouton flottant « + » ; écran principal du menu burger                                                                                                                                                                                                                                                 |
| Éditeur de paiement  | `/(app)/recurring/new`, `/(app)/recurring/[id]`                          | Nom, montant en DA, catégorie, fréquence (mensuel / annuel), jour du mois (1–31) + mois si annuel, date de début, actif oui/non, note ; bouton Enregistrer (+ Supprimer en modification)                                                                                                                                                                                            |
| Dettes               | `/(app)/debts`                                                           | Onglets « Je dois » / « On me doit », total restant dû par onglet, liste des dettes (personne, montant, reste dû, date, badge « soldée »), bouton « Ajouter »                                                                                                                                                                                                                       |
| Éditeur de dette     | `/(app)/debts/new`, `/(app)/debts/[id]`                                  | Sens fixé par l'onglet d'origine (non modifiable), personne (champ avec autocomplétion des noms enregistrés), montant + devise (DA / EUR), taux du jour si EUR, date, note ; en modification : liste des remboursements (appui → modifier / supprimer) + « Ajouter un remboursement » (feuille `/(app)/repayment/new?debtId=` : montant, devise/taux, date, note), bouton Supprimer |

**Menu burger** : icône en haut à gauche de la barre haute ; ouvre un tiroir qui glisse depuis la gauche avec Budget (`/(app)/index`), Paiements réguliers (`/(app)/recurring`), Dettes (`/(app)/debts`) et Mon compte (`/(app)/account`).

**Encart « paiement dû » (Accueil)** : en haut de l'accueil, un encart rouge par échéance arrivée et non payée (nom, montant, date d'échéance, « en retard de N jours » si dépassée), affiché à partir du jour J et **jusqu'au clic sur « J'ai payé »**, quel que soit le mois consulté. Le clic ouvre une modale de confirmation (« Confirmer le paiement de Loyer — 25 000 DA ? », date de paiement modifiable, aujourd'hui par défaut) ; la confirmation crée la dépense correspondante et fait disparaître l'encart.

### Modèle de données

**`categories`**

| Champ                   | Type             | Règles                                                    |
| ----------------------- | ---------------- | --------------------------------------------------------- |
| id                      | uuid             | clé primaire, généré sur le client                        |
| user_id                 | uuid             | = `auth.uid()`                                            |
| name                    | text             | requis, non vide                                          |
| color                   | text             | hex `#RRGGBB`, nuancier arc-en-ciel (`categoryColors`)    |
| icon                    | text             | nom Material Community Icons, dans la sélection autorisée |
| position                | int              | 1–9, unique par utilisateur                               |
| created_at / updated_at | timestamptz      |                                                           |
| deleted_at              | timestamptz null | suppression logique (interdite si catégorie utilisée)     |

Catégories par défaut : Voiture, Factures, Maison, Hanout, Khaddar, Boucherie, Neyla, Assya, Loisirs — créées une seule fois par Supabase à la création du compte (trigger sur `auth.users`), puis récupérées dans SQLite à chaque connexion Google.

**`transactions`**

| Champ                   | Type             | Règles                                            |
| ----------------------- | ---------------- | ------------------------------------------------- |
| id                      | uuid             | clé primaire, généré sur le client                |
| user_id                 | uuid             | = `auth.uid()`                                    |
| type                    | text             | `income` \| `expense`                             |
| amount_da               | int              | > 0, montant final en dinars entiers              |
| currency                | text             | `DZD` \| `EUR`                                    |
| original_amount_cents   | int null         | montant EUR saisi (centimes), si `currency = EUR` |
| eur_rate                | numeric null     | taux DA/EUR appliqué, si `currency = EUR`         |
| category_id             | uuid null        | requis si `expense`, null si `income`             |
| note                    | text null        | facultative                                       |
| date                    | date             | `YYYY-MM-DD`                                      |
| created_at / updated_at | timestamptz      |                                                   |
| deleted_at              | timestamptz null | suppression logique                               |

`amount_da = round(original_amount_cents / 100 × eur_rate)`.

**`recurring_payments`**

| Champ                   | Type             | Règles                                                                      |
| ----------------------- | ---------------- | --------------------------------------------------------------------------- |
| id                      | uuid             | clé primaire, généré sur le client                                          |
| user_id                 | uuid             | = `auth.uid()`                                                              |
| name                    | text             | requis, non vide                                                            |
| amount_da               | int              | > 0                                                                         |
| category_id             | uuid             | requis                                                                      |
| frequency               | text             | `monthly` \| `yearly`                                                       |
| day_of_month            | int              | 1–31 ; si le mois est plus court, échéance au dernier jour du mois          |
| month                   | int null         | 1–12, requis si `yearly`, null si `monthly` (29/02 → 28/02 hors bissextile) |
| start_date              | date             | première échéance possible                                                  |
| active                  | bool             | inactif = plus d'encart                                                     |
| note                    | text null        | facultative                                                                 |
| created_at / updated_at | timestamptz      |                                                                             |
| deleted_at              | timestamptz null | suppression logique                                                         |

**`recurring_occurrences`** (une ligne par échéance payée)

| Champ                   | Type        | Règles                                |
| ----------------------- | ----------- | ------------------------------------- |
| id                      | uuid        | clé primaire                          |
| user_id                 | uuid        | = `auth.uid()`                        |
| recurring_payment_id    | uuid        |                                       |
| due_date                | date        | unique avec `recurring_payment_id`    |
| paid_at                 | date        | date de paiement confirmée            |
| transaction_id          | uuid        | dépense créée lors de la confirmation |
| created_at / updated_at | timestamptz |                                       |

Échéances dues = toutes les dates d'échéance calculées entre `start_date` et aujourd'hui, sans ligne dans `recurring_occurrences` (calcul côté client, rien n'est pré-généré).

**`debt_people`** (noms enregistrés pour l'autocomplétion)

| Champ                   | Type             | Règles                                                           |
| ----------------------- | ---------------- | ---------------------------------------------------------------- |
| id                      | uuid             | clé primaire, généré sur le client                               |
| user_id                 | uuid             | = `auth.uid()`                                                   |
| name                    | text             | requis, non vide, unique par utilisateur (insensible à la casse) |
| created_at / updated_at | timestamptz      |                                                                  |
| deleted_at              | timestamptz null | suppression logique                                              |

Un nom saisi qui n'existe pas encore est créé automatiquement à l'enregistrement de la dette.

**`debts`**

| Champ                   | Type             | Règles                                            |
| ----------------------- | ---------------- | ------------------------------------------------- |
| id                      | uuid             | clé primaire, généré sur le client                |
| user_id                 | uuid             | = `auth.uid()`                                    |
| direction               | text             | `i_owe` (je dois) \| `owed_to_me` (on me doit)    |
| person_id               | uuid             | → `debt_people`, requis                           |
| amount_da               | int              | > 0, montant final en dinars entiers              |
| currency                | text             | `DZD` \| `EUR`                                    |
| original_amount_cents   | int null         | montant EUR saisi (centimes), si `currency = EUR` |
| eur_rate                | numeric null     | taux DA/EUR du jour saisi, si `currency = EUR`    |
| date                    | date             | date de la dette                                  |
| note                    | text null        | facultative                                       |
| created_at / updated_at | timestamptz      |                                                   |
| deleted_at              | timestamptz null | suppression logique                               |

**`debt_repayments`** (remboursements partiels)

| Champ                                       | Type             | Règles                             |
| ------------------------------------------- | ---------------- | ---------------------------------- |
| id                                          | uuid             | clé primaire, généré sur le client |
| user_id                                     | uuid             | = `auth.uid()`                     |
| debt_id                                     | uuid             | → `debts`                          |
| amount_da                                   | int              | > 0, ≤ reste dû                    |
| currency / original_amount_cents / eur_rate |                  | mêmes règles que `debts`           |
| date                                        | date             | aujourd'hui par défaut             |
| note                                        | text null        | facultative                        |
| created_at / updated_at                     | timestamptz      |                                    |
| deleted_at                                  | timestamptz null | suppression logique                |

Reste dû = `debts.amount_da − Σ debt_repayments.amount_da`. Reste = 0 → dette « soldée ». **Aucun lien avec le budget** : ni les dettes ni les remboursements ne créent de transaction.

**Tables locales uniquement (SQLite)**

- `sync_queue` : id, table_name, row_id, op (`upsert`), payload JSON, attempts, last_error, rejected_at (entrée refusée définitivement, mise de côté), created_at.
- `settings` : clé/valeur — `last_eur_rate`, `last_pulled_at`, `last_synced_at`.

**Supabase** : RLS activé sur toutes les tables synchronisées (`categories`, `transactions`, `recurring_payments`, `recurring_occurrences`, `debt_people`, `debts`, `debt_repayments`), politique `user_id = auth.uid()` pour select/insert/update.

### Stack

| Rôle                    | Choix                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Framework               | Expo **SDK 57** (React Native 0.86, React 19.2), TypeScript, Expo Router                                                           |
| Base locale             | `expo-sqlite` + Drizzle ORM (source de vérité de l'UI)                                                                             |
| Backend                 | Supabase (Postgres + Auth) via `@supabase/supabase-js`                                                                             |
| Auth Google             | `@react-native-google-signin/google-signin` 16.1.5 (version gratuite, API Original) → ID token → `supabase.auth.signInWithIdToken` |
| Session auth            | `expo-secure-store` (clé AES) + session chiffrée (`expo-crypto` AES-GCM) dans un kv-store `expo-sqlite`                            |
| Réseau                  | `@react-native-community/netinfo`                                                                                                  |
| Synchro en arrière-plan | `expo-background-task` (+ synchro au premier plan au retour du réseau)                                                             |
| Graphique               | `react-native-svg` (anneau dessiné à la main)                                                                                      |
| Icônes                  | `@expo/vector-icons` (MaterialCommunityIcons)                                                                                      |
| Export / import         | `expo-file-system`, `expo-sharing`, `expo-document-picker`                                                                         |
| Monitoring              | `@sentry/react-native`                                                                                                             |
| Tests                   | Jest (`jest-expo`)                                                                                                                 |
| Build                   | `npx expo run:android` (dev), EAS Build → APK, EAS Update                                                                          |

---

## Phase 1 — Squelette du projet

- [x] `npx create-expo-app@latest` (SDK 57, template TypeScript avec Expo Router), puis `git init`.
- [x] Configurer `app.json` : nom, slug, `android.package`, orientation portrait, `userInterfaceStyle: "light"`, icône et splash.
- [x] Structure des dossiers :
  ```
  src/app/
    _layout.tsx
    (auth)/_layout.tsx
    (auth)/login.tsx
    (app)/_layout.tsx
    (app)/index.tsx
    (app)/transaction/new.tsx
    (app)/transaction/[id].tsx
    (app)/account.tsx
    (app)/categories/index.tsx
    (app)/categories/[id].tsx
    (app)/recurring/index.tsx
    (app)/recurring/new.tsx
    (app)/recurring/[id].tsx
  src/
    design-system/ # tokens, thème, primitives, composants UI génériques
    features/     # composants et écrans métier, par fonctionnalité
    mocks/        # données factices (phase 2)
    db/           # schéma Drizzle, client, migrations (phase 5)
    repositories/ # accès données (phase 5)
    sync/         # file d'attente + moteur de synchro (phase 5)
    lib/          # montants, dates, conversion EUR
    types/
  ```
- [x] ESLint + Prettier, alias d'import `@/`.
- [x] Mettre en place le thème (tokens Stitch) et la police.

**Terminé quand** : toutes les routes existent (écrans vides « À venir »).

## Phase 2 — Toutes les pages, UI seule

Toutes les pages sont alimentées par `assets/maquettes/` (catégories par défaut + ~20 transactions sur 2–3 mois). Aucune base, aucun réseau.

- [x] Composants partagés : `AppHeader`, `MonthSelector`, `TotalCard`, `CategoryChart`, `TransactionRow` (avec glissement), `FabGroup`, `AmountInput`, `CurrencyToggle` (intégré à `AmountInput`), `DateField`, `CategoryPicker` (`CategoryGrid`), `ColorPicker`, `IconPicker`, `SyncStatusCard`, `EmptyState`, `ConfirmDialog`, `DuePaymentBanner` (encart rouge + bouton « J'ai payé »), `DayOfMonthPicker`, `Fab`, `SegmentedControl`, `Switch`, `Avatar`, `FormSectionList`, `EurRateField`.
- [x] Formatage (`src/lib/format.ts` fait pour l'accueil) : montants `12 500 DA` (séparateur d'espace), mois en français (« Octobre 2026 »), dates de la liste.
- [x] **Connexion** : logo + bouton Google officiel (session factice : l'appui mène à l'accueil).
- [x] **Accueil** : barre haute (logo + export, pas d'avatar), mois ‹ ›, cartes Entrées / Dépenses, graphique identique au design, section « Détail », boutons flottants, état vide pour un mois sans transaction, glissement ← → pour changer de mois (en-tête et sélecteur fixes, carrousel : mois voisins visibles pendant le glissement).
- [x] **Transaction** : feuille aux 2/3 (`Sheet`, fermeture par la croix ou le fond grisé, pas au glissement) (maquette `./assets/maquettes/transaction/code.html`), formulaire entrée / dépense, appui sur « DA » → « € » puis champ « Taux du jour » et aperçu indicatif en DA, date (sélecteur natif), catégorie en grille 3×3 (dépense), note ; bouton noir ; mode modification (appui sur une ligne) avec Supprimer.
- [x] **Menu burger** : icône en haut à gauche de la barre haute, tiroir glissant depuis la gauche (`Drawer` maison, pas d'ouverture au glissement), entrées Budget / Paiements réguliers / Dettes / Mon compte. Même barre haute (burger, logo, export) sur les 4 écrans principaux ; le menu remplace l'écran courant, le retour Android ramène à l'accueil.
- [x] **Compte** : même barre haute que l'accueil, profil (initiales, pas de photo), carte d'état de synchro (4 états factices parcourus en touchant la carte), Catégories, Exporter, Importer (modale de confirmation), Déconnexion (modale avec avertissement s'il reste des éléments non synchronisés).
- [x] **Catégories** + **Éditeur** : liste des 9, nom, couleur, icône. Éditeur en écran plein (`ScreenHeader`), aperçu en direct, nom (20 caractères max), nuancier des 9 `categoryColors`, grille de 42 icônes autorisées (`allowedCategoryIcons`). Pas d'ajout, de suppression ni de réorganisation en v1.
- [x] **Paiements réguliers** + **Éditeur** : liste virtualisée (prochaine échéance factice, inactifs grisés), bouton flottant « + » sur cette page uniquement ; éditeur en écran plein (`ScreenHeader`) : nom (30 caractères max), montant DA, catégorie, fréquence (`SegmentedControl`), mois (grille 4×3) si annuel, jour (grille 7 colonnes), date de début, actif (`Switch`), note, suppression confirmée par `ConfirmDialog` ; encarts rouges factices sur l'accueil **sous le graphique et sa légende** (un dû aujourd'hui, un en retard), modale de confirmation « J'ai payé » avec date de paiement.
- [x] **Dettes** + **Éditeur de dette** : onglets je dois / on me doit (`SegmentedControl`, « On me doit » par défaut), total restant dû, liste virtualisée (`SectionList`) avec barre de progression jaune (`accent`), dettes soldées dans une partie repliable « Dettes soldées » (repliée par défaut, cartes grisées), bouton flottant « + » qui fixe le sens (pas de choix du sens dans l'éditeur) ; éditeur en écran plein (`FormSectionList` : formulaire en en-tête, remboursements virtualisés), autocomplétion des personnes (dès 1 caractère, 5 suggestions max, insensible aux accents), devise DA/EUR + taux, montant ≥ déjà remboursé ; remboursement dans une feuille aux 2/3 (`/(app)/repayment/new?debtId=`, `/(app)/repayment/[id]`) avec rappel du reste dû et bouton « Tout », appui sur un remboursement → modifier / supprimer (données factices).
- [x] Validation visuelle écran par écran contre le design Stitch.

**Terminé quand** : chaque écran correspond au design avec des données factices, et tous les parcours se cliquent de bout en bout.

## Phase 3 — Supabase (backend)

- [x] Migration SQL (`supabase/migrations/`, CLI Supabase en devDependency) : tables `categories`, `transactions`, `recurring_payments`, `recurring_occurrences`, `debt_people`, `debts`, `debt_repayments` (mêmes colonnes et CHECK que SQLite, pas de clés étrangères entre tables, `updated_at` géré par le client), index sur `(user_id, updated_at)`.
- [x] RLS + politiques `user_id = auth.uid()` (select / insert / update ; pas de delete, suppression logique).
- [x] Variables d'environnement `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clé `sb_publishable_…`) : `.env` ignoré par Git, `.env.example` versionné, lecture et validation dans `src/lib/env.ts` (erreur explicite si manquante).
- [x] Client Supabase avec stockage de session persistant (session lisible hors ligne) : `src/lib/supabase.ts` (versions figées, `detectSessionInUrl: false`), session chiffrée AES-GCM (`expo-crypto`) dans un kv-store SQLite dédié avec la clé dans `expo-secure-store` (`src/lib/secureSessionStorage.ts`), rafraîchissement du token au premier plan uniquement (`SupabaseAutoRefresh`).

## Phase 4 — Authentification Google

- [x] Vérifier la librairie de connexion Google native recommandée à date (Credential Manager vs `@react-native-google-signin`) et sa compatibilité SDK 57 → `@react-native-google-signin/google-signin` 16.1.5, version gratuite (compatible Expo 52 à 57), version figée.
- [x] Google Cloud : écran de consentement (Externe, mode Test, scopes `openid` / `email` / `profile`), client OAuth Android (`com.mrebi.budget`, SHA-1 du keystore debug Expo `android/app/debug.keystore`) et client Web ; provider Google activé dans le dashboard Supabase (client Web, nonce vérifié). `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` dans `.env`, validé par `src/lib/env.ts`. Client Android EAS reporté en phase 9.
- [x] Connexion → ID token → `signInWithIdToken` (`src/features/auth/googleSignIn.ts`, sans plugin Expo : Android seul) ; erreurs affichées sous le bouton, annulation silencieuse.
- [x] Garde de route basée sur le **compte local persistant** (`docs/STORAGE.md` §4) : pas de compte local → `/login` ; compte local présent → accueil, même hors ligne, token expiré ou session invalidée côté serveur (état « reconnexion requise » exposé pour la phase 5). Seule la déconnexion manuelle ramène à `/login`.
- [x] Rattacher `user_id` aux données locales (`userId` = `auth.uid()`, hook `useUserId()`, transmis à tous les repositories) : les 9 catégories par défaut (ids aléatoires) sont créées par un trigger Supabase à la création du compte (migration `create_default_categories`, comptes existants rattrapés) ; à chaque connexion Google, `src/sync/pullCategories.ts` les récupère dans SQLite (la version la plus récente gagne) avant d'entrer dans l'app, un échec annule la connexion avec une erreur sous le bouton. Pas de seed local ni de clé `seeded`.
- [x] Déconnexion manuelle selon `docs/STORAGE.md` §4, sans synchro préalable (reportée en phase 5) : `signOut` Supabase local (aucun appel réseau hors ligne, NetInfo) + `GoogleSignin.signOut()` (sélecteur de compte à la reconnexion), suppression du compte local ; avertissement avec le vrai nombre d'éléments en attente dans `sync_queue` ; aucune donnée locale ni `sync_queue` supprimée. Page Compte : profil du compte connecté, plus de données factices de synchro (carte masquée jusqu'au moteur de synchro).

**Terminé quand** : la connexion Google ouvre une vraie session Supabase, persistante hors ligne, et le `user_id` du compte connecté est disponible dans toute l'app.

## Phase 5 — Socle de données et synchronisation

> Le moteur de synchro est construit avant les fonctionnalités : chaque repository est écrit une seule fois avec sa file d'attente, et chaque fonctionnalité livrée est aussitôt sauvegardée dans Supabase. Validation de bout en bout sur les catégories. Toutes les données sont rattachées au `user_id` du compte connecté : aucun identifiant factice.

- [x] Schéma Drizzle complet (`categories`, `transactions`, `recurring_payments`, `recurring_occurrences`, `debt_people`, `debts`, `debt_repayments`, `sync_queue`, `settings` par utilisateur) avec contraintes CHECK et index, migration initiale (`npm run db:generate`), migrations au démarrage (`DatabaseProvider`, splash maintenu, écran d'erreur « Réessayer »), Drizzle Studio en dev. Pas de clés étrangères SQL (ordre d'insertion libre pour le pull et l'import).
- [x] Toast global partagé (`docs/STORAGE.md` §5) : message affiché exactement 3 s, pas de doublon pour une même erreur. Store sans React `src/lib/toast.ts` (`showToast`, un toast à la fois, file d'attente, doublon ignoré tant que la même clé est affichée ou en attente), `reportError` (`src/lib/errors.ts` : journal technique + toast), composant `Toast` du design system, `ToastHost` monté à la racine (en bas, au-dessus des boutons flottants et du clavier). Jest (`jest-expo`, `npm test`) mis en place avec les tests du store.
- [x] Outil d'écriture commun (`src/repositories/write.ts`) : écriture de la ligne + ajout dans `sync_queue` dans une même transaction SQLite (`user_id`, `updated_at` client, uuid client à la création, suppression logique `deleted_at`). `insertRow` / `updateRow` (patch partiel, ligne supprimée ou d'un autre compte → `RowNotFoundError`) / `softDeleteRow` (sauf `recurring_occurrences`), `writeTransaction` pour les opérations composées ; transactions synchrones (pilote expo-sqlite, callback `async` refusé). Payload = copie complète de la ligne relue en camelCase (conversion snake_case au push), une entrée de file par écriture (pas de fusion), `updated_at` strictement croissant même si l'horloge recule. Tests Jest sur SQLite en mémoire (`better-sqlite3` + vraies migrations, `src/test/testDatabase.ts`).
- [x] Correspondance générique des colonnes SQLite (camelCase) ↔ Supabase (snake_case) par table synchronisée, horodatages normalisés en ISO : `src/sync/columns.ts`, déduite du schéma Drizzle (`getTableColumns`, aucune liste manuelle) — `remoteSelect`, `toRemote` (clé inconnue refusée, payload partiel toléré), `toLocal` (colonne manquante ou horodatage invalide refusés, microsecondes Postgres tronquées à la milliseconde) ; `pullCategories` l'utilise.
- [x] **Pull** générique (`src/sync/pull.ts`, remplace `pullCategories`) : pour les 7 tables, lignes `updated_at >= last_pulled_at`, pagination par curseur `(updated_at, id)` par pages de 1000 ; repère = plus grand `updated_at` reçu (format Postgres, jamais l'horloge du téléphone), enregistré seulement si toutes les tables réussissent. Enregistrement local (`src/repositories/remoteRows.ts`, sans `sync_queue`) : une ligne n'est remplacée que si la version distante est plus récente **et** qu'aucune modification locale n'attend dans `sync_queue`. Réglages par compte `src/repositories/settings.ts`, vérification de session `src/sync/session.ts`. **Pull initial** (`src/sync/initialPull.ts`) : lancé à chaque connexion Google sans bloquer l'écran de connexion, et au démarrage tant que le compte n'a jamais été récupéré ; pendant le pull, skeletons (`Skeleton` du design system) à la place des parties variables de l'accueil, des catégories, des paiements réguliers et des dettes, actions dépendantes des données bloquées (garde dans les handlers) ; échec (ou aucune catégorie) → bloc d'erreur « Réessayer » à la place des skeletons, on reste dans l'app.
- [x] **Push** (`src/sync/push.ts`) : file vidée dans l'ordre d'écriture (`rowid`) par lots de 200, regroupés par table, une ligne écrite plusieurs fois envoyée une seule fois (dernière version) ; `upsert` par id (relançable sans doublon) ; trigger Supabase `skip_stale_update` (migration `skip_stale_updates`) : une version qui n'est pas plus récente que celle en base est ignorée ; entrée retirée de la file uniquement après succès ; au premier échec, `attempts` + 1 et `last_error` sur les entrées non envoyées, arrêt (ordre préservé). `syncNow` (`src/sync/syncNow.ts`) = push puis pull, verrou minimal (une synchro à la fois par compte), hors ligne sans requête. Déclencheurs : bouton « Synchroniser » de la carte Compte, déconnexion (push seul), reconnexion (après le pull initial, file envoyée en arrière-plan, toast si échec).
- [x] Erreurs : nouvelles tentatives côté client (exception à trigger.dev : les données n'existent que sur le téléphone) avec délais croissants 10 s, 30 s, 1 min, 5 min puis toutes les 15 min, app ouverte seulement ; pas de relance hors ligne (retour du réseau) ni si la session est refusée (reconnexion requise) ; compteur remis à zéro après un succès ou un appel explicite ; relance annulée à la déconnexion / au changement de compte ; heure du prochain essai sur la carte. Erreurs classées : refus de la ligne (`22xxx`, `23xxx`, `42501`) ou passagère (le reste). Refus d'un envoi groupé → renvoi ligne par ligne, la ligne refusée seule est mise de côté dès le premier refus confirmé (`sync_queue.rejected_at`, migration locale), ignorée par le push sans bloquer la file, toujours comptée comme non synchronisée ; retirée si une version plus récente de la même ligne passe ; toast + état « Erreur » sur la carte, « Réessayer » la remet dans la file. Rien n'est supprimé automatiquement.
- [x] Store d'état de synchro (en attente / en cours % = éléments envoyés / total / à jour / erreur, dernière synchro, nb en attente) relié à la carte Compte (réaffichée), bouton « Synchroniser » : état de la synchro en mémoire (`syncNow`), nombre en attente et `last_synced_at` (`settings`) en requêtes SQLite en direct (`useSyncStatus`) ; bouton toujours visible (il récupère aussi les changements), « Réessayer » en erreur ; erreur affichée si la dernière tentative a échoué, gardée en mémoire seulement ; skeletons pendant le pull initial.
- [x] Déclencheurs (`src/sync/autoSync.ts`, démarrés par `(app)/_layout`, arrêtés à la déconnexion) : démarrage de l'app, retour du réseau (NetInfo, passage hors ligne → en ligne), retour au premier plan (AppState, arrière-plan → actif, pas si la dernière synchro s'est terminée il y a moins d'1 min), après chaque écriture (signal `src/repositories/localWrites.ts` émis par `writeTransaction` après validation, écritures regroupées sur 2 s). `requestSync` : silencieux hors ligne (aucune requête, carte « en attente »), démarrage et retour du réseau synchronisent tout de suite et remettent le compteur de relances à zéro, premier plan et écriture laissent faire la relance programmée ; écriture pendant une synchro → une seconde synchro à la fin si elle réussit. Rien tant que le pull initial n'a pas réussi ; en échec, il est relancé au retour du réseau et au premier plan (si en ligne).
- [x] État « Reconnexion requise » (session invalidée côté serveur) sur la carte Compte, avec bouton « Se reconnecter avec Google » : reconnexion acceptée uniquement pour le même `user_id`, puis reprise de la file sans perte. État `reauth` de la carte (badge « Reconnexion ») si `needsReauth` (`AuthProvider`) ou si la dernière synchro a été refusée faute de session (`sessionRefused`, `src/sync/syncNow.ts`) ; déclencheurs automatiques en pause jusqu'à la reconnexion. `reauthenticate()` : sélecteur Google natif, email Google comparé à celui du compte local **avant** `signInWithIdToken` (un autre compte créerait un nouveau compte Supabase), `user_id` vérifié ensuite (session écartée sinon), erreur affichée dans la carte, puis `syncNow`. Toast une fois par lancement (`ReauthNotifier`). Rafraîchissement du token impossible faute de réseau = erreur passagère (relancée), plus une erreur de session.
- [x] Pull initial bloqué par une session refusée (app fermée entre la connexion et la fin du pull, puis session perdue) : le bloc d'erreur propose « Se reconnecter avec Google » à la place de « Réessayer ». Statut `reauth` du pull initial (échec par `SessionError`), sans relance automatique (réseau, premier plan) ; `InitialPullError` autonome (titre « Reconnexion requise », email du compte, erreur « mauvais compte » au-dessus du bouton) ; reconnexion partagée (`src/features/sync/useReconnect.ts`, même compte uniquement) puis `resumeAfterReconnect` : pull initial s'il n'a pas abouti (puis envoi de la file), sinon `syncNow`. Carte Compte en état « Reconnexion requise » (au lieu du skeleton) et toast `ReauthNotifier` dans ce cas aussi ; un pull qui échoue ensuite (réseau) revient au bloc « Réessayer ».
- [ ] Catégories sur données réelles : écrans Catégories et éditeur lus depuis SQLite (`useLiveQuery`), mise à jour via l'outil d'écriture commun, synchronisée vers Supabase.
- [x] Déconnexion : envoi de la file tenté avant si elle n'est pas vide et si en ligne (spinner dans la modale) ; s'il reste des éléments, la modale reste ouverte avec la raison et le nombre restant, bouton « Se déconnecter quand même » (rien n'est supprimé, envoi à la prochaine connexion avec ce compte).
- [ ] `expo-background-task` (app fermée, ~15 min minimum décidé par Android).
- [ ] Tests unitaires : file d'attente, relance, conflit, interruption en cours de synchro, correspondance des colonnes.

**Terminé quand** : une modification de catégorie faite en mode avion apparaît dans Supabase après le retour du réseau, sans doublon, avec un pourcentage qui progresse ; une réinstallation + connexion restaure les données.

## Phase 6 — Fonctionnalités sur données réelles (hors ligne)

> Une fonctionnalité à la fois, complète : repositories (écritures via l'outil commun), requêtes réactives `useLiveQuery` à la place des mocks, validation des formulaires, tests.

- [ ] Accueil + Transactions : transactions du mois triées par date desc puis `created_at` desc, totaux du mois, totaux par catégorie, CRUD transactions ; `lib/money.ts` (conversion EUR → DA, arrondi, parsing des saisies) ; validation (montant > 0, taux > 0 si EUR, catégorie requise pour une dépense) ; mémoriser `last_eur_rate` et préremplir le champ taux. Tests : conversion, totaux, tri.
- [ ] Paiements réguliers : repositories, `lib/recurring.ts` (calcul des échéances dues, jour 31 → dernier jour du mois), « J'ai payé » = création de la dépense + de l'occurrence dans une même transaction SQLite (et leurs entrées `sync_queue`). Tests : échéances mensuelles et annuelles, mois courts, 29 février, échéances en retard multiples, paiement déjà confirmé.
- [ ] Dettes : repositories, création auto de la personne à l'enregistrement, calcul du reste dû, validation (montant > 0, taux > 0 si EUR, remboursement ≤ reste dû, personne requise). Tests : reste dû et conversions.

**Terminé quand** : l'app fonctionne entièrement en mode avion, les données survivent à un redémarrage et se synchronisent au retour du réseau.

## Phase 7 — Export / import JSON

- [ ] Format : `{ version, exported_at, categories[], transactions[], recurring_payments[], recurring_occurrences[], debt_people[], debts[], debt_repayments[] }`.
- [ ] Export (icône de l'accueil + page Compte) : écrire le fichier puis ouvrir la feuille de partage Android.
- [ ] Import (page Compte) : choisir le fichier, valider le format et la version, confirmer, **remplacer** les données locales, puis tout mettre en file pour la synchro.
- [ ] Tests unitaires : aller-retour export → import identique, rejet des fichiers invalides.

## Phase 8 — Sentry

- [ ] `@sentry/react-native` + plugin Expo, envoi des source maps via EAS.
- [ ] Capturer les erreurs de synchro et d'import (sans montants ni notes dans les messages).
- [ ] Désactivé en développement.

## Phase 9 — Build et livraison

- [ ] `eas.json` : profils `development` et `production` (APK).
- [ ] Google Cloud : second client OAuth Android avec la SHA-1 du keystore EAS (`eas credentials`), sinon la connexion Google échoue (`DEVELOPER_ERROR`) dans l'APK EAS.
- [ ] Secrets EAS (Supabase, Google Web Client ID, Sentry).
- [ ] EAS Update configuré (canal `production`).
- [ ] Installer l'APK sur le téléphone et passer la checklist de recette.

## Checklist de recette v1

- [ ] Première connexion Google, puis redémarrage en mode avion → toujours connecté.
- [ ] Ajout / modification / suppression d'entrées et de dépenses hors ligne.
- [ ] Saisie EUR : taux prérempli, montant DA correct.
- [ ] Totaux, graphique et liste justes, y compris sur un mois vide et sur un mois futur.
- [ ] Modification d'une catégorie répercutée partout.
- [ ] Retour du réseau → synchro avec % puis « à jour » ; données présentes dans Supabase.
- [ ] Réinstallation + connexion → données restaurées depuis Supabase.
- [ ] Session invalidée côté serveur → app toujours utilisable, « Reconnexion requise », reconnexion avec le même compte sans perte.
- [ ] Déconnexion avec éléments en attente → reconnexion avec le même compte → éléments envoyés ; un autre compte ne voit pas ces données.
- [ ] Export JSON → import → données identiques.
- [ ] Paiement régulier : encart rouge le jour J, toujours visible les jours suivants, disparition après « J'ai payé » + confirmation, dépense créée dans le bon mois.
- [ ] Une erreur provoquée remonte dans Sentry.

---

## Hypothèses

1. Un seul projet Supabase pour le développement et la production.
2. Le montant EUR d'origine et le taux sont stockés en plus du montant en DA.
3. Un mois vide affiche un état vide avec une invitation à ajouter une transaction.
4. Les suppressions sont logiques (`deleted_at`).
5. L'import JSON remplace toutes les données, après confirmation.
6. Les montants EUR acceptent les centimes, arrondis au dinar entier.
7. Le graphique n'affiche que les dépenses.
8. Les textes sont écrits en dur en français (pas d'i18n en v1).
9. Les paiements réguliers sont mensuels (un jour du mois) ou annuels (un jour + un mois), en DA, toujours des dépenses ; pas de notification push, l'encart s'affiche à l'ouverture de l'app.
10. Plusieurs échéances non payées d'un même paiement donnent plusieurs encarts (un par échéance).
11. Modifier un paiement régulier ne touche pas les dépenses déjà enregistrées.

## Risques

- **Design Stitch pas encore lu** : forme du graphique, couleurs et logo à confirmer en phase 0.
- **Pause des projets Supabase gratuits** après ~7 jours d'inactivité : la synchro échoue jusqu'à réactivation.
- **Librairie de connexion Google** : la version gratuite de `@react-native-google-signin` s'appuie sur le SDK Android Google Sign-In legacy, déprécié mais fonctionnel. S'il est retiré : migrer vers la version Universal (payante, Credential Manager, même API JS) ou une alternative Credential Manager.
- **Environnement Android local** requis pour `npx expo run:android`.
- **Synchro app fermée** limitée par Android (≥ 15 min, sans garantie).
- **Perte du téléphone** avant synchro ou export = perte des données non envoyées.
- **Plusieurs appareils** : le pull incrémental filtre sur `updated_at` (horloge du téléphone). Une modification faite hors ligne sur un second appareil puis envoyée après le dernier pull du premier, avec un `updated_at` antérieur à son repère, ne serait jamais récupérée par le premier. Sans risque avec un seul téléphone (v1). Évolution si un second appareil arrive : repère attribué par le serveur (`server_updated_at` rempli par trigger, ou numéro de version) + Supabase Realtime au premier plan (signal de changement → pull incrémental) et notification push silencieuse en arrière-plan.
