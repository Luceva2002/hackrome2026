-- =============================================================================
-- RomaInCampo — schema Supabase
-- Esegui in: Dashboard → SQL Editor → New query → Run. Idempotente.
-- Le tabelle di CityAlert (civic_reports, report_votes, report_comments) non
-- vengono toccate: per eliminarle vedi supabase/cleanup-cityalert.sql.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles · ruolo: citizen (default) | manager | admin
-- manager = account gestore; può modificare un impianto solo dopo un claim
-- approvato. Owner e Guest NON sono ruoli: sono relazioni su activities.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'citizen',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists role text not null default 'citizen';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('citizen', 'manager', 'admin'));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_role_name() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Fonti dati e ingestione
-- -----------------------------------------------------------------------------
create table if not exists public.sources (
  id text primary key,
  title text not null,
  publisher text not null,
  url text,
  license text,
  fetcher text not null check (fetcher in ('ckan', 'http_file', 'html_links', 'upload')),
  parser text not null check (parser in ('csv', 'json', 'xlsx', 'geojson', 'pdf_llm')),
  mapping jsonb,
  priority integer not null default 5,
  notes text,
  last_checked_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.sources (id) on delete cascade,
  sha256 text not null,
  last_modified text,
  etag text,
  row_count integer,
  fetched_at timestamptz not null default now(),
  unique (source_id, sha256)
);

create table if not exists public.ingestion_events (
  id bigint generated always as identity primary key,
  source_id text references public.sources (id) on delete set null,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ingestion_events_created_idx on public.ingestion_events (created_at desc);

-- Cache del geocoding (una riga per indirizzo normalizzato)
create table if not exists public.geocode_cache (
  query text primary key,
  latitude double precision,
  longitude double precision,
  quality text,
  provider text not null default 'mapbox',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- venues · impianti ufficiali e spazi della community (punti)
-- -----------------------------------------------------------------------------
create table if not exists public.venues (
  id text primary key,                      -- stabile: 'cmrc-<hash>' | 'mim-<codice>' | 'com-<uuid>'
  name text not null,
  address text,
  municipio smallint check (municipio between 1 and 15),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  -- Predisposto: percorsi LineString (ciclabili, trail) come GeoJSON
  path_geojson jsonb,
  kind text not null default 'altro' check (kind in (
    'centro_sportivo', 'palestra', 'piscina', 'campo', 'palestra_scolastica', 'spazio_informale', 'altro')),
  nature text not null default 'da_verificare' check (nature in (
    'pubblico', 'concessione', 'privato', 'scuola', 'informale', 'da_verificare')),
  disciplines text[] not null default '{}',
  structures text,
  levels text[] not null default '{}',
  status text not null default 'da_verificare' check (status in (
    'attivo', 'inagibile', 'ristrutturazione', 'realizzazione', 'progettazione', 'da_verificare')),
  accessibility text not null default 'da_verificare' check (accessibility in ('si', 'no', 'da_verificare')),
  accessibility_notes text,
  opening_hours text,
  phone text,
  website text,
  prices text,
  description text,
  -- Metadati istituzionali (le fonti pubbliche possono sempre aggiornarli)
  operator_org text,                         -- associazione concessionaria, mai persone fisiche
  concession_expires_on date,
  school_building_code text,
  community boolean not null default false,
  reported_by uuid references auth.users (id) on delete set null,
  moderation_status text not null default 'published' check (moderation_status in ('published', 'pending', 'hidden')),
  verified_manager_id uuid references auth.users (id) on delete set null,
  manager_edited_fields text[] not null default '{}',
  needs_review boolean not null default false,
  review_notes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venues_municipio_idx on public.venues (municipio);
create index if not exists venues_kind_idx on public.venues (kind);
create index if not exists venues_disciplines_idx on public.venues using gin (disciplines);

-- Fonte di ogni campo di ogni scheda
create table if not exists public.field_sources (
  venue_id text not null references public.venues (id) on delete cascade,
  field text not null,
  source_id text not null,                   -- id di sources, oppure 'gestore' | 'community' | 'derivato'
  raw_value text,
  confidence numeric(3, 2) not null default 0 check (confidence between 0 and 1),
  note text,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (venue_id, field)
);

-- Proposte di modifica della pipeline: mai scritture dirette sulle schede
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  venue_id text references public.venues (id) on delete cascade,  -- null = nuovo luogo
  source_id text not null references public.sources (id) on delete cascade,
  kind text not null check (kind in ('create', 'update')),
  payload jsonb not null,                    -- create: scheda completa · update: {campo: {old, new}}
  field_sources jsonb,                       -- {campo: {raw, confidence, note}}
  confidence numeric(3, 2) not null default 0.5,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'skipped')),
  reason text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists proposals_status_idx on public.proposals (status, created_at desc);

-- Rivendicazione di un impianto da parte di un gestore
create table if not exists public.venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  org_name text not null check (char_length(org_name) between 2 and 120),
  role_in_org text check (char_length(role_in_org) <= 80),
  evidence text check (char_length(evidence) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (venue_id, user_id)
);

-- Segnalazioni di abuso / luogo inesistente sui luoghi della community
create table if not exists public.venue_flags (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (char_length(reason) between 3 and 300),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (venue_id, user_id)
);

-- -----------------------------------------------------------------------------
-- activities · bacheca. Owner = owner_id. Contatori aggiornati solo dalle RPC.
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  venue_id text references public.venues (id) on delete set null,
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 600),
  discipline text not null,
  level text not null default 'tutti' check (level in ('principiante', 'intermedio', 'avanzato', 'tutti')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer not null check (capacity between 1 and 500),
  confirmed_count integer not null default 0,
  waitlist_count integer not null default 0,
  accessible boolean not null default false,
  price_note text check (char_length(price_note) <= 80),
  visibility text not null default 'public' check (visibility in ('public', 'invite')),
  status text not null default 'published' check (status in ('published', 'cancelled')),
  -- Copia della posizione per filtri e mini-mappa anche senza venue
  latitude double precision,
  longitude double precision,
  municipio smallint check (municipio between 1 and 15),
  place_label text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists activities_starts_idx on public.activities (starts_at);
create index if not exists activities_owner_idx on public.activities (owner_id);

create table if not exists public.activity_participants (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('confirmed', 'waitlist')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists activity_participants_wait_idx
  on public.activity_participants (activity_id, status, created_at);

-- Vista pubblica: nessun dato personale dell'Owner, solo il nome visualizzato
create or replace view public.activities_public
with (security_invoker = off) as
select
  a.id, a.venue_id, a.title, a.description, a.discipline, a.level,
  a.starts_at, a.ends_at, a.capacity, a.confirmed_count, a.waitlist_count,
  greatest(a.capacity - a.confirmed_count, 0) as spots_left,
  a.accessible, a.price_note, a.status, a.latitude, a.longitude, a.municipio,
  a.place_label, a.is_demo, a.created_at,
  coalesce(p.display_name, 'Organizzatore') as owner_name,
  (p.role = 'manager' and v.verified_manager_id = a.owner_id) as owner_is_venue_manager,
  v.name as venue_name
from public.activities a
left join public.profiles p on p.id = a.owner_id
left join public.venues v on v.id = a.venue_id
where a.visibility = 'public';

-- -----------------------------------------------------------------------------
-- Iscrizione atomica con lista d'attesa
-- -----------------------------------------------------------------------------
create or replace function public.join_activity(p_activity uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_act public.activities%rowtype;
  v_existing text;
  v_status text;
begin
  if v_uid is null then raise exception 'auth_required'; end if;

  select * into v_act from public.activities where id = p_activity for update;
  if not found then raise exception 'not_found'; end if;
  if v_act.status <> 'published' then raise exception 'cancelled'; end if;
  if v_act.starts_at < now() then raise exception 'past'; end if;
  if v_act.owner_id = v_uid then raise exception 'owner'; end if;

  select status into v_existing from public.activity_participants
  where activity_id = p_activity and user_id = v_uid;
  if v_existing is not null then return v_existing; end if;

  v_status := case when v_act.confirmed_count < v_act.capacity then 'confirmed' else 'waitlist' end;
  insert into public.activity_participants (activity_id, user_id, status) values (p_activity, v_uid, v_status);

  update public.activities set
    confirmed_count = confirmed_count + (v_status = 'confirmed')::int,
    waitlist_count = waitlist_count + (v_status = 'waitlist')::int
  where id = p_activity;

  return v_status;
end;
$$;

create or replace function public.leave_activity(p_activity uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_next uuid;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  perform 1 from public.activities where id = p_activity for update;
  if not found then raise exception 'not_found'; end if;

  delete from public.activity_participants
  where activity_id = p_activity and user_id = v_uid
  returning status into v_status;
  if v_status is null then return 'not_joined'; end if;

  if v_status = 'confirmed' then
    -- Promuove il primo in attesa (FIFO)
    select user_id into v_next from public.activity_participants
    where activity_id = p_activity and status = 'waitlist'
    order by created_at, user_id
    limit 1
    for update skip locked;

    if v_next is not null then
      update public.activity_participants set status = 'confirmed'
      where activity_id = p_activity and user_id = v_next;
      update public.activities set waitlist_count = waitlist_count - 1 where id = p_activity;
    else
      update public.activities set confirmed_count = confirmed_count - 1 where id = p_activity;
    end if;
  else
    update public.activities set waitlist_count = waitlist_count - 1 where id = p_activity;
  end if;

  return 'left';
end;
$$;

revoke execute on function public.join_activity(uuid) from public, anon;
revoke execute on function public.leave_activity(uuid) from public, anon;
grant execute on function public.join_activity(uuid) to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;

-- Capienza ridotta dall'Owner: mai sotto gli iscritti confermati
create or replace function public.guard_activity_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.capacity < old.confirmed_count then
    raise exception 'capacity_below_confirmed';
  end if;
  -- Dentro le RPC security definer current_user è il proprietario: i contatori passano
  if current_user = 'authenticated' then
    new.confirmed_count := old.confirmed_count;
    new.waitlist_count := old.waitlist_count;
    new.owner_id := old.owner_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists activities_guard on public.activities;
create trigger activities_guard before update on public.activities
  for each row execute function public.guard_activity_update();

-- -----------------------------------------------------------------------------
-- Claim: approvazione admin → gestore verificato dell'impianto
-- -----------------------------------------------------------------------------
create or replace function public.review_claim(p_claim uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.venue_claims%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into v_claim from public.venue_claims where id = p_claim for update;
  if not found then raise exception 'not_found'; end if;

  update public.venue_claims set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_claim;

  if p_approve then
    update public.venues set verified_manager_id = v_claim.user_id where id = v_claim.venue_id;
    update public.profiles set role = 'manager' where id = v_claim.user_id and role = 'citizen';
    -- Gli altri claim pendenti sullo stesso impianto decadono
    update public.venue_claims set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where venue_id = v_claim.venue_id and id <> p_claim and status = 'pending';
  end if;
  return case when p_approve then 'approved' else 'rejected' end;
end;
$$;

revoke execute on function public.review_claim(uuid, boolean) from public, anon;
grant execute on function public.review_claim(uuid, boolean) to authenticated;

-- Il gestore verificato modifica solo i dati operativi; ogni campo toccato
-- viene marcato e la sua fonte diventa 'gestore'.
create or replace function public.guard_venue_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f text;
  v_changed text[] := '{}';
begin
  -- service_role, SQL editor e admin non sono vincolati
  if coalesce(auth.role(), '') <> 'authenticated' or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if old.verified_manager_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  -- Campi che il gestore NON può toccare: si ripristinano
  new.id := old.id; new.name := old.name; new.address := old.address;
  new.municipio := old.municipio; new.latitude := old.latitude; new.longitude := old.longitude;
  new.kind := old.kind; new.nature := old.nature; new.community := old.community;
  new.operator_org := old.operator_org; new.concession_expires_on := old.concession_expires_on;
  new.verified_manager_id := old.verified_manager_id; new.moderation_status := old.moderation_status;
  new.reported_by := old.reported_by; new.school_building_code := old.school_building_code;
  new.needs_review := old.needs_review; new.review_notes := old.review_notes;

  if new.opening_hours is distinct from old.opening_hours then v_changed := v_changed || 'opening_hours'::text; end if;
  if new.phone is distinct from old.phone then v_changed := v_changed || 'phone'::text; end if;
  if new.website is distinct from old.website then v_changed := v_changed || 'website'::text; end if;
  if new.prices is distinct from old.prices then v_changed := v_changed || 'prices'::text; end if;
  if new.description is distinct from old.description then v_changed := v_changed || 'description'::text; end if;
  if new.disciplines is distinct from old.disciplines then v_changed := v_changed || 'disciplines'::text; end if;
  if new.status is distinct from old.status then v_changed := v_changed || 'status'::text; end if;
  if new.accessibility is distinct from old.accessibility then v_changed := v_changed || 'accessibility'::text; end if;
  if new.accessibility_notes is distinct from old.accessibility_notes then v_changed := v_changed || 'accessibility_notes'::text; end if;

  new.manager_edited_fields := (
    select coalesce(array_agg(distinct x), '{}') from unnest(old.manager_edited_fields || v_changed) x
  );
  new.updated_at := now();

  foreach f in array v_changed loop
    insert into public.field_sources (venue_id, field, source_id, confidence, note, updated_at)
    values (new.id, f, 'gestore', 1, 'Aggiornato dal gestore verificato', now())
    on conflict (venue_id, field) do update set
      source_id = 'gestore', raw_value = null, confidence = 1,
      note = 'Aggiornato dal gestore verificato', updated_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists venues_guard on public.venues;
create trigger venues_guard before update on public.venues
  for each row execute function public.guard_venue_update();

-- -----------------------------------------------------------------------------
-- Applicazione di una proposta: REGOLA DELLO SPEC → i campi modificati da un
-- gestore verificato non vengono mai sovrascritti dalle fonti pubbliche;
-- i metadati istituzionali sì.
-- -----------------------------------------------------------------------------
create or replace function public.apply_proposal(p_proposal uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.proposals%rowtype;
  v_venue public.venues%rowtype;
  v_field text;
  v_new jsonb;
  v_applied text[] := '{}';
  v_skipped text[] := '{}';
  v_institutional constant text[] := array['operator_org', 'concession_expires_on', 'school_building_code'];
  v_allowed constant text[] := array[
    'name', 'address', 'municipio', 'latitude', 'longitude', 'kind', 'nature', 'disciplines',
    'structures', 'levels', 'status', 'accessibility', 'opening_hours', 'phone', 'website',
    'operator_org', 'concession_expires_on', 'school_building_code'];
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_p from public.proposals where id = p_proposal for update;
  if not found or v_p.status <> 'pending' then raise exception 'not_pending'; end if;

  if v_p.kind = 'create' then
    insert into public.venues select * from jsonb_populate_record(null::public.venues, v_p.payload)
    on conflict (id) do nothing;
    v_applied := array['*'];
  else
    select * into v_venue from public.venues where id = v_p.venue_id for update;
    for v_field, v_new in select key, value->'new' from jsonb_each(v_p.payload) loop
      if not (v_field = any (v_allowed)) then continue; end if;
      if v_field = any (v_venue.manager_edited_fields) and not (v_field = any (v_institutional)) then
        v_skipped := v_skipped || v_field::text;
        continue;
      end if;
      execute format(
        'update public.venues set %I = (jsonb_populate_record(null::public.venues, jsonb_build_object(%L, $1))).%I where id = $2',
        v_field, v_field, v_field
      ) using v_new, v_p.venue_id;
      v_applied := v_applied || v_field::text;
    end loop;
  end if;

  -- Fonti dei campi applicati
  if v_p.field_sources is not null then
    insert into public.field_sources (venue_id, field, source_id, raw_value, confidence, note)
    select coalesce(v_p.venue_id, v_p.payload->>'id'), fs.key, v_p.source_id,
           fs.value->>'raw', coalesce((fs.value->>'confidence')::numeric, v_p.confidence), fs.value->>'note'
    from jsonb_each(v_p.field_sources) fs
    where v_applied = array['*'] or fs.key = any (v_applied)
    on conflict (venue_id, field) do update set
      source_id = excluded.source_id, raw_value = excluded.raw_value,
      confidence = excluded.confidence, note = excluded.note, updated_at = now();
  end if;

  update public.proposals set
    status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
    reason = case when cardinality(v_skipped) > 0
      then 'Non sovrascritti (modificati dal gestore): ' || array_to_string(v_skipped, ', ') else reason end
  where id = p_proposal;

  return jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
end;
$$;

revoke execute on function public.apply_proposal(uuid) from public, anon;
grant execute on function public.apply_proposal(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Profilo alla registrazione. Il ruolo scelto nello step "Chi sei?" arriva
-- in raw_user_meta_data.signup_role; 'admin' non è mai auto-assegnabile.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  v_role := case when new.raw_user_meta_data->>'signup_role' = 'manager' then 'manager' else 'citizen' end;

  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, v_name, v_role)
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.profiles (id, email, display_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'display_name', split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.source_snapshots enable row level security;
alter table public.ingestion_events enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.venues enable row level security;
alter table public.field_sources enable row level security;
alter table public.proposals enable row level security;
alter table public.venue_claims enable row level security;
alter table public.venue_flags enable row level security;
alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;

-- profiles: ognuno vede il proprio; l'admin tutti (per i claim)
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Fonti: pubbliche in lettura (trasparenza), scrittura solo admin
drop policy if exists "sources_read" on public.sources;
create policy "sources_read" on public.sources for select to anon, authenticated using (true);
drop policy if exists "sources_admin" on public.sources;
create policy "sources_admin" on public.sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "snapshots_read" on public.source_snapshots;
create policy "snapshots_read" on public.source_snapshots for select to anon, authenticated using (true);

drop policy if exists "events_admin_read" on public.ingestion_events;
create policy "events_admin_read" on public.ingestion_events for select to authenticated using (public.is_admin());

-- venues: lettura pubblica dei luoghi pubblicati; update → trigger venues_guard
drop policy if exists "venues_read" on public.venues;
create policy "venues_read" on public.venues for select to anon, authenticated
  using (moderation_status = 'published' or public.is_admin() or verified_manager_id = auth.uid());
drop policy if exists "venues_manager_update" on public.venues;
create policy "venues_manager_update" on public.venues for update to authenticated
  using (verified_manager_id = auth.uid() or public.is_admin())
  with check (verified_manager_id = auth.uid() or public.is_admin());
drop policy if exists "venues_admin_all" on public.venues;
create policy "venues_admin_all" on public.venues for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "field_sources_read" on public.field_sources;
create policy "field_sources_read" on public.field_sources for select to anon, authenticated using (true);

drop policy if exists "proposals_admin" on public.proposals;
create policy "proposals_admin" on public.proposals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- claim: il richiedente vede e crea i propri; l'admin li vede tutti (approva via RPC)
drop policy if exists "claims_select" on public.venue_claims;
create policy "claims_select" on public.venue_claims for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "claims_insert" on public.venue_claims;
create policy "claims_insert" on public.venue_claims for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "flags_insert" on public.venue_flags;
create policy "flags_insert" on public.venue_flags for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "flags_admin" on public.venue_flags;
create policy "flags_admin" on public.venue_flags for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- activities: la lettura pubblica passa da activities_public; l'Owner gestisce le sue
drop policy if exists "activities_owner_select" on public.activities;
create policy "activities_owner_select" on public.activities for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
drop policy if exists "activities_insert" on public.activities;
create policy "activities_insert" on public.activities for insert to authenticated
  with check (owner_id = auth.uid() and confirmed_count = 0 and waitlist_count = 0);
drop policy if exists "activities_owner_update" on public.activities;
create policy "activities_owner_update" on public.activities for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "activities_owner_delete" on public.activities;
create policy "activities_owner_delete" on public.activities for delete to authenticated
  using (owner_id = auth.uid());

-- partecipanti: ognuno vede SOLO la propria iscrizione. Scritture solo via RPC.
drop policy if exists "participants_own" on public.activity_participants;
create policy "participants_own" on public.activity_participants for select to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Grant
-- -----------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;

revoke all on table public.profiles from anon, authenticated;
grant select (id, display_name, role, created_at) on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select on public.sources, public.source_snapshots, public.field_sources to anon, authenticated;
grant insert, update, delete on public.sources to authenticated;
grant select on public.ingestion_events to authenticated;

revoke all on table public.venues from anon, authenticated;
grant select on public.venues to anon, authenticated;
grant update on public.venues to authenticated;  -- filtrato da policy + trigger
grant insert, delete on public.venues to authenticated;  -- solo admin via policy

grant select, insert, update, delete on public.proposals to authenticated;
grant select, insert on public.venue_claims to authenticated;
grant select, insert, update on public.venue_flags to authenticated;

grant select, insert, delete on public.activities to authenticated;
grant update (title, description, discipline, level, starts_at, ends_at, capacity, accessible,
              price_note, visibility, status, venue_id, latitude, longitude, municipio, place_label)
  on public.activities to authenticated;
grant select on public.activity_participants to authenticated;
grant select on public.activities_public to anon, authenticated;

grant all on all tables in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Realtime: log della pipeline e contatori posti in diretta
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ingestion_events', 'activities'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception when undefined_object then null;
end;
$$;
