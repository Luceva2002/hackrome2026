-- Segnalazione di un luogo da parte di un cittadino (SPEC 4.B): compare subito sulla mappa
-- con il badge "Segnalato dalla community". La RLS di venues lascia scrivere solo l'admin,
-- quindi si passa da questa funzione, che controlla i dati e fissa i campi che il cittadino
-- non può scegliere (community, fonte, moderazione, id).
create or replace function public.report_venue(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
  v_name text := btrim(p->>'name');
  v_lat double precision := (p->>'latitude')::double precision;
  v_lng double precision := (p->>'longitude')::double precision;
  v_kind text := coalesce(nullif(p->>'kind', ''), 'spazio_informale');
  v_nature text := coalesce(nullif(p->>'nature', ''), 'informale');
  v_access text := coalesce(nullif(p->>'accessibility', ''), 'da_verificare');
  v_disc text[] := coalesce(array(select jsonb_array_elements_text(p->'disciplines')), '{}');
  v_fields text[] := array['name', 'position', 'kind', 'nature'];
begin
  if v_uid is null then raise exception 'auth'; end if;
  if v_name is null or char_length(v_name) not between 3 and 120 then raise exception 'invalid_name'; end if;
  -- Area di Roma Capitale (con un po' di margine): niente punti a caso nel mondo
  if v_lat is null or v_lng is null or v_lat not between 41.6 and 42.15 or v_lng not between 12.2 and 12.9 then
    raise exception 'invalid_position';
  end if;
  if v_kind not in ('centro_sportivo', 'palestra', 'piscina', 'campo', 'palestra_scolastica', 'spazio_informale', 'altro') then
    raise exception 'invalid_kind';
  end if;
  if v_nature not in ('pubblico', 'concessione', 'privato', 'scuola', 'informale', 'da_verificare') then raise exception 'invalid_nature'; end if;
  if v_access not in ('si', 'no', 'da_verificare') then raise exception 'invalid_accessibility'; end if;
  if cardinality(v_disc) > 12 or exists (select 1 from unnest(v_disc) d where char_length(d) not between 2 and 40) then
    raise exception 'invalid_disciplines';
  end if;
  if char_length(coalesce(p->>'address', '')) > 200 or char_length(coalesce(p->>'opening_hours', '')) > 200
     or char_length(coalesce(p->>'description', '')) > 1000 then
    raise exception 'too_long';
  end if;
  -- Contro gli abusi: al massimo 10 segnalazioni al giorno per persona
  if (select count(*) from venues where reported_by = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limit';
  end if;

  v_id := 'com-' || replace(gen_random_uuid()::text, '-', '');
  insert into venues (id, name, address, municipio, latitude, longitude, kind, nature, disciplines, status, accessibility,
                      opening_hours, description, community, reported_by, moderation_status)
  values (v_id, v_name, nullif(btrim(p->>'address'), ''), nullif(p->>'municipio', '')::smallint, v_lat, v_lng, v_kind, v_nature,
          v_disc, 'da_verificare', v_access, nullif(btrim(p->>'opening_hours'), ''), nullif(btrim(p->>'description'), ''),
          true, v_uid, 'published');

  if nullif(btrim(p->>'address'), '') is not null then v_fields := v_fields || 'address'::text; end if;
  if cardinality(v_disc) > 0 then v_fields := v_fields || 'disciplines'::text; end if;
  if v_access <> 'da_verificare' then v_fields := v_fields || 'accessibility'::text; end if;
  if nullif(btrim(p->>'opening_hours'), '') is not null then v_fields := v_fields || 'opening_hours'::text; end if;
  if nullif(btrim(p->>'description'), '') is not null then v_fields := v_fields || 'description'::text; end if;
  insert into field_sources (venue_id, field, source_id, confidence, note)
  select v_id, f, 'community', 0.6, 'Segnalato da un cittadino' from unnest(v_fields) f;
  return v_id;
end;
$$;

revoke all on function public.report_venue(jsonb) from public, anon;
grant execute on function public.report_venue(jsonb) to authenticated;
