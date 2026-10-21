-- Personnes (debt_people) : suppression définitive à la place de la suppression logique
-- (docs/STORAGE.md §2, exception pour les données peu importantes). L'app envoie un DELETE par id ;
-- les personnes déjà supprimées logiquement sont effacées, puis la colonne deleted_at est retirée
-- (un nom supprimé ne bloque plus l'index unique des noms).

delete from public.debt_people where deleted_at is not null;

alter table public.debt_people drop column deleted_at;

grant delete on public.debt_people to authenticated;

create policy debt_people_delete_own on public.debt_people
  for delete to authenticated
  using (user_id = (select auth.uid()));
