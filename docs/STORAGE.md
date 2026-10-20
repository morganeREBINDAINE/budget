# Règle — SQLite local source de vérité, Supabase sauvegarde synchronisée

Modèle hors ligne d'abord, aligné sur `docs/PLAN.md` (phases 5 et 6).

## 1. Principes

- La base SQLite locale (`expo-sqlite` + Drizzle) est la source de vérité de l'interface : tous les écrans lisent SQLite, jamais Supabase directement.
- Supabase est la sauvegarde distante : il reçoit les écritures locales via la file de synchronisation et permet la restauration après réinstallation.
- L'application fonctionne entièrement hors ligne (lecture **et** écriture), sauf la première connexion Google.
- Les données sont isolées par utilisateur : chaque ligne porte le `user_id` du compte connecté ; un changement de compte recharge entièrement les données du nouveau compte.

## 2. Écritures

- Toute écriture (création, modification, suppression) = écriture de la ligne **et** ajout dans `sync_queue`, dans **une même transaction SQLite**. Si la transaction échoue, rien n'est écrit et l'erreur est affichée.
- Chaque écriture renseigne `user_id`, `updated_at` (horodatage client) et, pour une création, un `id` UUID généré sur le client.
- Suppressions logiques uniquement (`deleted_at`) ; les lectures filtrent `deleted_at IS NULL`.
- L'interface se met à jour à partir de SQLite (requêtes réactives), une fois la transaction locale validée — pas d'état optimiste en mémoire.
- Les opérations composées (ex. « J'ai payé » = dépense + occurrence ; import JSON) sont atomiques.

## 3. Synchronisation

- Centralisée dans `src/sync/` ; aucun écran n'appelle Supabase directement.
- **Push** : la file est vidée dans l'ordre, par lots, en `upsert` par `id` (relançable sans doublon) ; une entrée n'est retirée qu'après confirmation de Supabase.
- **Pull** : récupération des lignes `updated_at > last_pulled_at` (restauration, réinstallation).
- **Conflits** : la modification la plus récente gagne (`updated_at`). Côté SQLite, le pull ne remplace une ligne que si la version distante est plus récente et qu'aucune modification locale n'attend dans `sync_queue` ; côté Supabase, le trigger `skip_stale_update` ignore une mise à jour qui n'est pas plus récente que la ligne en base.
- **Déclencheurs** : démarrage de l'app, retour du réseau, retour au premier plan, après chaque écriture si en ligne, tâche de fond (`expo-background-task`), bouton « Synchroniser ».
- Un verrou empêche deux synchronisations simultanées ; échecs relancés avec délais croissants, `last_error` conservée. Les relances se font **côté client** (les données n'existent que sur le téléphone), app ouverte, jamais hors ligne ni avec une session refusée.
- Une ligne refusée définitivement par Supabase (donnée invalide : codes `22xxx`, `23xxx`, `42501`) est isolée puis **mise de côté** (`rejected_at`) : elle ne bloque pas la file, reste comptée comme non synchronisée et n'est jamais supprimée automatiquement ; elle est signalée (toast, carte Compte) et « Réessayer » la remet dans la file.
- L'état (en attente, en cours %, à jour, erreur) est exposé par un store unique, affiché sur la page Compte.

## 4. Session, déconnexion et données locales

- **Compte local persistant** : à la première connexion Google, le compte (`user_id`, email, nom) est enregistré localement (chiffré). L'état « connecté » de l'app repose sur ce compte local, pas sur la validité du token Supabase.
- **Pas de déconnexion automatique** : seule une déconnexion manuelle ramène à l'écran de connexion. Hors ligne, token expiré ou session invalidée côté serveur, l'app reste utilisable et continue d'écrire en local dans `sync_queue`.
- **Session invalidée côté serveur** (refresh refusé) : la synchro passe à l'état « Reconnexion requise » ; la reconnexion Google n'est acceptée que pour le **même** `user_id`, puis la file reprend sans perte.
- **Déconnexion manuelle** :
  1. si en ligne, tenter une synchronisation complète avant de se déconnecter (loader dans la modale) ;
  2. s'il reste des éléments non synchronisés, avertir avec leur nombre et préciser qu'ils restent sur le téléphone et seront envoyés à la prochaine connexion avec ce compte ;
  3. ne **jamais supprimer** les données locales ni la `sync_queue` à la déconnexion : elles restent rattachées à leur `user_id`.
- **Changement de compte** : seules les données (lignes, `sync_queue`, `settings`) du `user_id` connecté sont lues et synchronisées ; celles d'un autre compte restent intactes et inactives jusqu'à sa reconnexion.

## 5. Gestion des erreurs

- Système de toast global et partagé : message compréhensible affiché pendant exactement **3 secondes** pour toute erreur pertinente (base locale, synchronisation, réseau, import).
- Point d'entrée unique : `reportError({ scope, message, error })` (`src/lib/errors.ts`), qui journalise le détail technique et affiche le toast ; `showToast` (`src/lib/toast.ts`) pour un message sans erreur. Utilisables hors React (moteur de synchro, import).
- Les erreurs liées à un formulaire restent affichées dans le formulaire (sous le champ ou au-dessus du bouton).
- Ne jamais ignorer silencieusement une erreur, simuler un succès ou exposer des informations sensibles (pas de montants ni de notes dans les journaux ou Sentry).
- Journaliser les détails techniques utiles et éviter les notifications en double pour une même erreur.

## 6. Audit et tests

- Avant toute modification, examiner le schéma Drizzle, les migrations, les repositories, la file de synchro et le système de toast existants ; réutiliser les mécanismes existants.
- Une écriture locale n'est déclarée réussie qu'après validation de la transaction SQLite ; une synchronisation n'est déclarée réussie qu'après confirmation de Supabase.
- Tests unitaires pour les règles métier (conversions, totaux, échéances, reste dû) et la file de synchro (relance, conflit, interruption).

## 7. Supabase CLI et migrations distantes

- Supabase est toujours installé dans le projet (Supabase CLI en devDependency, dossier `supabase/` initialisé via `supabase init` et versionné).
- Toute modification du schéma distant (tables, colonnes, index, RLS, fonctions) passe par un fichier de migration SQL enregistré dans `supabase/migrations/` (créé via `supabase migration new <nom>`), jamais par une modification manuelle dans le dashboard.
- Ces migrations Supabase sont distinctes des migrations Drizzle de la base SQLite locale ; tout changement de schéma qui touche les données synchronisées doit être reflété des deux côtés.
- Toute contrainte d’unicité (index unique, clé unique) sur une table synchronisée inclut user_id en première colonne, côté Supabase et SQLite. Une ligne d’un utilisateur ne doit jamais pouvoir bloquer ou entrer en conflit avec celle d’un autre.

## 8. Configuration et clés

- Côté app, utiliser uniquement la clé **publishable** Supabase (`sb_publishable_…`) via `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, jamais l'ancienne clé `anon` ni une clé secrète (`service_role` / `sb_secret_…`) : les variables `EXPO_PUBLIC_` sont visibles en clair dans l'APK.
- Toute nouvelle variable d'environnement : préfixe `EXPO_PUBLIC_` si lue par l'app, ajoutée vide et commentée dans `.env.example` (versionné), typée dans `src/types/env.d.ts`, lue et validée dans `src/lib/env.ts` (notation pointée, erreur explicite si manquante). Le fichier `.env` n'est jamais versionné ; les valeurs de build viennent des secrets EAS.
