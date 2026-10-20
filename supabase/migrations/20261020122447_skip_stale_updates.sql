-- La modification la plus récente gagne (docs/STORAGE.md §3) : une mise à jour dont le updated_at
-- n'est pas strictement plus récent que la ligne en base est ignorée (renvoi en double, version
-- plus ancienne envoyée par un autre appareil). Le push (upsert par id) reste ainsi relançable.
-- updated_at est fourni par le client.

create or replace function public.skip_stale_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at <= old.updated_at then
    -- Ligne laissée intacte, sans erreur pour l'upsert.
    return null;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'transactions', 'recurring_payments', 'recurring_occurrences',
    'debt_people', 'debts', 'debt_repayments'
  ] loop
    execute format(
      'create trigger skip_stale_update before update on public.%I '
      'for each row execute function public.skip_stale_update()',
      t
    );
  end loop;
end
$$;
