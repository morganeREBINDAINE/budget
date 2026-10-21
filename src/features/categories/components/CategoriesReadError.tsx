import { ReadErrorCard } from '@/features/db/ReadErrorCard';

// Remplace les catégories quand leur lecture dans la base locale a échoué (toast déjà affiché).
export function CategoriesReadError() {
  return (
    <ReadErrorCard
      title="Catégories indisponibles"
      message="Impossible de lire les catégories enregistrées sur le téléphone. Ferme puis rouvre l'application."
    />
  );
}
