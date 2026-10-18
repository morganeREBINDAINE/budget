# Design System — Application Budget Mobile (Hors-Ligne)

Document de référence de l'identité visuelle, de la charte graphique, des composants UI, de la typographie, des palettes de couleurs et des règles d'expérience utilisateur (UX) pour l'application mobile de gestion de budget personnel en dinars algériens (**DA**).

---

## 1. Vision & Principes Directeurs

- **Simplicité & Efficacité Immédiate** : Application 100% autonome et hors-ligne (*local-first*), exempte de surcharge cognitive, centrée sur la saisie ultra-rapide et la visualisation claire des flux financiers.
- **Accessibilité & Confort Visuel** : Des contrastes élevés, des typographies lisibles à une main sur mobile, des boutons tactiles généreux (`min-h-[48px]`), et une hiérarchie visuelle claire.
- **Palette Saturée & Reconnaissance Intuitive** : Remplacement des tons délavés ou pastels par des teintes profondes, saturées et distinctives associées aux émojis système pour une mémorisation immédiate de chaque catégorie de dépense.
- **Monnaie & Localisation** : Notation explicite en Dinars Algériens (**DA**), montants formatés avec séparateurs de milliers (ex: `165.000 DA`, `+320.000 DA`).

---

## 2. Palette de Couleurs

### 2.1 Couleurs d'Interface & Neutres (Light Theme Principal)
| Rôle | Nom / Token | Valeur Hex / CSS | Usage |
| :--- | :--- | :--- | :--- |
| **Fond d'application** | `bg-app` | `#F8FAFC` (Slate-50) | Arrière-plan global de l'écran |
| **Cartes & Surfaces** | `bg-surface` | `#FFFFFF` (White) | Cartes de synthèses, modale, conteneurs |
| **Texte Principal** | `text-primary` | `#0F172A` (Slate-900) | Titres, montants principaux, labels forts |
| **Texte Secondaire** | `text-secondary` | `#64748B` (Slate-500) | Sous-titres, dates, légendes, libellés discrets |
| **Bordures & Séparateurs**| `border-subtle` | `#E2E8F0` (Slate-200) | Lignes de séparation, contours de cartes |
| **Overlay Fond (Modale)** | `bg-backdrop` | `rgba(15, 23, 42, 0.65)` | Voile sombre avec `backdrop-blur-sm` lors de l'ouverture du Bottom Sheet |

### 2.2 Couleurs Fonctionnelles
| Action / Statut | Nom / Token | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Entrées / Succès** | `brand-green` | `#10B981` / `#059669` | Bouton d'action principal, badge des entrées d'argent |
| **Accent / Branding** | `brand-indigo` | `#4F46E5` / `#4338CA` | Logo de l'application, highlights de navigation, badges |
| **Dépenses / Alertes** | `brand-rose` | `#E11D48` / `#F43F5E` | Montants négatifs, alertes de dépassement |

### 2.3 Couleurs Profondes des Catégories (Couleurs Saturées du Graphique)
Chaque catégorie dispose d'une couleur d'accent profonde et vibrante :

| Catégorie | Émoji | Couleur Primaire | Code Hex | Tailwind Equivalent |
| :--- | :---: | :--- | :--- | :--- |
| **Alimentation & Courses** | 🛒 | Vert Émeraude Profond | `#059669` | `emerald-600` |
| **Restaurants & Sorties** | 🍽️ | Orange Ambré Chaud | `#EA580C` | `orange-600` |
| **Transport** | 🚗 | Bleu Indigo Intense | `#2563EB` | `blue-600` |
| **Abonnements & Télécom** | 📱 | Violet Électrique | `#7C3AED` | `violet-600` |
| **Éducation & Livres** | 🎓 | Cyan Turquoise Foncé | `#0891B2` | `cyan-600` |
| **Santé & Pharmacie** | 💊 | Rouge Cramoisi Vibrant | `#E11D48` | `rose-600` |
| **Factures & Logement** | 🧾 | Jaune Ambre Foncé | `#D97706` | `amber-600` |
| **Loisirs & Jeux** | 🎮 | Fuchsia / Magenta | `#C026D3` | `fuchsia-600` |
| **Autre & Imprévus** | 📦 | Ardoise Foncé | `#475569` | `slate-600` |
| **Revenus / Salaires** | 💰 | Vert Menthe Foncé | `#047857` | `emerald-700` |

---

## 3. Typographie

- **Famille de police** : Système sans-serif moderne, géométrique et lisible : `Plus Jakarta Sans`, `Inter`, ou la police système iOS/Android (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`).
- **Échelle typographique** :
  - **Display / Montants Clés** : `text-3xl` à `text-4xl` (32px - 36px), `font-extrabold` (ex: `15.300 DA`, `165.000 DA`).
  - **Titres H1 / En-têtes** : `text-lg` à `text-xl` (18px - 20px), `font-bold`.
  - **Titres H2 / Sections** : `text-base` (16px), `font-bold` (ex: section "Détail").
  - **Labels & Formulaires** : `text-xs` (12px), `font-bold`, `tracking-wider`, `uppercase` pour les libellés de champs (ex: `MONTANT`, `DATE`, `NOTE (OPTIONNELLE)`).
  - **Corps de texte / Descriptions** : `text-sm` (14px), `font-medium` ou `font-normal`.
  - **Micro-copies / Légendes** : `text-xs` (11px - 12px), `font-normal` ou `font-semibold`.

---

## 4. Iconographie

- **Icônes d'action & structurelles** : Icônes vectorielles épurées au trait (style Heroicons / Lucide), épaisseur de contour 2px (`stroke-width: 2`), taille 20x20px ou 24x24px.
  - Export / Téléchargement : `arrow-down-tray` / `tray-arrow-down`
  - Navigation mensuelle : `chevron-left` et `chevron-right`
  - Calendrier : `calendar-days`
  - Fermeture : `x-mark`
  - Ajout / Action : `plus`
- **Icônes des Catégories** : **Émojis standards natifs** universels (`🛒`, `🍽️`, `📱`, `🚗`, `💊`, `🎓`, `🧾`, `🎮`, `📦`), intégrés dans des pastilles arrondies aux couleurs saturées.

---

## 5. Composants UI Clés

### 5.1 En-tête Supérieur (*Top App Bar*)
- **Layout** : Hauteur compacte (56px à 64px), `px-4 py-3`, éléments alignés au centre vertical.
- **Composants** :
  - Logo au centre (icône géométrique violette + label applicatif "Budget").
  - Bouton d'export/sauvegarde à droite (bouton circulaire blanc avec ombre légère ou contour subtil).

### 5.2 Sélecteur de Mois
- Bouton central indiquant le mois et l'année (ex: `📅 Mars 2025`).
- Encadré par deux boutons circulaires discrets (`chevron-left` et `chevron-right`) avec feedback haptique/actif pour le défilement chronologique.

### 5.3 Cartes de Synthèse (Entrées & Dépenses)
- Disposition en 2 colonnes (`grid grid-cols-2 gap-3`).
- Fond blanc, coins arrondis `rounded-2xl`, bordure subtile `border border-slate-100`, ombre douce `shadow-sm`.
- Indicateur de tendance : Flèche ascendante/descendante dans une pastille colorée (`bg-emerald-50 text-emerald-600` pour entrées).

### 5.4 Graphique Donut (Répartition Mensuelle)
- **Visualisation** : Anneau segmenté SVG avec épaisseur de trait calibrée (`stroke-width: 14-18px`).
- **Segments** : Proportionnels aux montants dépensés par catégorie, reprenant les couleurs saturées définies.
- **Centre du Donut** : Total dépensé affiché en gras avec le rappel du budget cible (`sur 250.000 DA`) et pourcentage d'avancement.
- **Tooltip flottant interactif** : Pastille sombre affichant la catégorie ciblée et sa part relative (ex: `• Nourriture 21%`).

### 5.5 Grille de Catégories (Modale Bottom Sheet)
- Grille carrée responsive (`grid-cols-3 gap-3`).
- Chaque tuile est carrée (`aspect-square`), avec coins arrondis `rounded-2xl`.
- Contenu intérieur :
  - Pastille d'émoji saturée en haut.
  - Libellé textuel clair et lisible centré en bas.
- État actif / sélectionné : Contour prononcé, ombre portée colorée ou fond plein distinctif.

### 5.6 Modale Bottom Sheet (Ajout Dépense / Entrée)
- Voile d'ombrage assombri semi-transparent (`backdrop-blur-sm`).
- Feuille surgissant depuis le bas avec coins supérieurs très arrondis (`rounded-t-[32px]`).
- Tirette de glissement centrale (*drag handle*) pour affirmer l'aspect gestuel mobile.
- Champ de saisie numérique géant centré pour une frappe rapide du montant.
- Bouton CTA plein en bas d'écran (`bg-emerald-600`, texte blanc, `w-full py-4 rounded-xl`, `font-bold`).

### 5.7 Boutons Flottants d'Action Rapide (Accueil)
- Pas de barre de navigation basse encombrante.
- Deux boutons d'action flottants ou un double bouton proéminent en bas d'écran pour déclencher instantanément :
  - `+ Entrée` (Revenu)
  - `+ Dépense` (Paiement)

---

## 6. Règles d'Accessibilité & Ergonomie Mobile (One-Hand Rule)

1. **Zone de pouce (*Thumb Zone*)** : Tous les éléments critiques de saisie et de confirmation (sélection de catégories, bouton valider, boutons d'ajout flottants) sont situés dans la moitié inférieure de l'écran.
2. **Cibles tactiles minimales** : Chaque zone cliquable mesure au minimum **48x48px**.
3. **Contraste de texte** : Ratio de contraste WCAG AA minimal de 4.5:1 pour tout texte informatif sur fond blanc ou sombre.
4. **Comportement Hors-Ligne** : Aucun loader réseau bloquant ; persistance instantanée en base locale (ex: SQLite, IndexedDB, WatermelonDB, Realm).
