/**
 * Geocoding degli indirizzi senza posizione (Mapbox, bbox di Roma, cache su file).
 *
 *   npm run pipeline:geocode
 *
 * Legge NEXT_PUBLIC_MAPBOX_TOKEN (o MAPBOX_TOKEN) da .env.local. Una richiesta
 * per indirizzo UNICO non in cache, 5 in parallelo. Rilanciabile: riprende da
 * dove si era fermato. Alla fine rigenera venues.json con le coordinate.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

import type { VenueRecord } from '../../src/features/venues/types';
import { geocodeKey, loadGeocodeCache, saveGeocodeCache } from './geocode-cache';

const ROOT = resolve(__dirname, '../..');
const ROME_BBOX = '12.23,41.65,12.86,42.10';
const ROME_CENTER = '12.4964,41.9028';

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

async function geocodeOne(token: string, address: string) {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', `${address}, Roma`);
  url.searchParams.set('country', 'it');
  url.searchParams.set('bbox', ROME_BBOX);
  url.searchParams.set('proximity', ROME_CENTER);
  url.searchParams.set('language', 'it');
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,street');
  url.searchParams.set('access_token', token);
  const res = await fetch(url);
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    features: {
      geometry: { coordinates: [number, number] };
      properties: { full_address?: string; feature_type?: string; match_code?: { confidence?: string } };
    }[];
  };
  const f = json.features[0];
  if (!f) return null;
  const conf = f.properties.match_code?.confidence;
  return {
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    label: f.properties.full_address,
    quality: `${f.properties.feature_type ?? '?'}${conf ? `, confidenza ${conf}` : ''}`,
    relevance: conf === 'exact' ? 0.95 : conf === 'high' ? 0.85 : conf === 'medium' ? 0.65 : 0.45,
  };
}

async function main() {
  loadEnv();
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    console.error('Manca NEXT_PUBLIC_MAPBOX_TOKEN in .env.local');
    process.exit(1);
  }
  const venues = JSON.parse(readFileSync(resolve(ROOT, 'data/processed/venues.json'), 'utf8')) as VenueRecord[];
  const cache = loadGeocodeCache();
  const todo = [...new Set(venues.map((v) => v.address).filter((a): a is string => !!a))].filter(
    (a) => !cache[geocodeKey(a)],
  );
  console.log(`[geocoding] ${todo.length} indirizzi da geocodificare (${Object.keys(cache).length} in cache)`);

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const address = queue.shift()!;
      try {
        const r = await geocodeOne(token!, address);
        cache[geocodeKey(address)] = r
          ? { status: 'ok', ...r, at: new Date().toISOString() }
          : { status: 'not_found', at: new Date().toISOString() };
      } catch (e) {
        failed++;
        if ((e as Error).message === 'rate_limited') {
          queue.push(address);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      done++;
      if (done % 100 === 0) {
        saveGeocodeCache(cache);
        console.log(`  ${done}/${todo.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  saveGeocodeCache(cache);
  const ok = Object.values(cache).filter((c) => c.status === 'ok').length;
  console.log(`[geocoding] fatto: ${ok} trovati, ${failed} errori di rete (rilancia per riprovare)`);
  execSync('npx tsx scripts/pipeline/censimento.ts --after-geocode', { cwd: ROOT, stdio: 'inherit' });
}

main();
