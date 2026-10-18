# Design system — registre

Sources : `docs/DESIGN.md` (tokens visuels), `docs/DESIGN_SYSTEM.md` (architecture), maquette `assets/maquettes/accueil/code.html`.

Import unique : `import { Button, Card, Text, useTheme } from '@/design-system';`

Hiérarchie : `tokens → theme → primitives → components`. Une couche basse n'importe jamais une couche haute. Aucun composant métier ici.

## Tokens (`tokens/`)

| Fichier | Export | Valeurs |
| --- | --- | --- |
| `colors.ts` | `palette` | slate 50–900, indigo 50/500/600/700, emerald 50/500/600/700, rose 50/500/600, orange/blue/violet/cyan/amber/fuchsia 600, `backdrop`, white, black, transparent |
| | `categoryColors` | nuancier arc-en-ciel vif : `red` #EF4444, `orange` #F97316, `amber` #F59E0B, `lime` #84CC16, `green` #22C55E, `cyan` #06B6D4, `blue` #3B82F6, `violet` #8B5CF6, `pink` #EC4899 |
| | `categoryRainbow` | les mêmes couleurs en tableau, dans l'ordre du spectre (catégorie position 1 → 9) |
| `spacing.ts` | `spacing` | none 0, xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32 |
| | `screenPadding` | 20 (marge latérale d'écran) |
| | `minTouchTarget` | 48 |
| `radius.ts` | `radius` | none 0, sm 8, md 12, lg 16, xl 24, xxl 32, full 9999 |
| `typography.ts` | `fontFamily` | regular, medium, semibold, bold, extrabold (Plus Jakarta Sans) |
| | `typography` | `display` 32/800, `title` 18/700, `heading` 16/700, `body` 14/500, `bodySmall` 12/400, `label` 12/700 uppercase, `caption` 11/600 |
| `shadows.ts` | `shadows` | none, xs, sm, card, soft, float, floatGreen (`boxShadow`) |
| `motion.ts` | `motion` | `duration` fast 150 / base 250 / slow 400 ; `easing` standard / decelerate / accelerate (bezier) ; `pressScale` 0.98 |

Les écrans n'utilisent pas `palette` directement : passer par `useTheme().colors`.

## Thème (`theme/`)

- `lightTheme` : `{ scheme, colors, categoryColors, spacing, radius, typography, shadows, motion }`.
- `darkTheme` : copie du thème clair (TODO, pas de design sombre en v1).
- `ThemeProvider` (`scheme?: 'light' | 'dark'`, défaut `light`) : monté dans `src/app/_layout.tsx`.
- `useTheme()` : renvoie le thème courant.

Couleurs sémantiques (`ThemeColor`) : `background`, `surface`, `surfaceMuted`, `border`, `borderSubtle`, `backdrop`, `text`, `textStrong`, `textSecondary`, `textMuted`, `textOnColor`, `primary`, `primarySoft`, `onPrimary`, `success`, `successStrong`, `successSoft`, `danger`, `dangerSoft`, `neutralStrong`, `neutralStrongPressed`, `transparent`.

## Primitives (`primitives/`)

| Composant | Props (en plus des props RN) |
| --- | --- |
| `Box` | `padding`, `paddingX`, `paddingY`, `margin`, `marginX`, `marginY`, `gap` (`SpacingToken`) ; `bg`, `borderColor` (`ThemeColor`, bordure 1px) ; `radius` (`RadiusToken`) ; `shadow` (`ShadowToken`) ; `flex`, `direction`, `align`, `justify`, `wrap` |
| `Stack` | props de `Box` sans `direction` (colonne) |
| `Row` | props de `Box` sans `direction` (ligne, `align="center"` par défaut) |
| `Text` | `variant` (`TypographyVariant`, défaut `body`), `color` (`ThemeColor`, défaut `text`), `weight` (`FontWeightToken`), `align`, `tabular` (chiffres à chasse fixe) |

## Composants UI (`components/`)

### Button
- `variant` : `primary` (vert emerald, CTA), `secondary` (slate-900), `outline` (blanc + bordure), `ghost` (transparent).
- `size` : `sm` (40px + hitSlop), `md` (48px, défaut), `lg` (56px).
- Props : `label` (requis), `onPress` (`() => void | Promise`), `loading`, `disabled`, `fullWidth`, `leftIcon`, `rightIcon`, `style`.
- États : pressed (fond plus foncé + scale 0.98), disabled (opacité 0.5), loading (spinner).
- Si `onPress` renvoie une Promise : spinner automatique, et un garde dans le handler ignore les appuis jusqu'à la résolution.

### Card
- `variant` : `elevated` (ombre `card`, défaut), `flat` (sans ombre).
- Surface blanche, bordure `borderSubtle`. `padding` (défaut `lg`) et `radius` (défaut `lg`) acceptent les tokens ; les autres props sont celles de `Box`.

### Input
- Props : `label` (libellé uppercase), `hint`, `error` (bordure rouge + message), `disabled`, `leftIcon`, `rightIcon`, plus les props de `TextInput`.
- États : focus (bordure `primary`), error, disabled. Hauteur min. 48px.
- Dans un écran, le placer dans `FormScrollView` (à créer).

### Badge
- `variant` : `neutral` (défaut), `primary`, `success`, `danger`.
- Props : `label`, `icon`. Pastille pilule en `caption` gras.
