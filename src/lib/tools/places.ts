import 'server-only';

import { inGeometry, polygons, type Geometry, type Ring } from '@/features/map/geometry';
import { distance, fold, sound, tolerance } from '@/lib/fuzzy';
import { MAPBOX_TOKEN } from '@/lib/mapbox/config';
import quartieriJson from '../../../public/geo/quartieri.json';

/** Quartieri, rioni e zone di Roma (deliberazione 150/2026, vedi src/features/map/areas.ts) */
interface Area {
  id: number;
  nome: string;
  municipio: number;
  polys: Ring[][];
  box: [number, number, number, number];
  /** Pezzi del nome come si pronunciano: "Torrevecchia Alta" → torevecia, torevecialta, alta */
  spans: { s: string; leading: boolean }[];
}

function spansOf(nome: string) {
  const w = fold(nome).split(' ').filter((x) => x.length > 1);
  const out: Area['spans'] = [];
  for (let i = 0; i < w.length; i++) for (let j = i + 1; j <= w.length; j++) out.push({ s: sound(w.slice(i, j).join('')), leading: i === 0 });
  return out;
}

const AREAS: Area[] = (quartieriJson as unknown as { features: { geometry: Geometry; properties: { id: number; nome: string; municipio: number } }[] }).features.map(
  ({ geometry, properties: p }) => {
    const polys = polygons(geometry);
    const box: Area['box'] = [180, 90, -180, -90];
    for (const [x, y] of polys.flatMap((r) => r[0])) {
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
    return { id: p.id, nome: p.nome, municipio: p.municipio, polys, box, spans: spansOf(p.nome) };
  },
);

export const areaById = (id: number) => AREAS.find((a) => a.id === id) ?? null;

/** Id del quartiere in cui cade il punto */
export function areaIdAt(lng: number, lat: number): number | null {
  return (
    AREAS.find((a) => lng >= a.box[0] && lng <= a.box[2] && lat >= a.box[1] && lat <= a.box[3] && inGeometry(lng, lat, a.polys))?.id ?? null
  );
}

const ZONE_WORDS = /^(zona|quartiere|rione|borgata|localita) /;

export interface ZonaMatch {
  areas: { id: number; nome: string; municipio: number }[];
  /** Il nome detto è l'inizio del nome di un quartiere ("Garbatella", "Torrevecchia"), anche con errori di pronuncia */
  leading: boolean;
}

/**
 * Quartieri che corrispondono a un nome detto a voce: "Torrevecchia" → Torrevecchia Alta e Bassa,
 * "torra vecia" → gli stessi, "garbatela" → Garbatella. Vince la distanza minore; a parità,
 * i quartieri il cui nome comincia così.
 */
export function resolveZona(name: string): ZonaMatch {
  const q = sound(fold(name).replace(ZONE_WORDS, ''));
  if (q.length < 3) return { areas: [], leading: false };
  const tol = tolerance(q.length);
  let best = Infinity;
  let hits: { a: Area; leading: boolean }[] = [];
  for (const a of AREAS) {
    let d = Infinity;
    let leading = false;
    for (const sp of a.spans) {
      const x = distance(q, sp.s);
      if (x < d || (x === d && sp.leading)) [d, leading] = [x, sp.leading];
    }
    if (d > tol || d > best) continue;
    if (d < best) [best, hits] = [d, []];
    hits.push({ a, leading });
  }
  // "Monti" è il rione Monti, non anche Monti Tiburtini; "Torrevecchia" invece sono Alta e Bassa
  const whole = hits.filter((h) => sound(h.a.nome) === q);
  if (whole.length) hits = whole;
  else if (hits.some((h) => h.leading)) hits = hits.filter((h) => h.leading);
  return {
    areas: hits.slice(0, 6).map(({ a: { id, nome, municipio } }) => ({ id, nome, municipio })),
    leading: hits.length > 0 && hits[0].leading,
  };
}

/** Indirizzo o luogo di Roma → coordinate (Mapbox, limitato all'area di Roma) */
export async function geocode(indirizzo: string): Promise<{ lat: number; lng: number; trovato: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  const u = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  u.search = new URLSearchParams({
    q: /roma/i.test(indirizzo) ? indirizzo : `${indirizzo}, Roma`,
    proximity: '12.4964,41.9028',
    bbox: '12.23,41.65,12.86,42.11',
    country: 'it',
    language: 'it',
    limit: '1',
    access_token: MAPBOX_TOKEN,
  }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!r.ok) throw new Error(`Mapbox ${r.status}`);
  const f = ((await r.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: { full_address?: string; name?: string } }[] })
    .features?.[0];
  if (!f) return null;
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng, trovato: f.properties.full_address ?? f.properties.name ?? indirizzo };
}
