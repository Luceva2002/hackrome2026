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
  | { level: 'roma' }
  | { level: 'municipio'; m: number }
  /** quiet: si cambia livello senza muovere la camera (ci pensa già il volo su un luogo) */
  | { level: 'area'; m: number; id: number; quiet?: boolean };

/**
 * Un colore per Municipio, dai colori primari, secondari e d'accento del design
 * (oro, inchiostro-blu, i colori delle tipologie e i loro vicini di tono).
 */
export const MUNICIPIO_COLORS = [
  '#f5b301', // I    oro (primario)
  '#2563eb', // II   blu
  '#7c3aed', // III  viola
  '#0891b2', // IV   ciano
  '#16a34a', // V    verde
  '#ea580c', // VI   arancio
  '#db2777', // VII  rosa
  '#4f46e5', // VIII indaco
  '#059669', // IX   smeraldo
  '#0284c7', // X    azzurro
  '#e11d48', // XI   rosso
  '#ca8a04', // XII  ambra
  '#9333ea', // XIII porpora
  '#65a30d', // XIV  lime
  '#475467', // XV   ardesia
];
export const municipioColor = (m: number) => MUNICIPIO_COLORS[(m - 1) % MUNICIPIO_COLORS.length];

/** Altezza delle tessere a livello Roma per tipo d'area (H_TIPO di Urbe Hub, in metri). */
export const H_TIPO: Record<string, number> = { rione: 900, quartiere: 600, 'zona funzionale': 320 };

function mix(hex: string, withHex: string, amount: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(withHex.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - amount) + ((b >> s) & 255) * amount);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

let loading: Promise<{ municipi: AreaCollection; quartieri: AreaCollection }> | null = null;
function loadAreas() {
  loading ??= Promise.all([
    fetch('/geo/municipi.json').then((r) => r.json() as Promise<AreaCollection>),
    fetch('/geo/quartieri.json').then((r) => r.json() as Promise<AreaCollection>),
  ]).then(([municipi, quartieri]) => ({ municipi, quartieri }));
  return loading;
}

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
      .catch(() => {});
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
      features: raw.q.map(({ f, box }) => {
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
            // sfumatura del colore del municipio: più luoghi, tinta più piena
            sfumatura: count === 0 ? mix(base, '#ffffff', 0.78) : mix(base, '#ffffff', 0.62 * (1 - tm)),
            hRoma: H_TIPO[f.properties.tipo ?? 'quartiere'] ?? 320,
            bbox: box,
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
    const areaInfo = new Map(raw.q.map(({ f, box }) => [f.id, { nome: f.properties.nome, tipo: f.properties.tipo, municipio: f.properties.municipio!, box, count: qCounts.get(f.id) ?? 0 }]));
    const romano = new Map(raw.m.map(({ f }) => [f.id, f.properties.romano!]));

    const areaAt = (x: number, y: number) =>
      raw.q.find(({ box, polys }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inGeometry(x, y, polys))?.f.properties ?? null;

    return { aree, areeEtichette, municipiEtichette, municipioBox, areaInfo, romano, mCounts, areaAt };
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

/** Quartiere o rione nominato in una frase ("palestre a Monti"), il nome più lungo vince. */
export async function findQuartiereIn(text: string): Promise<AreaProps | null> {
  const { quartieri } = await loadAreas();
  const t = ` ${foldName(text)} `;
  let best: AreaProps | null = null;
  for (const f of quartieri.features) {
    const n = foldName(f.properties.nome);
    if (n.length < 4) continue;
    if (t.includes(` ${n} `) && (!best || n.length > foldName(best.nome).length)) best = f.properties;
  }
  return best;
}
