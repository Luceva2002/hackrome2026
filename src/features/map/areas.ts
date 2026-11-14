'use client';

/**
 * Municipi e quartieri di Roma con il numero di luoghi (filtrati) dentro.
 *
 * La gerarchia Roma → Municipio → area (quartiere, rione, zona funzionale) e le
 * altezze per tipo vengono dalla vista 3D di romaquartieri.it
 * (github.com/urbe-hub/quartieri-roma-2026, © 2026 Urbe Hub, licenza MIT),
 * riportate qui su Mapbox. Confini: quartieri della deliberazione 150/2026 di
 * Roma Capitale (geoportale GeoRoma, dati aperti) e municipi da OpenStreetMap
 * (ODbL). Vedi data/sources.json e THIRD_PARTY.md.
 */
import { useEffect, useMemo, useState } from 'react';

import type { VenueSummary } from '@/features/venues/types';

type Ring = [number, number][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
export type BBox = [number, number, number, number];

export interface AreaProps {
  id: number;
  nome: string;
  lx: number;
  ly: number;
  romano?: string;
  tipo?: string;
  municipio?: number;
}
interface AreaFeature {
  type: 'Feature';
  id: number;
  geometry: Geometry;
  properties: AreaProps;
}
interface AreaCollection {
  type: 'FeatureCollection';
  features: AreaFeature[];
}

/** Livello di lettura della mappa (come la vista 3D di Urbe Hub). */
export type Zone =
  /** quiet: si cambia livello senza muovere la camera (ci pensa già il volo su un luogo o l'inquadratura dei risultati) */
  | { level: 'roma'; quiet?: boolean }
  | { level: 'municipio'; m: number }
  | { level: 'area'; m: number; id: number; quiet?: boolean };

/**
 * Un colore per Municipio: la palette della mappa di romaquartieri.it
 * (MAPPA_PALETTE di Urbe Hub, MIT), nell'ordine dei Municipi I…XV.
 */
export const MUNICIPIO_COLORS = [
  '#D7885E', '#C99248', '#B29E44', '#93A955', '#6EB173',
  '#45B594', '#24B4B4', '#34AECE', '#5CA6DF', '#819BE5',
  '#A191DE', '#BB88CC', '#CE81B2', '#DA7F93', '#7E9AA6',
];
/** Il contorno di un'area è il suo colore scurito (scurisci di Urbe Hub, f = 0.62). */
export function scurisci(hex: string, f = 0.62) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * f);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}
export const municipioColor = (m: number) => MUNICIPIO_COLORS[(m - 1) % MUNICIPIO_COLORS.length];

/** Altezza delle tessere a livello Roma per tipo d'area (H_TIPO di Urbe Hub, in metri). */
export const H_TIPO: Record<string, number> = { rione: 900, quartiere: 600, 'zona funzionale': 320 };

let loading: Promise<{ municipi: AreaCollection; quartieri: AreaCollection }> | null = null;
const getJson = (url: string) =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<AreaCollection>) : Promise.reject(new Error(`${url}: ${r.status}`))));

function loadAreas() {
  loading ??= Promise.all([getJson('/geo/municipi.json'), getJson('/geo/quartieri.json')])
    .then(([municipi, quartieri]) => ({ municipi, quartieri }))
    .catch((e) => {
      loading = null; // una rete che cade una volta non deve spegnere le zone per tutta la sessione
      throw e;
    });
  return loading;
}

/** Scarica i confini in anticipo (1 MB): la prima frase all'assistente non deve aspettarli. */
export const preloadAreas = () => void loadAreas().catch(() => {});

const polygons = (g: Geometry): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inGeometry = (x: number, y: number, polys: Ring[][]) =>
  polys.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h)));

interface Indexed {
  f: AreaFeature;
  polys: Ring[][];
  box: BBox;
}
function index(c: AreaCollection): Indexed[] {
  return c.features.map((f) => {
    const polys = polygons(f.geometry);
    const box: BBox = [180, 90, -180, -90];
    for (const p of polys)
      for (const [x, y] of p[0]) {
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
    return { f, polys, box };
  });
}

const luoghi = (n: number) => (n === 0 ? 'nessun luogo' : `${n.toLocaleString('it-IT')} ${n === 1 ? 'luogo' : 'luoghi'}`);

/** Aree con colori, sfumature e conteggi dei luoghi passati (cambiano con i filtri). */
export function useAreas(venues: VenueSummary[]) {
  const [raw, setRaw] = useState<{ m: Indexed[]; q: Indexed[] } | null>(null);
  useEffect(() => {
    let alive = true;
    loadAreas()
      .then(({ municipi, quartieri }) => alive && setRaw({ m: index(municipi), q: index(quartieri) }))
      .catch((e) => console.warn('[aree] confini non caricati', e));
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => {
    if (!raw) return null;
    const qCounts = new Map<number, number>();
    const mCounts = new Map<number, number>();
    for (const v of venues) {
      if (v.latitude == null || v.longitude == null) continue;
      const x = v.longitude;
      const y = v.latitude;
      const hit = raw.q.find(({ box, polys }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inGeometry(x, y, polys));
      if (!hit) continue;
      qCounts.set(hit.f.id, (qCounts.get(hit.f.id) ?? 0) + 1);
      // Conteggio del Municipio = somma delle sue aree: coerente con quello che si vede
      const m = hit.f.properties.municipio!;
      mCounts.set(m, (mCounts.get(m) ?? 0) + 1);
    }

    // massimo per municipio, per le sfumature e le altezze dentro il municipio
    const maxInMun = new Map<number, number>();
    for (const { f } of raw.q) {
      const m = f.properties.municipio!;
      maxInMun.set(m, Math.max(maxInMun.get(m) ?? 1, qCounts.get(f.id) ?? 0));
    }

    const aree = {
      type: 'FeatureCollection' as const,
      features: raw.q.map(({ f }) => {
        const m = f.properties.municipio!;
        const count = qCounts.get(f.id) ?? 0;
        const tm = count / (maxInMun.get(m) ?? 1);
        const base = municipioColor(m);
        return {
          ...f,
          properties: {
            ...f.properties,
            count,
            tm,
            colore: base,
            linea: scurisci(base),
            // zone funzionali (parchi, aree industriali…): retino a righe come nella mappa di Urbe Hub
            zf: f.properties.tipo === 'zona funzionale',
            retino: `retino-${(m - 1) % MUNICIPIO_COLORS.length}`,
            hRoma: H_TIPO[f.properties.tipo ?? 'quartiere'] ?? 320,
          },
        };
      }),
    };

    const areeEtichette = {
      type: 'FeatureCollection' as const,
      features: raw.q.map(({ f }) => ({
        type: 'Feature' as const,
        id: f.id,
        geometry: { type: 'Point' as const, coordinates: [f.properties.lx, f.properties.ly] },
        properties: { id: f.id, municipio: f.properties.municipio, nome: f.properties.nome, conteggio: luoghi(qCounts.get(f.id) ?? 0), count: qCounts.get(f.id) ?? 0 },
      })),
    };

    const municipiEtichette = {
      type: 'FeatureCollection' as const,
      features: raw.m.map(({ f }) => ({
        type: 'Feature' as const,
        id: f.id,
        geometry: { type: 'Point' as const, coordinates: [f.properties.lx, f.properties.ly] },
        properties: { id: f.id, nome: `Municipio ${f.properties.romano}`, conteggio: luoghi(mCounts.get(f.id) ?? 0), count: mCounts.get(f.id) ?? 0 },
      })),
    };

    const municipioBox = new Map<number, BBox>(raw.m.map(({ f, box }) => [f.id, box]));
    const romaBox: BBox = [180, 90, -180, -90];
    for (const { box } of raw.m) {
      romaBox[0] = Math.min(romaBox[0], box[0]);
      romaBox[1] = Math.min(romaBox[1], box[1]);
      romaBox[2] = Math.max(romaBox[2], box[2]);
      romaBox[3] = Math.max(romaBox[3], box[3]);
    }
    const municipi = { type: 'FeatureCollection' as const, features: raw.m.map(({ f }) => f) };
    const areaInfo = new Map(raw.q.map(({ f, box }) => [f.id, { nome: f.properties.nome, tipo: f.properties.tipo, municipio: f.properties.municipio!, box, count: qCounts.get(f.id) ?? 0 }]));
    const romano = new Map(raw.m.map(({ f }) => [f.id, f.properties.romano!]));

    const areaAt = (x: number, y: number) =>
      raw.q.find(({ box, polys }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inGeometry(x, y, polys))?.f.properties ?? null;

    return { aree, municipi, areeEtichette, municipiEtichette, municipioBox, romaBox, areaInfo, romano, mCounts, areaAt };
  }, [raw, venues]);
}

export type Areas = NonNullable<ReturnType<typeof useAreas>>;

const foldName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();

/** Davanti al nome serve un "a / in / al / zona…": "Ponte", "Borgo", "Italia" sono anche parole comuni */
/** Nomi di aree che sono soprattutto parole comuni: valgono solo dopo "zona / quartiere / rione" */
const COMMON = new Set(['italia', 'regola', 'salone', 'colonna', 'decima']);
const PLACE_WORDS = ['a', 'ad', 'in', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'nel', 'nello', 'nella', 'zona', 'quartiere', 'rione', 'verso', 'dalle parti di', 'vicino a'];

/** Quartiere o rione nominato in una frase ("palestre a Monti"), il nome più lungo vince. */
export async function findQuartiereIn(text: string): Promise<AreaProps | null> {
  const t = ` ${foldName(text)} `;
  // Niente "a/in/zona…" nella frase: non può nominare un quartiere, e non si aspetta il download
  if (!PLACE_WORDS.some((w) => t.includes(` ${w} `))) return null;
  const { quartieri } = await loadAreas();
  let best: AreaProps | null = null;
  for (const f of quartieri.features) {
    const n = foldName(f.properties.nome);
    if (n.length < 4) continue;
    const named = (COMMON.has(n) ? ['zona', 'quartiere', 'rione'] : PLACE_WORDS).some((w) => t.includes(` ${w} ${n} `));
    if (named && (!best || n.length > foldName(best.nome).length)) best = f.properties;
  }
  return best;
}
