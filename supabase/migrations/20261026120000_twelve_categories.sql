-- 12 catégories par compte : positions 1 à 12 (src/lib/categories.ts, CATEGORY_COUNT).
-- À déployer APRÈS la mise à jour de l'app : une app encore limitée aux positions 1 à 9 refuserait
-- les nouvelles catégories au pull.
-- Couleurs : categoryColors (src/design-system/tokens/colors.ts) ; les 9 premières sont inchangées.

alter table public.categories drop constraint categories_position_range;
alter table public.categories
  add constraint categories_position_range check (position between 1 and 12);

create or replace function public.create_default_categories(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (id, user_id, name, color, icon, position, created_at, updated_at)
  select gen_random_uuid(), target_user_id, d.name, d.color, d.icon, d.position, now(), now()
  from (
    values
      ('Voiture', '#EF4444', 'car', 1),
      ('Factures', '#F97316', 'file-document-outline', 2),
      ('Maison', '#F59E0B', 'home-outline', 3),
      ('Hanout', '#84CC16', 'cart-outline', 4),
      ('Khaddar', '#22C55E', 'carrot', 5),
      ('Boucherie', '#06B6D4', 'food-steak', 6),
      ('Neyla', '#3B82F6', 'baby-face-outline', 7),
      ('Assya', '#8B5CF6', 'face-woman-outline', 8),
      ('Loisirs', '#EC4899', 'gamepad-variant-outline', 9),
      ('Santé', '#EAB308', 'medical-bag', 10),
      ('Autre', '#14B8A6', 'shopping-outline', 11),
      ('À définir', '#6366F1', 'piggy-bank-outline', 12)
  ) as d (name, color, icon, position)
  on conflict (user_id, position) do nothing;
end;
$$;

revoke execute on function public.create_default_categories(uuid) from public, anon, authenticated;

-- Comptes existants : ajoute les positions 10 à 12 (les positions déjà présentes sont ignorées).
select public.create_default_categories(u.id) from auth.users u;
