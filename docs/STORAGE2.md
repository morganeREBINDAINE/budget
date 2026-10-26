# Règle — SQLite local source de vérité, Supabase sauvegarde synchronisée

Modèle hors ligne d'abord, aligné sur `docs/PLAN.md` (phases 5 et 6).

Chaque section donne d'abord les **règles** (à respecter pour toute évolution), puis
l'**implémentation** actuelle (comment le code les applique et où le trouver).

## 1. Principes

- La base SQLite locale (`expo-sqlite` + Drizzle) est la source de vérité de l'interface : tous les écrans lisent SQLite, jamais Supabase directement.
- Supabase est la sauvegarde distante : il reçoit les écritures locales via la file de synchronisation et permet la restauration après réinstallation.
- L'application fonctionne entièrement hors ligne (lecture **et** écriture), sauf la première connexion Google.
- Les données sont isolées par utilisateur : chaque ligne porte le `user_id` du compte connecté ; un changement de compte recharge entièrement les données du nouveau compte.

### Implémentation — vue d'ensemble

```mermaid
flowchart LR
  UI[Écrans / hooks features] -- useLiveQuery --> SQLite[(SQLite budget.db)]
  UI -- repositories --> W[writeTransaction]
  W -- ligne + entrée sync_queue<br/>même transaction --> SQLite
  W -- notifyLocalWrite --> Auto[autoSync]
  Auto -- requestSync --> Sync[syncNow : push puis pull]
  BG[Tâche de fond<br/>expo-background-task] -- requestSync 'background' --> Sync
  Sync -- upsert / delete --> SB[(Supabase)]
  SB -- pages updated_at --> Sync
  Sync -- saveRemoteRows --> SQLite
  Sync -- état en mémoire --> Card[Carte Compte]
```

- Le client Supabase (`src/lib/supabase.ts`) n'est utilisé que par l'auth et `src/sync/`.
- **Pas d'état optimiste** : l'UI se met à jour parce que SQLite change (requêtes réactives), pas
  parce qu'un store mémoire est modifié.
- **Stores sans React** : l'état de la synchro, du pull initial, des toasts et le signal
  « écriture locale » sont des modules à listeners (`subscribe…` / `get…`), lus en React via
  `useSyncExternalStore`. Ils sont ainsi utilisables depuis la tâche de fond et le moteur de synchro.

| Couche | Dossier | Rôle |
| --- | --- | --- |
| Connexion / schéma | `src/db/` | ouverture, migrations Drizzle, schéma, `LiveData` |
| Accès aux données | `src/repositories/` | requêtes de lecture, écritures via l'outil commun, file, réglages |
| Moteur de synchro | `src/sync/` | push, pull, verrou, relances, déclencheurs, pull initial, session |
| Glue React | `src/features/sync/`, `src/features/account/` | hooks d'état, tâche de fond, reconnexion, carte Compte |
| Erreurs | `src/lib/errors.ts`, `src/lib/toast.ts`, `src/lib/captureError.ts` | toast 3 s, journal, Sentry |

## 2. Base locale et lectures

### Ouverture et migrations

- `src/db/client.ts` : connexion unique `openDatabaseSync('budget.db', { enableChangeListener: true })`
  (le change listener alimente `useLiveQuery`). `prepareDatabase()` ouvre puis migre ; une
  préparation en cours est **partagée** (démarrage, double effet en dev, « Réessayer », tâche de
  fond) et un échec réinitialise la connexion.
- `src/db/DatabaseProvider.tsx` : appelle `prepareDatabase(runMigrations)` au montage. Rien n'est
  rendu pendant la préparation (le splash reste affiché, `onSettled` le masque) ; en cas d'échec,
  `DatabaseErrorScreen` avec « Réessayer ». `useDatabase()` expose l'instance Drizzle.
- Migrations Drizzle dans `src/db/migrations/` (générées par `npm run db:generate`), appliquées
  aussi par la tâche de fond, qui peut tourner avant toute ouverture de l'UI.

### Schéma (`src/db/schema.ts`)

Tables synchronisées (`SYNCED_TABLES`) : `categories`, `transactions`, `recurring_payments`,
`recurring_occurrences`, `debt_people`, `debts`, `debt_repayments`.

Conventions communes : `id` UUID généré sur le client, `user_id` sur chaque ligne, `created_at` /
`updated_at` ISO gérés par le client, `deleted_at` pour la suppression logique, montants entiers,
contraintes `CHECK`. **Pas de clés étrangères SQL** : le pull et l'import peuvent insérer dans
n'importe quel ordre, la cohérence est vérifiée par les repositories. Toute contrainte unique
commence par `user_id` (§8).

Exceptions :
- `recurring_occurrences` n'a pas de `deleted_at` (pas supprimée, ignorée si son paiement l'est) ;
- `debt_people` est à **suppression définitive** (`HARD_DELETABLE_TABLES`), sans `deleted_at`.

Tables locales uniquement :
- `sync_queue` : file d'envoi (§3) ;
- `settings` : clé/valeur par compte — `last_eur_rate`, `last_pulled_at`, `last_synced_at`.

Hors SQLite : le compte local (`id`, `email`, `name`) est dans SecureStore
(`src/features/auth/localAccount.ts`), la session Supabase dans un stockage chiffré
(`src/lib/secureSessionStorage.ts`).

### Lectures

- Chaque repository expose des **constructeurs de requêtes** (ex. `monthTransactionsQuery`) filtrés
  par `user_id` et `deleted_at IS NULL`.
- Les hooks de `features/*/use….ts` les passent à `useLiveQuery` (drizzle-orm/expo-sqlite) et
  renvoient un `LiveData<T>` : `loading` | `ready` | `error` (`src/db/liveData.ts`).
  `useReportReadError` affiche un toast en cas d'échec de lecture.
- Les écrans affichent des skeletons pendant `loading` et un bloc d'erreur (`ReadErrorCard`)
  pendant `error`.

## 3. Écritures

- Toute écriture (création, modification, suppression) = écriture de la ligne **et** ajout dans `sync_queue`, dans **une même transaction SQLite**. Si la transaction échoue, rien n'est écrit et l'erreur est affichée.
- Chaque écriture renseigne `user_id`, `updated_at` (horodatage client) et, pour une création, un `id` UUID généré sur le client.
- Suppressions logiques par défaut (`deleted_at`) ; les lectures filtrent `deleted_at IS NULL`.
- **Suppression définitive (exception)** : autorisée uniquement pour des données peu importantes, sans historique utile et recréables à la saisie (ex. une liste de noms proposés en autocomplétion). Ces tables sont déclarées explicitement comme telles et n'ont pas de colonne `deleted_at`. Leur suppression passe par l'outil d'écriture commun : la ligne est effacée et une entrée de suppression (réduite à l'id et au `user_id`) est ajoutée à la file de synchronisation, dans la même transaction. Côté serveur, une politique RLS `DELETE` limitée au propriétaire de la ligne est ajoutée. Toute nouvelle table concernée doit être validée avant implémentation.
- L'interface se met à jour à partir de SQLite (requêtes réactives), une fois la transaction locale validée — pas d'état optimiste en mémoire.
- Les opérations composées (ex. « J'ai payé » = dépense + occurrence ; import JSON) sont atomiques.

### Implémentation — outil d'écriture commun (`src/repositories/write.ts`)

Toute écriture d'une table synchronisée passe par `writeTransaction(db, userId, fn)` ou ses
raccourcis `insertRow` / `updateRow` / `softDeleteRow`. Le `Writer` fourni au callback propose
`insert`, `update`, `softDelete`, `hardDelete`.

- L'outil renseigne lui-même `id`, `user_id`, `created_at`, `updated_at`, `deleted_at`.
- `nextTimestamp(previous)` garantit un `updated_at` strictement postérieur à la version
  précédente, même si l'horloge du téléphone recule.
- Le payload de la file est la **ligne relue après écriture** (valeurs par défaut et `NULL` inclus),
  `op: 'upsert'`. Pour `hardDelete`, la ligne est effacée et l'entrée est `op: 'delete'` avec un
  payload réduit à `{ id, userId }`.
- Le callback **doit être synchrone** (le pilote expo-sqlite exécute la transaction de façon
  synchrone) : une Promise renvoyée ou une écriture après fermeture lève une erreur.
- `RowNotFoundError` si la ligne n'existe pas, est supprimée ou appartient à un autre compte.
- Les opérations composées utilisent un seul `writeTransaction`.
- Après validation, si des entrées ont été ajoutées, `notifyLocalWrite(userId)`
  (`src/repositories/localWrites.ts`) prévient le moteur de synchro. Une erreur d'abonné ne remonte
  jamais à l'écriture.

### Implémentation — file `sync_queue` (`src/repositories/syncQueue.ts`)

Colonnes : `table_name`, `row_id`, `op`, `payload` (JSON), `attempts`, `last_error`, `rejected_at`,
`created_at`. Ordre de traitement : `rowid` (ordre d'insertion).

- `readQueueBatch` : plus anciennes entrées envoyables (hors mises de côté).
- `removeQueueEntries` : retrait **par id d'entrée** — une écriture faite pendant l'envoi reste.
- `markQueueFailure` : `attempts + 1`, `last_error` (erreur passagère).
- `rejectQueueEntries` / `requeueRejectedEntries` : mise de côté (`rejected_at`) et remise en file.
- `removeRejectedEntriesForRows` : une version plus récente envoyée rend les versions mises de côté
  de la même ligne obsolètes.
- Compteurs : `pendingSyncCount` (mises de côté comprises, c'est le « non synchronisé »),
  `sendableSyncCount`, `rejectedSyncCountQuery` ; versions requêtes à observer pour la carte Compte.

### Implémentation — import / export JSON (`src/repositories/backup.ts`)

- Export : lignes non supprimées du compte, sans `user_id` ni `deleted_at`.
- Import : remplacement de toutes les données du compte en **un seul** `writeTransaction`
  (suppressions logiques, suppression définitive des personnes, catégories modifiées sur place,
  nouvelles lignes) : atomique, et chaque modification part dans `sync_queue` comme une saisie.

## 4. Synchronisation

- Centralisée dans `src/sync/` ; aucun écran n'appelle Supabase directement.
- **Push** : la file est vidée dans l'ordre, par lots, en `upsert` par `id` (relançable sans doublon) ; les suppressions définitives sont envoyées avant les écritures de la même table (elles libèrent les valeurs uniques) et supprimer une ligne déjà absente n'est pas une erreur ; une entrée n'est retirée qu'après confirmation de Supabase.
- **Pull** : récupération des lignes `updated_at > last_pulled_at` (restauration, réinstallation) ; une ligne dont la suppression définitive attend dans la file n'est pas réinsérée.
- **Conflits** : la modification la plus récente gagne (`updated_at`). Côté SQLite, le pull ne remplace une ligne que si la version distante est plus récente et qu'aucune modification locale n'attend dans `sync_queue` ; côté Supabase, le trigger `skip_stale_update` ignore une mise à jour qui n'est pas plus récente que la ligne en base.
- **Déclencheurs** : démarrage de l'app, retour du réseau, retour au premier plan, après chaque écriture si en ligne, tâche de fond (`expo-background-task`), bouton « Synchroniser ». Les déclencheurs automatiques sont silencieux hors ligne (aucune requête, aucune erreur affichée) et ne contournent pas une relance déjà programmée, sauf le démarrage et le retour du réseau.
- Un verrou empêche deux synchronisations simultanées ; échecs relancés avec délais croissants, `last_error` conservée. Toute requête Supabase est annulée après 30 s sans réponse (`src/lib/fetchWithTimeout.ts` : React Native n'impose aucun délai sur Android) : sans cela, une requête partie sur une connexion morte bloquerait le verrou indéfiniment. Elle devient une erreur passagère, relancée, avec le message « Le serveur ne répond pas. ». Les relances se font **côté client** (les données n'existent que sur le téléphone), app ouverte, jamais hors ligne ni avec une session refusée.
- **Tâche de fond** (`expo-background-task`, au plus toutes les 15 min, app fermée ou en arrière-plan) : push + pull du compte local s'il a déjà été récupéré ; ni relance programmée ni toast en cas d'échec (l'exécution suivante ou l'ouverture de l'app prend le relais, l'erreur reste visible sur la carte Compte).
- Une ligne refusée définitivement par Supabase (donnée invalide : codes `22xxx`, `23xxx`, `42501`) est isolée puis **mise de côté** (`rejected_at`) : elle ne bloque pas la file, reste comptée comme non synchronisée et n'est jamais supprimée automatiquement ; elle est signalée (toast, carte Compte) et « Réessayer » la remet dans la file.
- L'état (en attente, en cours %, à jour, erreur) est exposé par un store unique, affiché sur la page Compte.

### Implémentation — push (`src/sync/push.ts`)

`pushToSupabase` vérifie la session (`requireSession`, §5) puis `pushAll` :

1. lit la file par lots de **200** entrées (`PUSH_BATCH_SIZE`) ;
2. regroupe chaque lot **par table puis par ligne** : une ligne écrite plusieurs fois n'est envoyée
   qu'une fois, dans sa dernière opération (Postgres refuse deux modifications de la même ligne dans
   un upsert) ;
3. convertit le payload camelCase → snake_case (`toRemote`, `src/sync/columns.ts`, déduit du schéma
   Drizzle) ; un payload d'un autre compte ou avec une colonne inconnue est mis de côté sans envoi ;
4. par table : d'abord les **suppressions définitives** (`delete … where user_id and id in`), puis
   les **upserts** (`upsert(rows, { onConflict: 'id' })`) ;
5. succès ⇒ entrées retirées de la file ; progression `done / total` remontée au store.

Classement des erreurs (`classifyErrorCode`) :

| Nature | Codes | Traitement |
| --- | --- | --- |
| Refus de la ligne (`rejected`) | `22xxx`, `23xxx`, `42501` | envoi groupé refusé ⇒ renvoi **ligne par ligne** pour isoler les fautives, mises de côté (`rejected_at`) ; les autres partent, la file n'est pas bloquée |
| Passagère (`transient`) | réseau (code vide), `PGRST…`, tout le reste | entrées non traitées du lot marquées (`attempts`, `last_error`), **arrêt** du push, l'erreur remonte (ordre préservé) |

Les refus d'un push sont regroupés en **un seul** événement Sentry (table, op, message technique,
sans valeur).

### Implémentation — pull (`src/sync/pull.ts`)

`pullFromSupabase` vérifie la session puis `pullAll` :

- pour chaque table de `SYNCED_TABLES`, lit les lignes `user_id = moi` et
  `updated_at >= last_pulled_at`, triées par `(updated_at, id)`, par pages de **1000** ;
- pagination **par curseur** (`updated_at > x OR (updated_at = x AND id > y)`) : aucune ligne
  sautée ni répétée si des données changent pendant le pull ;
- chaque ligne est validée et convertie (`toLocal` : colonnes présentes, horodatages normalisés en
  ISO milliseconde) avant toute écriture ;
- le repère `last_pulled_at` est le plus grand `updated_at` **reçu du serveur** (jamais l'horloge
  du téléphone), enregistré seulement **après toutes les tables** : un pull interrompu reprend au
  même point (l'enregistrement est idempotent).

Enregistrement local (`saveRemoteRows`, `src/repositories/remoteRows.ts`) :

- ne passe **pas** par l'outil d'écriture : une ligne reçue n'entre jamais dans `sync_queue`
  (pas de boucle pull → push), et `notifyLocalWrite` n'est pas émis ;
- `INSERT … ON CONFLICT(id) DO UPDATE … WHERE` : une ligne existante n'est remplacée que si
  `excluded.updated_at > updated_at` **et** qu'aucune entrée de cette ligne n'attend dans la file
  (la version locale partira au push et gagnera côté serveur si elle est plus récente) ;
- une ligne dont la suppression définitive attend dans la file n'est pas réinsérée ;
- `id`, `user_id`, `created_at` ne sont jamais modifiés ; lignes d'un autre compte refusées ;
  lots de 100 lignes, dans une transaction.

Limite assumée (un seul téléphone en v1) : une ligne écrite plus tard par un autre appareil avec un
`updated_at` antérieur au repère ne serait pas récupérée.

### Implémentation — orchestration (`src/sync/syncNow.ts`)

Une synchronisation = **push puis pull** (`pull: false` pour la déconnexion), puis
`last_synced_at`. Deux points d'entrée :

- `syncNow(db, userId, options)` — appel **explicite** (bouton « Synchroniser », déconnexion,
  reconnexion, envoi après pull initial) : annule la relance programmée et remet le compteur de
  délais à zéro.
- `requestSync(db, userId, trigger)` — déclencheurs **automatiques** :
  `startup` | `network` | `foreground` | `write` | `background`.

Les deux **ne rejettent jamais** : le résultat est
`{ ok: true } | { ok: false, reason: 'offline' | 'session' | 'failed' }` et l'état est publié.

**Verrou** : `runLocked` renvoie la promesse en cours à tout appel concurrent pour le même compte.
Un dépassement du délai de 30 s n'est pas envoyé à Sentry.

Règles des déclencheurs automatiques :

| Situation | Comportement |
| --- | --- |
| Session refusée (`sessionRefused`) | rien jusqu'à la reconnexion |
| Hors ligne (`isOnline()` NetInfo ; état inconnu = en ligne) | rien : aucune requête, aucune erreur, état inchangé |
| Synchro en cours + `background` | attend la synchro en cours |
| Synchro en cours + `write` | **une** seconde synchro demandée à la fin (si la première a réussi) |
| `startup`, `network`, `background` | relance programmée annulée, synchro immédiate |
| `foreground`, `write` avec relance programmée | rien : la relance enverra toute la file |
| `foreground` < 60 s après la dernière synchro | rien (`FOREGROUND_MIN_INTERVAL_MS`) |

**Relances** : après un échec passager, app ouverte, `scheduleRetry` programme une relance avec
délais `10 s → 30 s → 1 min → 5 min → 15 min` (le dernier se répète) et publie `nextRetryAt`.
Pas de relance hors ligne, ni si la session est refusée, ni en tâche de fond. trigger.dev n'est pas
utilisé ici.

**État publié** (`SyncRunState`, en mémoire) : `{ userId, running, progress (0→1), error,
nextRetryAt, sessionRefused }`, lu via `subscribeSyncRun` / `getSyncRunState`. Les lignes mises de
côté déclenchent un toast (« N éléments refusés par le serveur… », sauf en tâche de fond).

### Implémentation — déclencheurs (`src/sync/autoSync.ts`)

`startAutoSync(db, userId)`, monté par `src/app/(app)/_layout.tsx` pour le compte connecté :

- `startup` immédiat ;
- `network` : passage **avéré** hors ligne → en ligne (`NetInfo.addEventListener`) ;
- `foreground` : `background`/`inactive` → `active` (`AppState`) ;
- `write` : abonnement à `subscribeLocalWrites`, regroupé par un debounce de **2 s**.

Tant que le pull initial du compte n'est pas `ready`, ces déclencheurs ne synchronisent pas ; s'il
est en `error`, `network` et `foreground` relancent le pull initial (si en ligne).

Le layout appelle aussi `cancelScheduledSync(userId)` au démontage (déconnexion, changement de
compte) et `registerBackgroundSync()`.

### Implémentation — pull initial (`src/sync/initialPull.ts`)

Store `InitialPullStatus` : `loading` | `error` | `reauth` | `ready`.

- Lancé à chaque connexion Google (`LoginScreen` → `signInWithGoogle(onSignedIn)` →
  `startInitialPull`, juste avant que le compte soit considéré connecté) et au démarrage via
  `resumeInitialPull` si `last_pulled_at` est absent (sinon marqué `ready` directement).
- Un seul à la fois par compte (promesse partagée), ne rejette jamais.
- Succès exigé : pull complet **et** au moins une catégorie locale (créées côté Supabase à la
  création du compte, migration `create_default_categories`).
- Ensuite, si la file contient des éléments d'une session précédente du compte, `syncNow` en
  arrière-plan (toast si échec).
- `SessionError` ⇒ `reauth` ; autre erreur ⇒ `error` (Sentry).

`useInitialPull()` (`src/features/sync/useInitialPull.ts`) expose `status`, `ready`, `failed`,
`retry`. Avant l'évaluation, le statut est déduit de `last_pulled_at` pour éviter un flash. Les
écrans affichent des skeletons pendant `loading`, `InitialPullError` (« Réessayer » ou « Se
reconnecter avec Google ») si `failed`, et les actions dépendantes des données (saisie, export,
import, synchro) sont gardées par `ready` **dans le handler**.

### Implémentation — tâche de fond (`src/features/sync/backgroundSync.ts`)

- `TaskManager.defineTask` au chargement du bundle (`index.ts`, avant le routeur) : Android peut
  lancer l'app sans écran pour l'exécuter.
- Enregistrée (intervalle minimum **15 min**, décidé par Android) à l'ouverture de l'app
  connectée ; retirée à la déconnexion manuelle. Enregistrements et retraits sont sérialisés.
- Chaque exécution, indépendante de React : `prepareDatabase` (migrations comprises), lecture du
  compte local, puis `requestSync(…, 'background')` si le compte a déjà été récupéré.
- Issues : `signedOut`, `notPulled`, `skipped` (hors ligne / session refusée), `synced`, `failed`.

### Implémentation — état affiché (carte Compte)

`useSyncStatus()` (`src/features/account/useSyncStatus.ts`) combine le store de synchro, le pull
initial, `needsReauth`, et des requêtes réactives (`pendingSyncCount`, `rejectedSyncCount`,
`last_synced_at`) en un `SyncStatus` (`src/types/sync.ts`), par priorité :

1. compteur illisible ⇒ `error` ;
2. synchro en cours ⇒ `syncing` (progression) ;
3. reconnexion requise ⇒ `reauth` ;
4. dernière tentative échouée ⇒ `error` (message, `nextRetryAt`) ;
5. éléments mis de côté ⇒ `error` (« refusés par le serveur ») ;
6. file non vide ⇒ `pending` ;
7. sinon ⇒ `synced`.

« Synchroniser » / « Réessayer » remet d'abord les entrées mises de côté dans la file
(`requeueRejectedEntries`), puis appelle `syncNow`.

## 5. Session, déconnexion et données locales

- **Compte local persistant** : à la première connexion Google, le compte (`user_id`, email, nom) est enregistré localement (chiffré). L'état « connecté » de l'app repose sur ce compte local, pas sur la validité du token Supabase.
- **Pas de déconnexion automatique** : seule une déconnexion manuelle ramène à l'écran de connexion. Hors ligne, token expiré ou session invalidée côté serveur, l'app reste utilisable et continue d'écrire en local dans `sync_queue`.
- **Session invalidée côté serveur** (refresh refusé) : la synchro passe à l'état « Reconnexion requise » (carte Compte, toast une fois par lancement) et les déclencheurs automatiques sont en pause ; la reconnexion Google n'est acceptée que pour le **même** compte (email Google vérifié avant tout appel Supabase, puis `user_id`), puis la file reprend sans perte. Un rafraîchissement impossible faute de réseau n'est pas une session refusée : erreur passagère, relancée.
- **Déconnexion manuelle** :
  1. si en ligne, tenter une synchronisation complète avant de se déconnecter (loader dans la modale) ;
  2. s'il reste des éléments non synchronisés, avertir avec leur nombre et préciser qu'ils restent sur le téléphone et seront envoyés à la prochaine connexion avec ce compte ;
  3. ne **jamais supprimer** les données locales ni la `sync_queue` à la déconnexion : elles restent rattachées à leur `user_id`.
- **Changement de compte** : seules les données (lignes, `sync_queue`, `settings`) du `user_id` connecté sont lues et synchronisées ; celles d'un autre compte restent intactes et inactives jusqu'à sa reconnexion.

### Implémentation

- **Connecté = compte local présent** (`AuthProvider`, compte dans SecureStore), indépendamment
  du token Supabase.
- `requireSession(userId)` (`src/sync/session.ts`) avant tout push/pull :
  - rafraîchissement impossible faute de réseau ⇒ erreur passagère (relancée) ;
  - session absente, illisible ou d'un autre compte ⇒ `SessionError` ⇒ état `sessionRefused`
    (« Reconnexion requise »), déclencheurs automatiques en pause.
- `AuthProvider` suit `onAuthStateChange` : `SIGNED_OUT` (refresh refusé) ⇒ `needsReauth` ; une
  session d'un autre compte est écartée. Hors ligne avec token expiré, la session émise à `null`
  mais encore stockée ne demande pas de reconnexion.
- `SupabaseAutoRefresh` ne rafraîchit le token qu'au premier plan.
- Reconnexion (`useReconnect`) : Google avec email attendu, puis contrôle du `user_id` ; ensuite
  `resumeAfterReconnect` relance le pull initial s'il n'a pas abouti, sinon `syncNow`.
- `ReauthNotifier` affiche le toast une fois par lancement.
- Déconnexion (`AccountScreen` → `signOut`) : s'il reste des éléments, `syncNow` en push seul
  (`pull: false`) ; puis révocation de la session si en ligne, suppression de la session stockée et
  du compte local, retrait de la tâche de fond. Ni lignes ni file supprimées.
- Toutes les lectures, écritures, files et réglages sont filtrés par `user_id`.

## 6. Gestion des erreurs

- Système de toast global et partagé : message compréhensible affiché pendant exactement **3 secondes** pour toute erreur pertinente (base locale, synchronisation, réseau, import).
- Point d'entrée unique : `reportError({ scope, message, error })` (`src/lib/errors.ts`), qui journalise le détail technique et affiche le toast ; `showToast` (`src/lib/toast.ts`) pour un message sans erreur. Utilisables hors React (moteur de synchro, import).
- Les erreurs liées à un formulaire restent affichées dans le formulaire (sous le champ ou au-dessus du bouton).
- Ne jamais ignorer silencieusement une erreur, simuler un succès ou exposer des informations sensibles (pas de montants ni de notes dans les journaux ou Sentry).
- Journaliser les détails techniques utiles et éviter les notifications en double pour une même erreur.

### Implémentation

- `reportError` et `showToast` dédoublonnent par clé (`key`, défaut : scope + message) ; un seul
  toast à la fois, les suivants en file. `captureError` envoie à Sentry sans montant ni note.
- Erreurs d'import : affichées dans la modale, pas en toast.
- Les handlers d'actions asynchrones utilisent un garde (`useRef` `inFlight`, `ready`) en plus du
  `disabled`, avec spinner dans le bouton ; l'import attend une frame avant sa transaction
  synchrone pour laisser le spinner s'afficher.

## 7. Audit et tests

- Avant toute modification, examiner le schéma Drizzle, les migrations, les repositories, la file de synchro et le système de toast existants ; réutiliser les mécanismes existants.
- Une écriture locale n'est déclarée réussie qu'après validation de la transaction SQLite ; une synchronisation n'est déclarée réussie qu'après confirmation de Supabase.
- Tests unitaires pour les règles métier (conversions, totaux, échéances, reste dû) et la file de synchro (relance, conflit, interruption).

### Implémentation

Tests unitaires sur SQLite réel (better-sqlite3, `src/test/testDatabase.ts`) avec dépendances
réseau injectées : `src/repositories/__tests__/` (outil d'écriture, file, enregistrement distant,
import) et `src/sync/__tests__/` (push, pull, conflits, colonnes, verrou et relances, déclencheurs,
pull initial, session), plus `src/features/sync/__tests__/backgroundSync.test.ts`.

## 8. Supabase CLI et migrations distantes

- Supabase est toujours installé dans le projet (Supabase CLI en devDependency, dossier `supabase/` initialisé via `supabase init` et versionné).
- Toute modification du schéma distant (tables, colonnes, index, RLS, fonctions) passe par un fichier de migration SQL enregistré dans `supabase/migrations/` (créé via `supabase migration new <nom>`), jamais par une modification manuelle dans le dashboard.
- Ces migrations Supabase sont distinctes des migrations Drizzle de la base SQLite locale ; tout changement de schéma qui touche les données synchronisées doit être reflété des deux côtés.
- Toute contrainte d’unicité (index unique, clé unique) sur une table synchronisée inclut user_id en première colonne, côté Supabase et SQLite. Une ligne d’un utilisateur ne doit jamais pouvoir bloquer ou entrer en conflit avec celle d’un autre.

### Implémentation (côté serveur)

- RLS `user_id = auth.uid()` en select / insert / update sur toutes les tables synchronisées ;
  politique `DELETE` limitée au propriétaire pour `debt_people`.
- Trigger `skip_stale_update` (migration `skip_stale_updates`) : un update dont `updated_at` n'est
  pas strictement plus récent est ignoré sans erreur — l'upsert du push est donc relançable sans
  régression.
- Catégories par défaut créées à la création du compte (`create_default_categories`).
- Colonnes identiques des deux côtés : la correspondance camelCase ↔ snake_case est déduite du
  schéma Drizzle (`src/sync/columns.ts`).

## 9. Configuration et clés

- Côté app, utiliser uniquement la clé **publishable** Supabase (`sb_publishable_…`) via `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, jamais l'ancienne clé `anon` ni une clé secrète (`service_role` / `sb_secret_…`) : les variables `EXPO_PUBLIC_` sont visibles en clair dans l'APK.
- Toute nouvelle variable d'environnement : préfixe `EXPO_PUBLIC_` si lue par l'app, ajoutée vide et commentée dans `.env.example` (versionné), typée dans `src/types/env.d.ts`, lue et validée dans `src/lib/env.ts` (notation pointée, erreur explicite si manquante). Le fichier `.env` n'est jamais versionné ; les valeurs de build viennent des secrets EAS.
