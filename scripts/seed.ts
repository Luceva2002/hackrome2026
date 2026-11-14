/**
 * Seed del database (idempotente).
 *
 *   npm run db:seed
 *
 * Richiede in .env.local: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * 1. registra le fonti (data/sources.json) e lo snapshot del censimento
 * 2. carica i luoghi da data/processed/venues.json con la fonte di ogni campo
 *    (bootstrap iniziale: le esecuzioni successive della pipeline producono
 *    solo proposals, vedi DECISIONS.md)
 * 3. crea un account demo per ruolo (credenziali in .env.example)
 * 4. approva il gestore demo su un impianto vero e crea ~10 attività di esempio
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import type { VenueRecord } from '../src/features/venues/types';

const ROOT = resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const env = (k: string, d: string) => process.env[k] || d;
const DEMO = {
  citizen: { email: env('DEMO_CITIZEN_EMAIL', 'cittadino@demo.romaincampo.it'), password: env('DEMO_CITIZEN_PASSWORD', 'Demo-Cittadino-2026'), name: 'Giulia (demo)' },
  manager: { email: env('DEMO_MANAGER_EMAIL', 'gestore@demo.romaincampo.it'), password: env('DEMO_MANAGER_PASSWORD', 'Demo-Gestore-2026'), name: 'ASD Demo Sport' },
  admin: { email: env('DEMO_ADMIN_EMAIL', 'admin@demo.romaincampo.it'), password: env('DEMO_ADMIN_PASSWORD', 'Demo-Admin-2026'), name: 'Moderazione' },
};

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function log(source_id: string | null, message: string, data?: unknown) {
  await db.from('ingestion_events').insert({ source_id, message, data: data ?? null });
  console.log(`  · ${message}`);
}

async function seedSources() {
  const sources = JSON.parse(readFileSync(resolve(ROOT, 'data/sources.json'), 'utf8')) as Record<string, unknown>[];
  await must(
    db.from('sources').upsert(
      sources.map((s) => ({
        id: s.id,
        title: s.titolo,
        publisher: s.ente,
        url: s.url,
        license: s.licenza,
        fetcher: s.fetcher,
        parser: s.parser,
        mapping: s.mapping,
        priority: s.priorita,
        notes: s.note,
      })),
    ),
    'sources',
  );
  const snaps = JSON.parse(readFileSync(resolve(ROOT, 'data/processed/snapshots.json'), 'utf8')) as Record<
    string,
    { sha256: string; rows: number; at: string }
  >;
  for (const [source_id, s] of Object.entries(snaps)) {
    await db
      .from('source_snapshots')
      .upsert({ source_id, sha256: s.sha256, row_count: s.rows, fetched_at: s.at }, { onConflict: 'source_id,sha256' });
    await db.from('sources').update({ last_checked_at: s.at, last_status: 'ok' }).eq('id', source_id);
  }
  console.log(`✓ ${sources.length} fonti`);
}

async function seedVenues() {
  const venues = JSON.parse(readFileSync(resolve(ROOT, 'data/processed/venues.json'), 'utf8')) as VenueRecord[];
  // Non tocca i campi già modificati da un gestore: aggiorna solo i luoghi non rivendicati
  const claimed = new Set(
    ((await must(db.from('venues').select('id').not('verified_manager_id', 'is', null), 'venues claimed')) as { id: string }[]).map(
      (v) => v.id,
    ),
  );
  const rows = venues
    .filter((v) => !claimed.has(v.id))
    .map((v) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      municipio: v.municipio,
      latitude: v.latitude,
      longitude: v.longitude,
      kind: v.kind,
      nature: v.nature,
      disciplines: v.disciplines,
      structures: v.structures,
      levels: v.levels,
      status: v.status,
      accessibility: v.accessibility,
      needs_review: v.needs_review,
      review_notes: v.review_notes,
    }));
  for (let i = 0; i < rows.length; i += 500) {
    await must(db.from('venues').upsert(rows.slice(i, i + 500)), `venues ${i}`);
  }
  const fs = venues
    .filter((v) => !claimed.has(v.id))
    .flatMap((v) =>
      Object.entries(v.fields).map(([field, f]) => ({
        venue_id: v.id,
        field,
        source_id: f!.source,
        raw_value: f!.raw ?? null,
        confidence: f!.confidence,
        note: f!.note ?? null,
      })),
    );
  for (let i = 0; i < fs.length; i += 1000) {
    await must(db.from('field_sources').upsert(fs.slice(i, i + 1000)), `field_sources ${i}`);
  }
  await log('censimento-cmrc', `Bootstrap: ${rows.length} luoghi caricati, ${claimed.size} rivendicati lasciati intatti`, {
    geocodificati: venues.filter((v) => v.latitude != null).length,
  });
  console.log(`✓ ${rows.length} luoghi, ${fs.length} fonti di campo`);
  return venues;
}

async function ensureUser(u: { email: string; password: string; name: string }, signup_role: 'citizen' | 'manager') {
  const list = await db.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw new Error(`listUsers: ${list.error.message}`);
  const found = list.data.users.find((x) => x.email === u.email);
  if (found) return found.id;
  const created = await db.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { display_name: u.name, signup_role },
  });
  if (created.error || !created.data.user) throw new Error(`createUser ${u.email}: ${created.error?.message}`);
  return created.data.user.id;
}

function at(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function nextWeekday(target: number) {
  const today = new Date().getDay();
  return (target - today + 7) % 7 || 7;
}

async function seedDemo(venues: VenueRecord[]) {
  const citizenId = await ensureUser(DEMO.citizen, 'citizen');
  const managerId = await ensureUser(DEMO.manager, 'manager');
  const adminId = await ensureUser(DEMO.admin, 'citizen');
  await must(db.from('profiles').update({ role: 'admin', display_name: DEMO.admin.name }).eq('id', adminId), 'admin');
  console.log('✓ account demo (cittadino, gestore, admin)');

  const located = venues.filter((v) => v.latitude != null && v.status === 'da_verificare' && !v.needs_review);
  if (!located.length) {
    console.warn('! Nessun luogo geocodificato: lancia `npm run pipeline:geocode` e poi di nuovo il seed per le attività demo.');
    return;
  }
  const pick = (pred: (v: VenueRecord) => boolean, fallback = located[0]) => located.find(pred) ?? fallback;
  const has = (d: string) => (v: VenueRecord) => v.disciplines.includes(d);

  // Il gestore demo gestisce un centro sportivo vero (claim approvato)
  const managed = pick((v) => v.kind === 'centro_sportivo' && has('basket')(v) && v.municipio === 15);
  await db.from('venue_claims').upsert(
    {
      venue_id: managed.id,
      user_id: managerId,
      org_name: DEMO.manager.name,
      role_in_org: 'Presidente (account demo)',
      evidence: 'Account dimostrativo creato dal seed',
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: 'venue_id,user_id' },
  );
  await db.from('venues').update({ verified_manager_id: managerId }).eq('id', managed.id);

  // Una richiesta in attesa, per mostrare il flusso di approvazione in demo
  const pendingVenue = pick((v) => v.kind === 'palestra' && v.id !== managed.id);
  await db.from('venue_claims').upsert(
    { venue_id: pendingVenue.id, user_id: citizenId, org_name: 'Polisportiva di quartiere (demo)', role_in_org: 'Segretario', status: 'pending' },
    { onConflict: 'venue_id,user_id' },
  );

  const sat = nextWeekday(6);
  const sun = nextWeekday(0);
  const plan: {
    venue: VenueRecord;
    title: string;
    discipline: string;
    level: string;
    start: Date;
    minutes: number;
    capacity: number;
    owner: string;
    description: string;
    price?: string;
  }[] = [
    { venue: managed, title: 'Basket 3 contro 3 aperto a tutti', discipline: 'basket', level: 'tutti', start: at(0, 19), minutes: 90, capacity: 12, owner: managerId, description: 'Partitelle a rotazione, squadre fatte sul posto. Porta scarpe da ginnastica e acqua.' },
    { venue: managed, title: 'Minibasket per bambini 8–11 anni', discipline: 'basket', level: 'principiante', start: at(sat, 10), minutes: 60, capacity: 16, owner: managerId, description: 'Lezione di prova gratuita con istruttore federale. Un genitore resta in struttura.' },
    { venue: pick(has('volley')), title: 'Pallavolo misto, livello intermedio', discipline: 'volley', level: 'intermedio', start: at(1, 20), minutes: 90, capacity: 12, owner: citizenId, description: 'Cerchiamo giocatori per completare due squadre miste.' },
    { venue: pick(has('ginnastica')), title: 'Yoga dolce del sabato mattina', discipline: 'yoga', level: 'tutti', start: at(sat, 9, 30), minutes: 60, capacity: 15, owner: citizenId, description: 'Porta il tuo tappetino. Adatto anche a chi non ha mai fatto yoga.', price: 'Gratuita' },
    { venue: pick(has('ginnastica'), managed), title: 'Yoga al tramonto', discipline: 'yoga', level: 'principiante', start: at(sun, 17, 30), minutes: 60, capacity: 2, owner: citizenId, description: 'Piccolo gruppo, posti limitati: se è pieno entri in lista d’attesa.' },
    { venue: pick(has('judo')), title: 'Judo: lezione di prova gratuita', discipline: 'judo', level: 'principiante', start: at(1, 18), minutes: 60, capacity: 10, owner: citizenId, description: 'Lezione aperta per ragazzi e adulti, il judogi lo prestiamo noi.' },
    { venue: pick(has('calcio5')), title: 'Calcetto del giovedì', discipline: 'calcio5', level: 'intermedio', start: at(nextWeekday(4), 21), minutes: 60, capacity: 10, owner: citizenId, description: 'Manca sempre qualcuno: unisciti!', price: 'Quota campo divisa tra i presenti' },
    { venue: pick(has('tennis')), title: 'Doppio di tennis', discipline: 'tennis', level: 'avanzato', start: at(sun, 10), minutes: 90, capacity: 4, owner: citizenId, description: 'Cerchiamo due giocatori di buon livello per un doppio.' },
    { venue: pick(has('nuoto')), title: 'Nuoto libero accompagnato', discipline: 'nuoto', level: 'tutti', start: at(sat, 15), minutes: 60, capacity: 8, owner: citizenId, description: 'Allenamento in gruppo, ognuno al suo ritmo.' },
    { venue: pick((v) => v.accessibility === 'si', managed), title: 'Sport per tutti: attività motoria inclusiva', discipline: 'ginnastica', level: 'tutti', start: at(2, 11), minutes: 60, capacity: 12, owner: citizenId, description: 'Attività aperta a persone con e senza disabilità.' },
  ];

  await db.from('activities').delete().eq('is_demo', true);
  const rows = plan.map((p) => ({
    owner_id: p.owner,
    venue_id: p.venue.id,
    title: p.title,
    description: `${p.description}\n\nAttività di esempio creata per la demo.`,
    discipline: p.discipline,
    level: p.level,
    starts_at: p.start.toISOString(),
    ends_at: new Date(p.start.getTime() + p.minutes * 60000).toISOString(),
    capacity: p.capacity,
    accessible: p.venue.accessibility === 'si',
    price_note: p.price ?? 'Gratuita',
    latitude: p.venue.latitude,
    longitude: p.venue.longitude,
    municipio: p.venue.municipio,
    place_label: p.venue.name,
    is_demo: true,
  }));
  await must(db.from('activities').insert(rows), 'activities');
  console.log(`✓ ${rows.length} attività di esempio · gestore demo su “${managed.name}”`);
}

async function main() {
  console.log('Seed SportInComune');
  await seedSources();
  const venues = await seedVenues();
  await seedDemo(venues);
  console.log('Fatto.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
