// Durées (ms) et courbes d'animation.
export const motion = {
  duration: { fast: 150, base: 250, slow: 400 },
  // cubic-bezier, à utiliser avec Easing.bezier(...)
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0, 1],
    accelerate: [0.3, 0, 1, 1],
  },
  // Échelle appliquée aux éléments pressés (active:scale-[0.98]).
  pressScale: 0.98,
} as const;

export type DurationToken = keyof typeof motion.duration;
