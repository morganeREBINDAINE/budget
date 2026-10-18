# Règle — SQLite local source de vérité, Supabase sauvegarde synchronisée

Modèle hors ligne d'abord, aligné sur `docs/PLAN.md` (phases 3 et 6).

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
- **Conflits** : la modification la plus récente gagne (`updated_at`).
- **Déclencheurs** : démarrage de l'app, retour du réseau, retour au premier plan, après chaque écriture si en ligne, tâche de fond (`expo-background-task`), bouton « Synchroniser ».
- Un verrou empêche deux synchronisations simultanées ; échecs relancés avec délais croissants, `last_error` conservée.
- L'état (en attente, en cours %, à jour, erreur) est exposé par un store unique, affiché sur la page Compte.

## 4. Gestion des erreurs

- Système de toast global et partagé : message compréhensible affiché pendant exactement **3 secondes** pour toute erreur pertinente (base locale, synchronisation, réseau, import).
- Les erreurs liées à un formulaire restent affichées dans le formulaire (sous le champ ou au-dessus du bouton).
- Ne jamais ignorer silencieusement une erreur, simuler un succès ou exposer des informations sensibles (pas de montants ni de notes dans les journaux ou Sentry).
- Journaliser les détails techniques utiles et éviter les notifications en double pour une même erreur.

## 5. Audit et tests

- Avant toute modification, examiner le schéma Drizzle, les migrations, les repositories, la file de synchro et le système de toast existants ; réutiliser les mécanismes existants.
- Une écriture locale n'est déclarée réussie qu'après validation de la transaction SQLite ; une synchronisation n'est déclarée réussie qu'après confirmation de Supabase.
- Tests unitaires pour les règles métier (conversions, totaux, échéances, reste dû) et la file de synchro (relance, conflit, interruption).
