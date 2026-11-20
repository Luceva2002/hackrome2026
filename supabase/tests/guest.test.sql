-- Ospite (login anonimo): legge, non scrive. Dopo schema.sql e le migrazioni 030-033.
-- Locale: psql -f supabase/tests/supabase-shim.sql && psql -f supabase/schema.sql && psql -f supabase/migrations/03*.sql && psql -f questo file
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test', '{}'),
  ('00000000-0000-0000-0000-0000000000f1', null, '{}');
insert into public.venues (id, name) values ('v1', 'Palestra Test');

create or replace function pg_temp.as_user(uid text, anon boolean) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, true), set_config('request.jwt.claim.role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'is_anonymous', anon)::text, true);
$$;

set local role authenticated;

-- Il cittadino vero scrive come prima
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', false);
insert into public.activities (owner_id, venue_id, title, discipline, starts_at, ends_at, capacity)
values (auth.uid(), 'v1', 'Basket', 'basket', now() + interval '1 day', now() + interval '1 day 1 hour', 4);

-- L'ospite legge luoghi e bacheca
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1', true);
do $$ begin
  assert public.is_guest(), 'is_guest falso per un ospite';
  assert (select count(*) from public.venues) = 1, 'ospite non legge i luoghi';
  assert (select count(*) from public.activities_public) = 1, 'ospite non legge la bacheca';
end $$;

-- ...ma non crea attività
do $$ begin
  insert into public.activities (owner_id, venue_id, title, discipline, starts_at, ends_at, capacity)
  values (auth.uid(), 'v1', 'Hack', 'basket', now() + interval '1 day', now() + interval '1 day 1 hour', 4);
  assert false, 'ospite ha creato un''attività';
exception when insufficient_privilege then null;
end $$;

-- ...non si iscrive e non segnala luoghi
do $$ begin
  perform public.join_activity((select id from public.activities_public limit 1));
  assert false, 'ospite si è iscritto';
exception when raise_exception then assert sqlerrm = 'account_required', sqlerrm;
end $$;
do $$ begin
  perform public.report_venue('{"name":"Campetto","latitude":41.9,"longitude":12.5}'::jsonb);
  assert false, 'ospite ha segnalato un luogo';
exception when raise_exception then assert sqlerrm = 'account_required', sqlerrm;
end $$;

-- ...e non modifica il profilo
update public.profiles set display_name = 'hack' where id = auth.uid();
reset role;
do $$ begin assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000f1') is distinct from 'hack', 'ospite ha modificato il profilo'; end $$;

select 'TEST OSPITE PASSATI' as esito;
rollback;
