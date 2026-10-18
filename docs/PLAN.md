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

### Hors périmètre v1

iOS · multilingue / i18n (textes en français écrits en dur) · thème sombre · images (pas d'ImageKit) · trigger.dev · multi-appareils · Play Store · catégories pour les entrées.

### Écrans

| Écran                | Route                                                                    | Contenu                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connexion            | `/(auth)/login`                                                          | Logo, bouton « Continuer avec Google »                                                                                                                                                                                           |
| Accueil              | `/(app)/index`                                                           | Barre haute (logo centré, icône export), sélecteur de mois ‹ Mois Année ›, cartes Entrées / Dépenses, graphique par catégorie, section « Détail », 2 boutons flottants « Ajouter entrée » / « Ajouter dépense » |
| Transaction          | `/(app)/transaction/new?type=income\|expense`, `/(app)/transaction/[id]` | Montant + devise (DA / EUR), taux si EUR, date (aujourd'hui par défaut), catégorie (dépense seulement), note facultative, bouton Enregistrer (+ Supprimer en modification)                                                       |
| Compte               | `/(app)/account`                                                         | Profil Google, état de synchro (en attente / en cours % / à jour / erreur, dernière synchro, nb d'éléments en attente, bouton « Synchroniser »), lien Catégories, Exporter / Importer JSON, Déconnexion                          |
| Catégories           | `/(app)/categories`                                                      | Liste des 9 catégories (icône, couleur, nom)                                                                                                                                                                                     |
| Éditeur de catégorie | `/(app)/categories/[id]`                                                 | Nom, palette de couleurs (arc-en-ciel), grille d'icônes Material Community Icons (blanches sur fond de couleur)                                                                                                                                                               |
| Paiements réguliers  | `/(app)/recurring`                                                       | Liste des paiements réguliers (nom, montant, catégorie, prochaine échéance), bouton « Ajouter » ; accès depuis la page Compte                                                                                                   |
| Éditeur de paiement  | `/(app)/recurring/new`, `/(app)/recurring/[id]`                          | Nom, montant en DA, catégorie, fréquence (mensuel / annuel), jour du mois (1–31) + mois si annuel, date de début, actif oui/non, note ; bouton Enregistrer (+ Supprimer en modification)                                                                                        |

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

Catégories par défaut : voiture, factures, maison, hanout, khaddar, boucherie, neyla, assya, loisirs.

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

| Champ                   | Type             | Règles                                                                 |
| ----------------------- | ---------------- | ---------------------------------------------------------------------- |
| id                      | uuid             | clé primaire, généré sur le client                                     |
| user_id                 | uuid             | = `auth.uid()`                                                         |
| name                    | text             | requis, non vide                                                       |
| amount_da               | int              | > 0                                                                    |
| category_id             | uuid             | requis                                                                 |
| frequency               | text             | `monthly` \| `yearly`                                                  |
| day_of_month            | int              | 1–31 ; si le mois est plus court, échéance au dernier jour du mois     |
| month                   | int null         | 1–12, requis si `yearly`, null si `monthly` (29/02 → 28/02 hors bissextile) |
| start_date              | date             | première échéance possible                                             |
| active                  | bool             | inactif = plus d'encart                                                |
| note                    | text null        | facultative                                                            |
| created_at / updated_at | timestamptz      |                                                                        |
| deleted_at              | timestamptz null | suppression logique                                                    |

**`recurring_occurrences`** (une ligne par échéance payée)

| Champ                   | Type        | Règles                                                   |
| ----------------------- | ----------- | -------------------------------------------------------- |
| id                      | uuid        | clé primaire                                             |
| user_id                 | uuid        | = `auth.uid()`                                           |
| recurring_payment_id    | uuid        |                                                          |
| due_date                | date        | unique avec `recurring_payment_id`                       |
| paid_at                 | date        | date de paiement confirmée                               |
| transaction_id          | uuid        | dépense créée lors de la confirmation                    |
| created_at / updated_at | timestamptz |                                                          |

Échéances dues = toutes les dates d'échéance calculées entre `start_date` et aujourd'hui, sans ligne dans `recurring_occurrences` (calcul côté client, rien n'est pré-généré).

**Tables locales uniquement (SQLite)**

- `sync_queue` : id, table_name, row_id, op (`upsert`), payload JSON, attempts, last_error, created_at.
- `settings` : clé/valeur — `last_eur_rate`, `last_pulled_at`, `seeded`.

**Supabase** : RLS activé sur toutes les tables synchronisées (`categories`, `transactions`, `recurring_payments`, `recurring_occurrences`), politique `user_id = auth.uid()` pour select/insert/update.

### Stack

| Rôle                    | Choix                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Framework               | Expo **SDK 57** (React Native 0.86, React 19.2), TypeScript, Expo Router                                  |
| Base locale             | `expo-sqlite` + Drizzle ORM (source de vérité de l'UI)                                                    |
| Backend                 | Supabase (Postgres + Auth) via `@supabase/supabase-js`                                                    |
| Auth Google             | Connexion native → ID token → `supabase.auth.signInWithIdToken` (librairie exacte à confirmer en phase 5) |
| Réseau                  | `@react-native-community/netinfo`                                                                         |
| Synchro en arrière-plan | `expo-background-task` (+ synchro au premier plan au retour du réseau)                                    |
| Graphique               | `react-native-svg` (anneau dessiné à la main)                                                             |
| Icônes                  | `@expo/vector-icons` (MaterialCommunityIcons)                                                             |
| Export / import         | `expo-file-system`, `expo-sharing`, `expo-document-picker`                                                |
| Monitoring              | `@sentry/react-native`                                                                                    |
| Tests                   | Jest (`jest-expo`)                                                                                        |
| Build                   | `npx expo run:android` (dev), EAS Build → APK, EAS Update                                                 |

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
    db/           # schéma Drizzle, client, migrations (phase 3)
    repositories/ # accès données (phase 3)
    sync/         # file d'attente + moteur de synchro (phase 6)
    lib/          # montants, dates, conversion EUR
    types/
  ```
- [x] ESLint + Prettier, alias d'import `@/`.
- [x] Mettre en place le thème (tokens Stitch) et la police.

**Terminé quand** : toutes les routes existent (écrans vides « À venir »).

## Phase 2 — Toutes les pages, UI seule

Toutes les pages sont alimentées par `assets/maquettes/` (catégories par défaut + ~20 transactions sur 2–3 mois). Aucune base, aucun réseau.

- [ ] Composants partagés : `AppHeader`, `MonthSelector`, `TotalCard`, `CategoryChart`, `TransactionRow` (avec glissement), `FabGroup`, `AmountInput`, `CurrencyToggle`, `DateField`, `CategoryPicker`, `ColorPicker`, `IconPicker`, `SyncStatusCard`, `EmptyState`, `ConfirmDialog`, `DuePaymentBanner` (encart rouge + bouton « J'ai payé »), `DayOfMonthPicker`.
- [ ] Formatage (`src/lib/format.ts` fait pour l'accueil) : montants `12 500 DA` (séparateur d'espace), mois en français (« Octobre 2026 »), dates de la liste.
- [x] **Connexion** : logo + bouton Google officiel (session factice : l'appui mène à l'accueil).
- [x] **Accueil** : barre haute (logo + export, pas d'avatar), mois ‹ ›, cartes Entrées / Dépenses, graphique identique au design, section « Détail », boutons flottants, état vide pour un mois sans transaction.
- [ ] **Transaction** : formulaire entrée / dépense, bascule DA ↔ EUR avec champ taux et aperçu du montant en DA, date, catégorie (dépense), note ; mode modification avec Supprimer.
- [ ] **Compte** : profil, carte d'état de synchro (afficher les 4 états avec des valeurs factices), Catégories, Exporter, Importer, Déconnexion.
- [ ] **Catégories** + **Éditeur** : liste des 9, nom, couleur, icône.
- [ ] **Paiements réguliers** + **Éditeur** : liste, formulaire ; encarts rouges factices sur l'accueil (un dû aujourd'hui, un en retard), modale de confirmation « J'ai payé ».
- [ ] Validation visuelle écran par écran contre le design Stitch.

**Terminé quand** : chaque écran correspond au design avec des données factices, et tous les parcours se cliquent de bout en bout.

## Phase 3 — Données locales (hors ligne)

- [ ] Schéma Drizzle (`categories`, `transactions`, `sync_queue`, `settings`) + migrations au démarrage.
- [ ] Seed des 9 catégories au premier lancement (`settings.seeded`).
- [ ] Repositories : transactions du mois triées par date desc puis `created_at` desc, totaux du mois, totaux par catégorie, CRUD transactions, mise à jour de catégorie, catégorie utilisée → suppression interdite.
- [ ] `lib/money.ts` : conversion EUR → DA, arrondi, parsing des saisies.
- [ ] Remplacer les mocks par les données SQLite (requêtes réactives `useLiveQuery`).
- [ ] Validation des formulaires (montant > 0, taux > 0 si EUR, catégorie requise pour une dépense).
- [ ] Mémoriser `last_eur_rate` et préremplir le champ taux.
- [ ] Paiements réguliers : schéma `recurring_payments` + `recurring_occurrences`, `lib/recurring.ts` (calcul des échéances dues, jour 31 → dernier jour du mois), « J'ai payé » = création de la dépense + de l'occurrence dans une même transaction SQLite. Catégorie utilisée par un paiement régulier → suppression interdite.
- [ ] Tests unitaires : conversion, totaux, tri, règle de suppression des catégories, calcul des échéances (mensuel et annuel, mois courts, 29 février, échéances en retard multiples, paiement déjà confirmé).

**Terminé quand** : l'app fonctionne entièrement en mode avion, et les données survivent à un redémarrage.

## Phase 4 — Supabase (backend)

- [ ] Migration SQL : tables `categories`, `transactions`, `recurring_payments`, `recurring_occurrences` (mêmes colonnes, `updated_at` géré par le client), index sur `(user_id, updated_at)`.
- [ ] RLS + politiques `user_id = auth.uid()`.
- [ ] Variables d'environnement `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Client Supabase avec stockage de session persistant (session lisible hors ligne).

## Phase 5 — Authentification Google

- [ ] Vérifier la librairie de connexion Google native recommandée à date (Credential Manager vs `@react-native-google-signin`) et sa compatibilité SDK 57.
- [ ] Google Cloud : client OAuth Android (SHA-1 debug + EAS) et client Web ; activer le provider Google dans Supabase.
- [ ] Connexion → ID token → `signInWithIdToken`.
- [ ] Garde de route : pas de session → `/login` ; session présente (même hors ligne) → accueil.
- [ ] Rattacher `user_id` aux données locales à la première connexion.
- [ ] Déconnexion : avertir s'il reste des éléments non synchronisés.

## Phase 6 — Synchronisation

- [ ] Chaque écriture locale = écriture de la ligne + ajout dans `sync_queue`, dans une même transaction SQLite.
- [ ] **Push** : vider la file dans l'ordre par lots, `upsert` par id (relançable sans doublon), retrait de la file uniquement après succès.
- [ ] **Pull** : récupérer les lignes `updated_at > last_pulled_at` (restauration après réinstallation).
- [ ] Conflits : la modification la plus récente gagne (`updated_at`).
- [ ] Erreurs : nouvelles tentatives avec délais croissants, `last_error` conservée, état « erreur » affiché.
- [ ] Déclencheurs : démarrage de l'app, retour du réseau (NetInfo), retour au premier plan, après chaque écriture si en ligne, `expo-background-task` (app fermée, ~15 min minimum décidé par Android), bouton « Synchroniser ».
- [ ] Store d'état de synchro (statut, % = éléments envoyés / total, dernière synchro) relié à la carte Compte.
- [ ] Verrou anti-exécutions simultanées.
- [ ] Tests unitaires : file d'attente, relance, conflit, interruption en cours de synchro.

**Terminé quand** : des saisies en mode avion apparaissent dans Supabase après le retour du réseau, sans doublon, avec un pourcentage qui progresse.

## Phase 7 — Export / import JSON

- [ ] Format : `{ version, exported_at, categories[], transactions[], recurring_payments[], recurring_occurrences[] }`.
- [ ] Export (icône de l'accueil + page Compte) : écrire le fichier puis ouvrir la feuille de partage Android.
- [ ] Import (page Compte) : choisir le fichier, valider le format et la version, confirmer, **remplacer** les données locales, puis tout mettre en file pour la synchro.
- [ ] Tests unitaires : aller-retour export → import identique, rejet des fichiers invalides.

## Phase 8 — Sentry

- [ ] `@sentry/react-native` + plugin Expo, envoi des source maps via EAS.
- [ ] Capturer les erreurs de synchro et d'import (sans montants ni notes dans les messages).
- [ ] Désactivé en développement.

## Phase 9 — Build et livraison

- [ ] `eas.json` : profils `development` et `production` (APK).
- [ ] Secrets EAS (Supabase, Sentry).
- [ ] EAS Update configuré (canal `production`).
- [ ] Installer l'APK sur le téléphone et passer la checklist de recette.

## Checklist de recette v1

- [ ] Première connexion Google, puis redémarrage en mode avion → toujours connecté.
- [ ] Ajout / modification / suppression d'entrées et de dépenses hors ligne.
- [ ] Saisie EUR : taux prérempli, montant DA correct.
- [ ] Totaux, graphique et liste justes, y compris sur un mois vide et sur un mois futur.
- [ ] Modification d'une catégorie répercutée partout ; suppression d'une catégorie utilisée refusée.
- [ ] Retour du réseau → synchro avec % puis « à jour » ; données présentes dans Supabase.
- [ ] Réinstallation + connexion → données restaurées depuis Supabase.
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
- **Librairie de connexion Google** : la version gratuite de `@react-native-google-signin` s'appuierait sur une API Android dépréciée — à trancher en phase 5.
- **Environnement Android local** requis pour `npx expo run:android`.
- **Synchro app fermée** limitée par Android (≥ 15 min, sans garantie).
- **Perte du téléphone** avant synchro ou export = perte des données non envoyées.
