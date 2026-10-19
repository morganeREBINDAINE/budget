-- Catégories par défaut créées une seule fois, à la création du compte (insert dans auth.users).
-- L'app les récupère à chaque connexion Google (src/sync/pullCategories.ts) : pas de seed local,
-- donc ni doublon ni conflit de position après une réinstallation ou sur un autre téléphone.
-- Couleurs : categoryColors (src/design-system/tokens/colors.ts), dans l'ordre des positions.

create function public.create_default_categories(target_user_id uuid)
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
      ('Loisirs', '#EC4899', 'gamepad-variant-outline', 9)
  ) as d (name, color, icon, position)
  on conflict (user_id, position) do nothing;
end;
$$;

create function public.handle_new_user_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_default_categories(new.id);
  return new;
end;
$$;

-- Fonctions internes : jamais appelables depuis l'API.
revoke execute on function public.create_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_categories() from public, anon, authenticated;

create trigger on_auth_user_created_categories
  after insert on auth.users
  for each row execute function public.handle_new_user_categories();

-- Comptes créés avant cette migration et sans catégorie.
select public.create_default_categories(u.id)
from auth.users u
where not exists (select 1 from public.categories c where c.user_id = u.id);
