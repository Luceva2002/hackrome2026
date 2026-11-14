/** Utilità condivise dagli script Exa: env, Supabase (service role), geocoding Mapbox. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { labelMatches } from '../pipeline/address';
import { loadMunicipi, municipioAt } from '../pipeline/municipi';

export const ROOT = resolve(__dirname, '../..');

export function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  if (!process.env.EXA_API_KEY) {
    console.error('Manca EXA_API_KEY in .env.local');
    process.exit(1);
  }
}

export function flag(name: string) {
  return process.argv.includes(`--${name}`);
}
export function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Client con service role: serve per leggere i luoghi e inserire proposte (mai scritture sulle schede). */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function writeReport(name: string, data: unknown) {
  const p = resolve(ROOT, 'data/exa', name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
  console.log(`→ ${p}`);
}

/** Lavora su una coda con N richieste in parallelo. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const ROME_BBOX = '12.23,41.65,12.86,42.10';
let municipi: ReturnType<typeof loadMunicipi> | undefined;

/**
 * Posizione certa di un indirizzo: stessa regola del geocoding del censimento
 * (il risultato contiene la via cercata ed è nel Comune di Roma) + un Municipio.
 */
export async function geocodeAddress(address: string) {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error('Manca NEXT_PUBLIC_MAPBOX_TOKEN in .env.local');
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', /\broma\b/i.test(address) ? address : `${address}, Roma`);
  url.searchParams.set('country', 'it');
  url.searchParams.set('bbox', ROME_BBOX);
  url.searchParams.set('language', 'it');
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,street');
  url.searchParams.set('access_token', token);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox HTTP ${res.status}`);
  const json = (await res.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: { full_address?: string } }[];
  };
  const f = json.features[0];
  if (!f || !labelMatches(address, f.properties.full_address)) return null;
  const [lng, lat] = f.geometry.coordinates;
  municipi ??= loadMunicipi();
  const municipio = municipi ? municipioAt(municipi, lng, lat) : null;
  return { lat, lng, label: f.properties.full_address ?? '', municipio };
}
