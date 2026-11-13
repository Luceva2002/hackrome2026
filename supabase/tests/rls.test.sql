-- Test di permessi, lista d'attesa e regola di non-sovrascrittura.
-- Locale: psql -f supabase/tests/supabase-shim.sql && psql -f supabase/schema.sql && psql -f questo file
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test', '{"signup_role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'gestore@test', '{"signup_role":"manager"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c1@test', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'c2@test', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'c3@test', '{}');

-- 'admin' non è auto-assegnabile dalla registrazione
do $$ begin
  assert (select role from public.profiles where email = 'admin@test') = 'citizen', 'admin auto-assegnato!';
  assert (select role from public.profiles where email = 'gestore@test') = 'manager', 'signup_role manager ignorato';
end $$;
update public.profiles set role = 'admin' where email = 'admin@test';

insert into public.sources (id, title, publisher, fetcher, parser) values ('censimento-cmrc', 'C', 'CMRC', 'upload', 'csv');
insert into public.venues (id, name, opening_hours) values ('v1', 'Palestra Test', 'lun-ven 9-18');

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true), set_config('request.jwt.claim.role', 'authenticated', true);
$$;

-- 1. Un cittadino non può modificare un impianto
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.venues set opening_hours = 'hack' where id = 'v1';
do $$ begin assert (select opening_hours from public.venues where id = 'v1') = 'lun-ven 9-18', 'cittadino ha modificato!'; end $$;

-- 2. Claim del gestore → approvazione admin
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.venue_claims (venue_id, org_name) values ('v1', 'ASD Test');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin assert (select count(*) from public.venue_claims) = 0, 'cittadino vede i claim altrui'; end $$;
do $$ begin
  perform public.review_claim((select id from public.venue_claims limit 1), true);
  assert false, 'cittadino ha approvato un claim';
exception when others then null; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.review_claim((select id from public.venue_claims limit 1), true);

-- 3. Il gestore verificato modifica i dati operativi, non il nome
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.venues set opening_hours = 'sab fino alle 20:00', name = 'Rinominata' where id = 'v1';
reset role;
do $$ begin
  assert (select opening_hours from public.venues where id = 'v1') = 'sab fino alle 20:00', 'gestore non riesce a modificare';
  assert (select name from public.venues where id = 'v1') = 'Palestra Test', 'gestore ha cambiato il nome';
  assert (select 'opening_hours' = any (manager_edited_fields) from public.venues where id = 'v1'), 'campo non marcato';
  assert (select source_id from public.field_sources where venue_id = 'v1' and field = 'opening_hours') = 'gestore', 'fonte non aggiornata';
end $$;

-- 4. Regola di non-sovrascrittura: la proposta della pipeline salta gli orari, applica i metadati
insert into public.proposals (id, venue_id, source_id, kind, payload) values (
  '00000000-0000-0000-0000-0000000000f1', 'v1', 'censimento-cmrc', 'update',
  '{"opening_hours": {"old": null, "new": "dato vecchio"}, "operator_org": {"old": null, "new": "ASD Concessionaria"}, "status": {"old": null, "new": "attivo"}}');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.apply_proposal('00000000-0000-0000-0000-0000000000f1');
reset role;
do $$ begin
  assert (select opening_hours from public.venues where id = 'v1') = 'sab fino alle 20:00', 'pipeline ha sovrascritto il gestore!';
  assert (select operator_org from public.venues where id = 'v1') = 'ASD Concessionaria', 'metadato istituzionale non applicato';
  assert (select status from public.venues where id = 'v1') = 'attivo', 'campo non toccato dal gestore non applicato';
end $$;

-- 5. Lista d'attesa: capienza 1, tre iscritti, il primo se ne va → promosso il secondo
insert into public.activities (id, owner_id, title, discipline, starts_at, capacity)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'Basket', 'basket', now() + interval '1 day', 1);
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin assert public.join_activity('00000000-0000-0000-0000-0000000000a1') = 'confirmed'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin assert public.join_activity('00000000-0000-0000-0000-0000000000a1') = 'waitlist'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin assert public.join_activity('00000000-0000-0000-0000-0000000000a1') = 'waitlist'; end $$;
-- Privacy: c3 vede solo la propria iscrizione e solo i numeri dalla vista
do $$ begin
  assert (select count(*) from public.activity_participants) = 1, 'vede iscrizioni altrui';
  assert (select spots_left from public.activities_public where id = '00000000-0000-0000-0000-0000000000a1') = 0;
end $$;
-- Un iscritto non può gonfiare i contatori (nessun grant sulla colonna)
do $$ begin
  update public.activities set confirmed_count = 0 where id = '00000000-0000-0000-0000-0000000000a1';
  assert false, 'update dei contatori consentito';
exception when insufficient_privilege then null; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.leave_activity('00000000-0000-0000-0000-0000000000a1');
reset role;
do $$ begin
  assert (select status from public.activity_participants where user_id = '00000000-0000-0000-0000-00000000000d') = 'confirmed', 'primo in attesa non promosso';
  assert (select status from public.activity_participants where user_id = '00000000-0000-0000-0000-00000000000e') = 'waitlist';
  assert (select confirmed_count || '/' || waitlist_count from public.activities where id = '00000000-0000-0000-0000-0000000000a1') = '1/1', 'contatori errati';
end $$;

-- 6. L'Owner non può falsificare i contatori
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  update public.activities set confirmed_count = 99 where id = '00000000-0000-0000-0000-0000000000a1';
  assert false, 'owner ha aggiornato i contatori';
exception when insufficient_privilege then null; end $$;
update public.activities set title = 'Basket 3vs3' where id = '00000000-0000-0000-0000-0000000000a1';
reset role;
do $$ begin
  assert (select confirmed_count from public.activities where id = '00000000-0000-0000-0000-0000000000a1') = 1, 'owner ha falsificato i contatori';
  assert (select title from public.activities where id = '00000000-0000-0000-0000-0000000000a1') = 'Basket 3vs3';
end $$;

-- 7. Anonimo: legge luoghi e bacheca, non le attività grezze
set local role anon;
select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claim.role', 'anon', true);
do $$ begin
  assert (select count(*) from public.venues) = 1;
  assert (select count(*) from public.activities_public) = 1;
end $$;
reset role;

select 'TUTTI I TEST PASSATI' as esito;
rollback;
