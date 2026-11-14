-- Costo di un luogo, strutturato: gratuito / a pagamento / da verificare, con prezzo e nota.
-- Regola del progetto: si scrive solo con una fonte (gestore verificato, fonte pubblica,
-- proposta approvata dall'admin). Senza dato resta 'da_verificare' e l'app lo dice.
-- La fonte sta in field_sources con field = 'cost' (URL della pagina nella nota).
alter table public.venues
  add column if not exists cost text not null default 'da_verificare'
    check (cost in ('gratuito', 'a_pagamento', 'da_verificare')),
  add column if not exists cost_price text check (char_length(cost_price) <= 80),   -- es. "da 8 € l'ora"
  add column if not exists cost_note text check (char_length(cost_note) <= 200);    -- es. "campo libero, senza prenotazione"

-- Il gestore verificato può dichiarare il costo: i campi toccati prendono fonte 'gestore'.
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
  if coalesce(auth.role(), '') <> 'authenticated' or public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if old.verified_manager_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

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
  if new.cost is distinct from old.cost or new.cost_price is distinct from old.cost_price
     or new.cost_note is distinct from old.cost_note then v_changed := v_changed || 'cost'::text; end if;
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

-- Le proposte (pipeline, Exa) possono compilare il costo. Formato:
--   payload:       {"cost": {"old": "da_verificare", "new": "gratuito"},
--                   "cost_price": {"old": null, "new": null},
--                   "cost_note": {"old": null, "new": "Campo libero, senza prenotazione"}}
--   field_sources: {"cost": {"raw": "<frase letta sulla pagina>", "confidence": 0.8, "note": "<URL della pagina>"}}
-- cost_price e cost_note seguono cost: se il gestore ha toccato il costo, nessuno dei tre viene sovrascritto.
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
    'cost', 'cost_price', 'cost_note',
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
      if (v_field = any (v_venue.manager_edited_fields)
          or (v_field in ('cost_price', 'cost_note') and 'cost' = any (v_venue.manager_edited_fields)))
         and not (v_field = any (v_institutional)) then
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
