# Design System & Architecture Rules

Le design system React Native est une **contrainte d'architecture**, pas une recommandation esthétique.

Toute nouvelle UI doit utiliser l'existant avant de créer quoi que ce soit de nouveau.

## 1. Architecture

Conserver une séparation claire :

```text
src/
├── design-system/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   ├── radius.ts
│   │   ├── shadows.ts
│   │   ├── motion.ts
│   │   └── index.ts
│   ├── primitives/
│   ├── components/
│   ├── theme/
│   └── index.ts
├── features/
└── screens/
```

Adapter cette structure à l'architecture existante sans restructuration massive inutile.

Dépendances autorisées uniquement dans ce sens :

```text
tokens → primitives → UI components → domain components → features → screens
```

Une couche basse ne doit jamais dépendre d'une couche haute.

---

## 2. Tokens

Centraliser toutes les valeurs récurrentes :

* colors
* spacing
* typography
* radius
* shadows
* motion

Éviter les valeurs arbitraires répétées (`padding: 17`, `fontSize: 17`, `#FF6B00`, etc.).

Utiliser les tokens :

```tsx
padding: spacing.lg
borderRadius: radius.md
color: theme.colors.primary
```

Une valeur ponctuelle est acceptable si elle est réellement spécifique au composant.

Les couleurs doivent toujours être centralisées et les thèmes doivent être compatibles avec light/dark.

---

## 3. Typographie & Layout

Centraliser les styles typographiques avec des variantes sémantiques :

```text
display, title, heading, body, bodySmall, label, caption
```

Utiliser des primitives simples et génériques pour les layouts :

```tsx
<Stack gap="lg" />
<Row gap="md" align="center" />
<Box padding="lg" />
```

Ne pas créer une primitive pour un cas particulier.

---

## 4. Composants UI

Créer des composants génériques réutilisables :

```text
Button, Input, Card, Badge, Avatar, Modal,
BottomSheet, Checkbox, Radio, Switch, Loader, EmptyState...
```

Préférer les **variants** aux composants spécialisés :

```tsx
<Button variant="primary" size="lg" />
```

Les APIs doivent être :

* simples
* cohérentes
* fortement typées
* prévisibles

Utiliser des unions TypeScript explicites plutôt que des props génériques ou ambiguës.

Les composants interactifs doivent gérer, lorsque pertinent :

```text
default / pressed / focused / disabled / loading / error / selected
```

et respecter l'accessibilité React Native (`accessibilityRole`, `accessibilityLabel`, `accessibilityState`, touch target, contraste, clavier lorsque pertinent).

---

## 5. Composants métier

Les composants métier restent dans leurs features :

```text
RecipeCard
IngredientList
MealCard
UserProfile
ShoppingList
```

Ils peuvent utiliser le design system, mais le design system ne doit jamais dépendre du métier.

---

## 6. Styles

Éviter les styles inline répétitifs.

Un style partagé doit devenir un token, un variant ou un composant du design system.

Les styles spécifiques à un composant restent dans son dossier. Ne pas créer inutilement un fichier de styles pour un composant trivial.

---

## 7. Export

Le design system doit avoir un point d'entrée central :

```ts
@/design-system
```

Exporter les tokens, primitives et composants publics depuis `design-system/index.ts`.

Préférer :

```tsx
import { Button, Card, Text, Stack } from '@/design-system';
```

aux imports profonds lorsque l'export central existe.

---

## 8. Règle de réutilisation

Avant de créer ou modifier une UI :

1. Chercher l'existant.
2. Réutiliser les tokens.
3. Réutiliser les primitives.
4. Réutiliser les composants.
5. Ajouter/modifier un variant si suffisant.
6. Créer un composant seulement si nécessaire.
7. Déterminer s'il est générique ou métier.
8. Le placer dans la bonne
