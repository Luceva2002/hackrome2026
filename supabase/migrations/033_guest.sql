-- Modalità ospite con il login anonimo di Supabase (Authentication → Sign In / Providers →
-- "Allow anonymous sign-ins"). L'ospite ha una sessione vera (ruolo authenticated, claim
-- is_anonymous = true): legge luoghi e bacheca come tutti, ma non scrive nulla.
-- Idempotente: si può rieseguire.

create or replace function public.is_guest()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
grant execute on function public.is_guest() to anon, authenticated;

-- Policy restrittive: si sommano (in AND) a quelle esistenti e valgono solo per chi ha un account vero.
-- Le select restano libere: niente policy "for all", che coprirebbe anche quelle.
drop policy if exists "guest_no_insert" on public.activities;
create policy "guest_no_insert" on public.activities as restrictive for insert to authenticated with check (not public.is_guest());
drop policy if exists "guest_no_update" on public.activities;
create policy "guest_no_update" on public.activities as restrictive for update to authenticated using (not public.is_guest());
drop policy if exists "guest_no_delete" on public.activities;
create policy "guest_no_delete" on public.activities as restrictive for delete to authenticated using (not public.is_guest());

drop policy if exists "guest_no_insert" on public.venue_claims;
create policy "guest_no_insert" on public.venue_claims as restrictive for insert to authenticated with check (not public.is_guest());
drop policy if exists "guest_no_insert" on public.venue_flags;
create policy "guest_no_insert" on public.venue_flags as restrictive for insert to authenticated with check (not public.is_guest());
drop policy if exists "guest_no_update" on public.profiles;
create policy "guest_no_update" on public.profiles as restrictive for update to authenticated using (not public.is_guest());
drop policy if exists "guest_no_update" on public.venues;
create policy "guest_no_update" on public.venues as restrictive for update to authenticated using (not public.is_guest());

-- Le RPC che scrivono (security definer, quindi fuori dalla RLS): stesso blocco in testa.
-- Si aggiunge la riga alle funzioni già installate, senza ricopiarle.
do $$
declare
  f text;
  d text;
begin
  foreach f in array array['public.join_activity(uuid)', 'public.leave_activity(uuid)', 'public.report_venue(jsonb)'] loop
    if to_regprocedure(f) is null then continue; end if;
    d := pg_get_functiondef(to_regprocedure(f));
    if position('account_required' in d) > 0 then continue; end if;
    d := regexp_replace(d, E'\nbegin\n', E'\nbegin\n  if public.is_guest() then raise exception ''account_required''; end if;\n');
    execute d;
  end loop;
end $$;
