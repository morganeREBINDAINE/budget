# Règle — Supabase source de vérité, AsyncStorage cache

## 1. Principes

- Supabase est l'unique source de vérité. AsyncStorage conserve uniquement le dernier état confirmé par le cloud.
- Hors ligne, autoriser la lecture du cache, mais refuser toute création, modification ou suppression.
- À la connexion, récupérer les données Supabase et actualiser le cache.

## 2. Écritures

- Envoyer les écritures à Supabase et attendre leur confirmation avant d'actualiser le cache et l'interface.
- En cas d'échec, conserver l'état précédent.
- Si le résultat d'une requête est ambigu, vérifier l'état réel du cloud avant de conclure.
- Ne créer aucune file d'attente de synchronisation locale.

## 3. Synchronisation

- Centraliser la récupération des données et l'actualisation du cache.
- Synchroniser uniquement à la connexion et à la demande de l'utilisateur (bouton « Synchroniser maintenant »). Au lancement de l'application, afficher le cache sans requête (récupération unique si le cache du compte est vide). Aucune synchronisation au renouvellement de session ni à la reprise de l'application.
- Isoler les données par utilisateur.

## 4. Gestion des erreurs

- Utiliser un système de toast global et partagé.
- Afficher un message flottant compréhensible pendant exactement **3 secondes** pour toute erreur pertinente, y compris les erreurs réseau.
- Ne jamais ignorer silencieusement une erreur, simuler un succès ou exposer des informations sensibles.
- Journaliser les détails techniques utiles et éviter les notifications en double pour une même erreur.

## 5. Audit et tests

Avant toute modification, examiner l'architecture existante, les services de persistance, le schéma Supabase, le trigger de seed et le ystème de notifications. Réutiliser les mécanismes existants.

Ne déclarer une opération réussie qu'après confirmation du cloud ou vérification de son état réel.