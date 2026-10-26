# Design system — registre

Sources : `docs/DESIGN.md` (tokens visuels), `docs/DESIGN_SYSTEM.md` (architecture), maquette `assets/maquettes/accueil/code.html`.

Import unique : `import { Button, Card, Text, useTheme } from '@/design-system';`

Hiérarchie : `tokens → theme → primitives → components`. Une couche basse n'importe jamais une couche haute. Aucun composant métier ici.

## Tokens (`tokens/`)

| Fichier         | Export            | Valeurs                                                                                                                                                                                                                                          |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `colors.ts`     | `palette`         | slate 50–900, indigo 50/500/600/700, emerald 50/500/600/700, rose 50/500/600, yellow 300/400, orange/blue/violet/cyan/amber/fuchsia 600, `backdrop`, `whiteTranslucent`, white, black, transparent                                               |
|                 | `categoryColors`  | nuancier arc-en-ciel vif : 12 couleurs : `red` #EF4444, `orange` #F97316, `amber` #F59E0B, `yellow` #EAB308, `lime` #84CC16, `green` #22C55E, `teal` #14B8A6, `cyan` #06B6D4, `blue` #3B82F6, `indigo` #6366F1, `violet` #8B5CF6, `pink` #EC4899 |
|                 | `brandColors`     | logo Google officiel : `googleBlue`, `googleRed`, `googleYellow`, `googleGreen` (réservées aux logos de marque)                                                                                                                                  |
|                 | `categoryRainbow` | les mêmes couleurs en tableau, dans l'ordre du spectre (nuancier des 12 catégories)                                                                                                                                                              |
| `spacing.ts`    | `spacing`         | none 0, xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32                                                                                                                                                                                  |
|                 | `screenPadding`   | 20 (marge latérale d'écran)                                                                                                                                                                                                                      |
|                 | `minTouchTarget`  | 48                                                                                                                                                                                                                                               |
| `radius.ts`     | `radius`          | none 0, sm 8, md 12, lg 16, xl 24, xxl 32, full 9999                                                                                                                                                                                             |
| `typography.ts` | `fontFamily`      | regular, medium, semibold, bold, extrabold (Plus Jakarta Sans)                                                                                                                                                                                   |
|                 | `typography`      | `display` 32/800, `title` 18/700, `heading` 16/700, `body` 14/500, `bodyCompact` 13/600, `bodySmall` 12/400, `label` 12/700 uppercase, `caption` 11/600                                                                                          |
| `shadows.ts`    | `shadows`         | none, xs, sm, card, soft, float, floatGreen, floatAccent (`boxShadow`)                                                                                                                                                                           |
| `motion.ts`     | `motion`          | `duration` fast 150 / base 250 / slow 400 ; `easing` standard / decelerate / accelerate (bezier) ; `pressScale` 0.98                                                                                                                             |

Les écrans n'utilisent pas `palette` directement : passer par `useTheme().colors`.

## Thème (`theme/`)

- `lightTheme` : `{ scheme, colors, categoryColors, spacing, radius, typography, shadows, motion }`.
- `darkTheme` : copie du thème clair (TODO, pas de design sombre en v1).
- `ThemeProvider` (`scheme?: 'light' | 'dark'`, défaut `light`) : monté dans `src/app/_layout.tsx`.
- `useTheme()` : renvoie le thème courant.

Couleurs sémantiques (`ThemeColor`) : `background`, `surface`, `surfaceMuted`, `border`, `borderSubtle`, `backdrop`, `overlayOnColor` (voile blanc 20 % sur fond coloré), `text`, `textStrong`, `textSecondary`, `textMuted`, `textOnColor`, `primary`, `primarySoft`, `onPrimary`, `success`, `successStrong`, `successSoft`, `accent`, `accentPressed`, `danger`, `dangerSoft`, `neutralStrong`, `neutralStrongPressed`, `transparent`.

## Primitives (`primitives/`)

| Composant | Props (en plus des props RN)                                                                                                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Box`     | `padding`, `paddingX`, `paddingY`, `margin`, `marginX`, `marginY`, `gap` (`SpacingToken`) ; `bg`, `borderColor` (`ThemeColor`, bordure 1px) ; `radius` (`RadiusToken`) ; `shadow` (`ShadowToken`) ; `flex`, `direction`, `align`, `justify`, `wrap` |
| `Stack`   | props de `Box` sans `direction` (colonne)                                                                                                                                                                                                           |
| `Row`     | props de `Box` sans `direction` (ligne, `align="center"` par défaut)                                                                                                                                                                                |
| `Text`    | `variant` (`TypographyVariant`, défaut `body`), `color` (`ThemeColor`, défaut `text`), `weight` (`FontWeightToken`), `align`, `tabular` (chiffres à chasse fixe)                                                                                    |

## Composants UI (`components/`)

### Button

- `variant` : `primary` (vert emerald, CTA), `secondary` (slate-900), `outline` (blanc + bordure), `ghost` (transparent), `danger` (fond rose clair, texte rouge : suppression).
- `size` : `sm` (40px + hitSlop), `md` (48px, défaut), `lg` (56px).
- Props : `label` (requis), `onPress` (`() => void | Promise`), `loading`, `disabled`, `fullWidth`, `leftIcon`, `rightIcon`, `style`.
- États : pressed (fond plus foncé + scale 0.98), disabled (opacité 0.5), loading (spinner).
- Si `onPress` renvoie une Promise : spinner automatique, et un garde dans le handler ignore les appuis jusqu'à la résolution.

### Card

- `variant` : `elevated` (ombre `card`, défaut), `flat` (sans ombre), `muted` (fond `surfaceMuted`, sans ombre : élément inactif ou archivé, ex. dette soldée).
- Surface blanche, bordure `borderSubtle`. `padding` (défaut `lg`) et `radius` (défaut `lg`) acceptent les tokens ; les autres props sont celles de `Box`.

### Input

- Props : `label` (libellé uppercase), `hint`, `error` (bordure rouge + message), `disabled`, `leftIcon`, `rightIcon`, plus les props de `TextInput`.
- États : focus (bordure `primary`), error, disabled. Hauteur min. 48px.
- Dans un écran, le placer dans `FormScrollView`.

### Badge

- `variant` : `neutral` (défaut), `primary`, `success`, `danger`.
- Props : `label`, `icon`. Pastille pilule en `caption` gras.

### FormScrollView

- `KeyboardAwareScrollView` (react-native-keyboard-controller) : le champ en cours de saisie reste visible au-dessus du clavier.
- Défauts : `bottomOffset` = `spacing.xxl`, `keyboardShouldPersistTaps="handled"`, sans indicateur de défilement. Accepte toutes les props de `ScrollView`.
- Nécessite `KeyboardProvider` (monté dans `src/app/_layout.tsx`).

### FormSectionList

- `SectionList` virtualisée dont le défilement passe par `KeyboardAwareScrollView` : à utiliser à la place de `FormScrollView` quand l'écran contient des champs **et** une liste longue (ex. formulaire en `ListHeaderComponent`, remboursements en lignes).
- Défauts : `bottomOffset` = `spacing.xxl`, `keyboardShouldPersistTaps="handled"`, sans indicateur de défilement, en-têtes de section non collants. Accepte toutes les props de `SectionList`.

### Sheet

- Feuille modale qui monte du bas sur un fond assombri (`backdrop`), coins hauts `radius.xxl`, marge basse = safe area.
- Props : `onClose` (appelé après l'animation de sortie, ex. `router.back()`), `heightRatio` (défaut 2/3), `children`.
- Fermeture : toucher du fond, bouton retour Android, ou `useSheet().close()` depuis le contenu (croix, après enregistrement). Jamais au glissement : le contenu défile librement.
- À rendre dans une route `presentation: 'transparentModal'`, `animation: 'none'`, `gestureEnabled: false`.

### Drawer

- Tiroir qui glisse depuis la gauche sur un fond assombri (`backdrop`), coins droits `radius.xxl`, marges haute et basse = safe area.
- Props : `open` (contrôlé), `onClose` (fond touché, bouton retour Android), `widthRatio` (défaut 0,8), `children`.
- Reste monté le temps de l'animation de sortie. Pas d'ouverture au glissement depuis le bord (pas de conflit avec les gestes horizontaux des écrans).
- À rendre par-dessus la pile de navigation (ex. un provider autour du `Stack`).

### ListItem

- Ligne d'action d'une liste courte (réglages, menu) : pastille d'icône 40px, libellé, description facultative, chevron « › ».
- `variant` : `default` (pastille `primarySoft`, texte `text`), `danger` (pastille `dangerSoft`, texte `danger` : déconnexion).
- Props : `label` (requis), `description`, `icon` (`ReactNode`, posé sur la pastille), `iconBackground` (`variant` par défaut, `none` : pas de pastille, pour une icône qui a déjà son fond, ex. tuile de catégorie), `onPress` (`() => void | Promise`), `showChevron` (défaut : affiché si `onPress`), `disabled`.
- Si `onPress` renvoie une Promise : spinner à la place du chevron, et un garde ignore les appuis jusqu'à la résolution.
- Pour plusieurs lignes, les grouper dans une `Card padding="xs"`. Listes courtes et fixes uniquement (pas de virtualisation).

### ConfirmDialog

- Modale centrée sur un fond assombri, carte blanche `radius.xl`, titre + message, bouton de confirmation et « Annuler » (`ghost`).
- Props : `visible`, `title`, `message`, `confirmLabel` (défaut « Confirmer »), `cancelLabel` (défaut « Annuler »), `variant` (`primary` → bouton noir, `danger` → bouton rouge), `onConfirm` (`() => void | Promise`), `onCancel`, `error` (message rouge géré par l'appelant), `children` (contenu additionnel, ex. un champ date).
- Si `onConfirm` renvoie une Promise : spinner dans le bouton, garde contre les doubles appuis, fermeture (Annuler, fond, retour Android) bloquée jusqu'à la résolution. L'appelant ferme la modale (`visible=false`) en cas de succès.
- Remonte au-dessus du clavier (`KeyboardAvoidingView` de react-native-keyboard-controller) : un champ (`Input`) peut être passé en `children` sans `FormScrollView`.

### ScreenHeader

- Barre haute des écrans secondaires (Catégories, éditeurs…) : bouton rond retour (flèche, 48px) à gauche, titre `title` centré sur une ligne, emplacement de 48px à droite.
- Props : `title` (requis), `onBack` (requis, ex. `router.back`), `backLabel` (défaut « Retour », accessibilité), `right` (`ReactNode`, action facultative).
- Les écrans principaux (accueil, dettes, compte) utilisent `AppHeader` (burger + logo), pas celui-ci.

### Fab

- Bouton rond flottant de 64px, icône seule (Material Community Icons, 32px).
- `variant` : `neutral` (slate-900, ombre `sm`, défaut), `accent` (jaune, ombre `floatAccent`).
- Props : `icon` (requis), `label` (requis, accessibilité), `onPress`, `variant`, `style` (positionnement absolu laissé à l'appelant).
- `FAB_AREA_HEIGHT` : marge basse à réserver dans une liste pour ne pas masquer le dernier élément.

### Menu

- Petit menu ancré sous son déclencheur (aligné sur son bord droit), carte `surface` `radius.xl`, bordure `borderSubtle`, ombre `soft`, largeur min. 200px, fond transparent. Options de 48px de haut, libellé `body`, option cochée en `primary` gras avec une coche à droite.
- Props : `items` (`{ value, label }[]`), `value` (option cochée, facultative), `onSelect`, `renderTrigger` (`(open) => ReactNode`, ex. un bouton icône qui appelle `open`), `label` (accessibilité de la liste). Générique sur le type de `value`.
- Fermeture : choix d'une option, toucher en dehors ou bouton retour Android.
- Usage : choix de la vue de l'accueil (bouton œil de `AppHeader`). Listes courtes et fixes uniquement.

### SegmentedControl

- Choix exclusif entre 2 ou 3 options sur une piste `surfaceMuted` ; option active sur fond blanc, ombre `xs`. Hauteur min. 48px.
- Props : `options` (`{ value, label }[]`), `value`, `onChange`, `label` (libellé uppercase facultatif). Générique sur le type de `value`.
- Usages : fréquence Mensuel / Annuel, onglets Je dois / On me doit.

### Switch

- Interrupteur oui / non : piste `success` si activé, `border` sinon, pouce blanc.
- Props : `value`, `onValueChange`, `disabled`, `label`, `description`.
- Avec `label` : ligne complète touchable (libellé `heading` + description à gauche, interrupteur à droite, hauteur min. 48px). Sans `label` : interrupteur seul.

### Avatar

- Pastille ronde aux initiales (pas de photo).
- `size` : `sm` (40px, texte `heading`, défaut), `lg` (56px, texte `title`).
- `variant` : `primary` (fond indigo, texte blanc, défaut), `neutral` (fond `primarySoft`, texte `primary`).
- Props : `initials` (requis, déjà calculées, ex. `initials(name)` de `@/lib/format`), `size`, `variant`.

### Toast

- Bandeau de message temporaire, visuel seul : coins `radius.lg`, icône + texte blanc `body`, ombre `sm`, hauteur min. 48px, annoncé aux lecteurs d'écran (`accessibilityRole="alert"`).
- `variant` : `error` (fond `danger`, icône alerte, défaut), `info` (fond `neutralStrong`, icône information).
- Props : `message` (requis), `variant`.
- Ne pas l'afficher directement : passer par `reportError` (`@/lib/errors`) ou `showToast` (`@/lib/toast`). Le `ToastHost` monté à la racine gère la file, la durée (3 s) et les doublons.

### Skeleton

- Bloc gris (`surfaceMuted`) pulsant qui remplace une donnée pendant son chargement (pull initial, premier chargement) : montant, ligne de liste, graphique. Pulsation d'opacité (`motion.duration.slow` × 2, aller-retour), coupée si l'utilisateur a réduit les animations.
- Props : `width` (px ou %, défaut 100 %), `height` (px, défaut 16), `text` (`TypographyVariant` : ligne de texte factice à la taille de la police, centrée dans la hauteur de ligne), `circle` (diamètre : pastille, anneau), `radius` (`RadiusToken`, défaut `sm`), `style`.
- Masqué aux lecteurs d'écran : le conteneur de la zone en chargement porte l'annonce (`accessibilityRole="progressbar"`, ex. `LoadingRegion` de `features/sync`).
- Ne remplacer que les parties variables : la mise en page, les titres et les éléments fixes restent visibles (règle de `CLAUDE.md`, « Requêtes asynchrones »).
