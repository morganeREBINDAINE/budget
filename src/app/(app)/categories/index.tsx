import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function CategoriesScreen() {
  return (
    <ScreenPlaceholder
      title="Catégories"
      links={[
        {
          label: 'Modifier « voiture »',
          href: { pathname: '/categories/[id]', params: { id: 'demo' } },
        },
      ]}
    />
  );
}
