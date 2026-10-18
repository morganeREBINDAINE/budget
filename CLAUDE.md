# Règles projet

## Workflow

- Exécuter les tâches du `docs/PLAN.md` une par une. En PHASE 1, ne prendre qu'une seule tâche (ex: "Init projet Expo + configuration TypeScript"). Une fois terminée, cocher la case et attendre la demande de continuer.
- Il faut commit à la fin de toute tâche terminée.
- Pour tout commit, utiliser les conventions de nommage classiques : type(scope): description — ex. feat(auth): add login screen, avec les types classiques feat, fix, docs, refactor, test et chore..
- Réfère toi toujours aux bonnes pratiques d'architecture de projet React Native.
- Affiche toujours dans l'application les erreurs liées aux données entrées dans les formulaires, ainsi que liées aux requêtes asynchrones.
- Pour toute opération de base de données, consulter `docs/STORAGE.md` et t'y conformer.
- Avant toute implémentation de fonctionnalité, vérifie le code actuel, prépare un plan (en indiquant aussi les modifications nécessaires de PLAN.md si besoin pour coller aux décisions prises), fais le moi valider et propose moi les choix architecturaux si il y en a. En cas de doute sur les détails d'une tâche, demande moi toujours confirmation, pose le plus de questions possible (sauf en cas de petite tâche de modification mineure). Ne modifie jamais de code sans mon feu vert.
- Une action utilisateur qui nécessite une requête asynchrone doit afficher un loader (spinner dans le bouton ou overlay selon le contexte) jusqu’à obtention de la réponse. Le trigger doit être bloqué tant que la requête est en cours, via un garde dans le handler et pas seulement disabled.
- Ne teste pas l'affichage des pages et composants ni les fonctionnalités qui nécessitent une connexion à internet. Décris moi les tests à effectuer manuellement, et je le fais moi même.
- En cas de doute sur les détails d'une tâche, demande moi toujours confirmation.

## Design System (OBLIGATOIRE)

Avant toute création ou modification de code UI, dans cet ordre :
1. Lire `src/design-system/README.md` → vérifier si un composant/token existant couvre le besoin
2. Consulter `docs/DESIGN.md` pour les tokens visuels (couleurs, typo, spacing, radius, shadows)
3. Consulter `docs/DESIGN_SYSTEM.md` pour l'architecture et les conventions

Règles strictes :
- Jamais de couleurs hex, spacing ou fontSize en dur dans les écrans ou features
- Imports depuis `@/design-system` uniquement
- Hiérarchie : tokens → primitives → composants UI → composants métier → features → screens
- Une couche basse ne dépend jamais d'une couche haute
- TypeScript strict

Après toute création, suppression ou modification dans `src/design-system/` :
- Mettre à jour `src/design-system/README.md` (liste des tokens, primitives, composants UI avec variants et props)

Quand `docs/PLAN.md` fournit un lien vers un fichier HTML (ex: `./assets/aliments_liste.html`), l'utiliser comme référence visuelle exacte et itérer jusqu'à reproduire le même résultat dans l'app.

Si il faut créer de nouveaux écrans ou composants, utilise toujours le skill ui-ux-pro-max pour t'aider à garder la cohérence avec le style actuel.

Tout écran ou composant qui contient un champ de saisie (Input, TextArea, QuantityField, TextInput…) doit utiliser FormScrollView de @/design-system à la place de ScrollView ou KeyboardAvoidingView, pour que le champ en cours de saisie reste toujours visible au-dessus du clavier. Exception : si l'écran contient une liste longue (voir « Listes longues »), utiliser FormSectionList de @/design-system (ou un équivalent virtualisé) à la place de FormScrollView.

## Requêtes asynchrones et tâches de fond (OBLIGATOIRE)

Pour toutes les requêtes asynchrones, les règles suivantes s'appliquent :
- Afficher un loader (spinner dans le bouton ou overlay selon le contexte) jusqu'à obtention de la réponse.
- Le trigger doit être bloqué tant que la requête est en cours, via un garde dans le handler et pas seulement disabled.
- Si la requête échoue, afficher une erreur claire à l'utilisateur.
- Si la requête doit être retry, utiliser trigger.dev.

### Avant de créer un nouveau composant UI

1. Lire `src/design-system/README.md`
2. Chercher si un existant couvre le besoin (même via variant)
3. Chercher si un token existant correspond
4. Seulement alors créer — générique → `design-system/` | métier → `features/`
5. Si création dans `design-system/` → mettre à jour le README.md

## Synchronisation des données (OBLIGATOIRE)

Toute donnée enregistrée en base (création, modification, suppression) doit être liée au compte utilisateur connecté, quel que soit le mode d'authentification (email/password, OAuth Google, OAuth Apple, etc.).

Règles :
Chaque écriture en base inclut le userId du compte connecté
Un changement de compte déclenche un rechargement complet des données du nouveau compte

## Sauvegarde des images

Pour sauvegarder les images, utiliser l'API de ImageKit.

## Tâches de fond, asynchrone, planifiées ou avec retry

Si besoin de tâches en arrière-plan, planifier des tâches régulières, ou politique de retry, utilise trigger.dev.

## Authentification (OBLIGATOIRE)

- Connexion Google sur iOS/Android : toujours en natif avec `@react-native-google-signin/google-signin` (`GoogleSignin.signIn()` → `idToken`) puis `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`. Le sélecteur de compte doit être la modale native du système.
- Interdit sur mobile : `supabase.auth.signInWithOAuth`, `expo-web-browser` / `openAuthSessionAsync`, `expo-auth-session` et toute redirection vers une page web ou un deep link de callback.
- Conséquence assumée : l'app nécessite un development build (pas Expo Go).

## Listes longues (OBLIGATOIRE)

- Toute liste dont le nombre d'éléments peut grandir (données utilisateur, base de référence, résultats de recherche) doit être virtualisée : seuls les éléments visibles sont rendus, les suivants au fil du défilement (ex. FlatList / SectionList en React Native, jamais un ScrollView avec .map()).
- Lors du plan d'une fonctionnalité, signaler chaque liste concernée et le mode d'affichage proposé (virtualisée, repliée, recherche minimale avant affichage…), et le faire valider avant d'implémenter.