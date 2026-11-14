/**
 * Cerca con Exa i luoghi sportivi gratuiti che mancano dal censimento
 * (Decathlon, ex Snia, Scalo Playground, playground e campetti liberi).
 *
 *   npm run exa:free-places              # solo report in data/exa/free-places.json
 *   npm run exa:free-places -- --write   # + proposte 'create' (pending, fonte exa_web)
 *
 * Un luogo diventa proposta solo se:
 *  - il suo source_url è tra le citazioni del run Exa;
 *  - l'indirizzo della fonte si geocodifica con Mapbox con la stessa regola del
 *    censimento (contiene la via, è nel Comune di Roma) e cade in un Municipio;
 *  - non c'è già un luogo entro 150 m con una parola del nome in comune.
 * Serve NEXT_PUBLIC_MAPBOX_TOKEN: dal cloud Mapbox è bloccato, va lanciato dal Mac.
 */
import { findFreePlaces, type FreePlace } from '../../src/lib/exa/free-places';
import { EXA_SOURCE_ID } from '../../src/lib/exa/venue-facts';
import { adminDb, flag, geocodeAddress, loadEnv, writeReport } from './lib';

type Existing = { id: string; name: string; latitude: number | null; longitude: number | null };

const GENERIC = new Set(['campo', 'campi', 'campetto', 'centro', 'sportivo', 'parco', 'roma', 'playground', 'area', 'basket', 'calcio']);
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !GENERIC.has(w));

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

function toPayload(p: FreePlace, geo: { lat: number; lng: number; municipio: number | null }) {
  return {
    id: `exa-${slug(p.name)}`,
    name: p.name,
    address: p.address,
    municipio: geo.municipio,
    latitude: geo.lat,
    longitude: geo.lng,
    kind: p.kind,
    nature: p.nature,
    disciplines: p.disciplines,
    status: 'attivo',
    accessibility: 'da_verificare',
    description: p.description ?? null,
    cost: p.cost,
    cost_price: p.cost === 'a_pagamento' ? (p.cost_price?.slice(0, 80) ?? null) : null,
    cost_note: p.cost_note?.slice(0, 200) ?? null,
    community: false,
    moderation_status: 'published',
    // apply_proposal usa jsonb_populate_record: i default della tabella non valgono, servono tutti i not null.
    levels: [],
    manager_edited_fields: [],
    review_notes: [],
    needs_review: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  loadEnv();
  const db = adminDb();
  const write = flag('write');

  const existing: Existing[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('venues').select('id, name, latitude, longitude').range(from, from + 999);
    if (error) throw error;
    existing.push(...((data ?? []) as Existing[]));
    if (!data || data.length < 1000) break;
  }

  console.log('[exa] avvio la ricerca dei luoghi gratuiti (Agent API, qualche minuto)…');
  const found = await findFreePlaces();
  console.log(`[exa] ${found.places.length} luoghi con fonte citata, ${found.droppedWithoutCitation.length} scartati senza citazione`);

  const accepted: unknown[] = [];
  const rejected: { place: FreePlace; reason: string }[] = [];
  for (const p of found.places) {
    const geo = await geocodeAddress(p.address).catch((e: Error) => {
      rejected.push({ place: p, reason: e.message });
      return undefined;
    });
    if (geo === undefined) continue;
    if (!geo || !geo.municipio) {
      rejected.push({ place: p, reason: 'posizione non certa (indirizzo non trovato o fuori Roma)' });
      continue;
    }
    const pw = words(p.name);
    const dup = existing.find(
      (v) =>
        v.latitude != null &&
        v.longitude != null &&
        distanceM(geo, { lat: v.latitude, lng: v.longitude }) < 150 &&
        (pw.length === 0 || words(v.name).some((w) => pw.includes(w))),
    );
    if (dup) {
      rejected.push({ place: p, reason: `già presente: ${dup.name} (${dup.id})` });
      continue;
    }

    const payload = toPayload(p, geo);
    const note = `${p.source_url} · posizione: Mapbox su "${p.address}" → ${geo.label}`;
    const field_sources = {
      name: { raw: p.name, confidence: 0.7, note: p.source_url },
      address: { raw: p.address, confidence: 0.7, note },
      latitude: { raw: `${geo.lat},${geo.lng}`, confidence: 0.7, note },
      longitude: { raw: `${geo.lat},${geo.lng}`, confidence: 0.7, note },
      cost: { raw: [p.cost, p.cost_price, p.cost_note].filter(Boolean).join(' · '), confidence: 0.7, note: p.source_url },
      disciplines: { raw: p.disciplines.join(', '), confidence: 0.6, note: p.source_url },
    };
    let proposalId: string | null = null;
    if (write) {
      const { data, error } = await db
        .from('proposals')
        .insert({
          venue_id: null,
          source_id: EXA_SOURCE_ID,
          kind: 'create',
          payload,
          field_sources,
          confidence: 0.7,
          reason: 'Luogo gratuito mancante dal censimento (ricerca web Exa)',
        })
        .select('id')
        .single();
      if (error) console.error(`  ! ${p.name}: proposta non inserita: ${error.message}`);
      proposalId = (data?.id as string | undefined) ?? null;
    }
    accepted.push({ payload, field_sources, proposalId });
    console.log(`  + ${p.name} (${p.address}) · ${p.cost}${p.cost_price ? ` ${p.cost_price}` : ''}`);
  }
  for (const r of rejected) console.log(`  - ${r.place.name}: ${r.reason}`);

  writeReport('free-places.json', { at: new Date().toISOString(), runId: found.runId, costDollars: found.costDollars, accepted, rejected, droppedWithoutCitation: found.droppedWithoutCitation });
  console.log(`[exa] fatto: ${accepted.length} proposte${write ? ' inserite' : ' (rilancia con --write per inserirle)'}, spesa ~$${(found.costDollars ?? 0).toFixed(2)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
