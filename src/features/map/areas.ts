'use client';

/**
 * Municipi e quartieri di Roma con il numero di luoghi (filtrati) dentro.
 * Confini: quartieri, rioni e zone della deliberazione 150/2026 di Roma Capitale
 * (geoportale GeoRoma, dati aperti) e municipi da OpenStreetMap (ODbL), presi dal
 * progetto romaquartieri.it (urbe-hub/quartieri-roma-2026). Vedi data/sources.json.
 */
import { useEffect, useMemo, useState } from 'react';

import type { VenueSummary } from '@/features/venues/types';

type Ring = [number, number][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

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

let loading: Promise<{ municipi: AreaCollection; quartieri: AreaCollection }> | null = null;
function loadAreas() {
  loading ??= Promise.all([
    fetch('/geo/municipi.json').then((r) => r.json() as Promise<AreaCollection>),
    fetch('/geo/quartieri.json').then((r) => r.json() as Promise<AreaCollection>),
  ]).then(([municipi, quartieri]) => ({ municipi, quartieri }));
  return loading;
}

function polygons(g: Geometry): Ring[][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeometry(x: number, y: number, polys: Ring[][]) {
  return polys.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h)));
}

interface Indexed {
  f: AreaFeature;
  polys: Ring[][];
  box: [number, number, number, number];
}

function index(c: AreaCollection): Indexed[] {
  return c.features.map((f) => {
    const polys = polygons(f.geometry);
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const p of polys) for (const [x, y] of p[0]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { f, polys, box: [minX, minY, maxX, maxY] };
  });
}

function withCounts(items: Indexed[], counts: Map<number, number>) {
  let max = 1;
  for (const n of counts.values()) max = Math.max(max, n);
  const areas = {
    type: 'FeatureCollection' as const,
    features: items.map(({ f, box }) => {
      const count = counts.get(f.id) ?? 0;
      return { ...f, properties: { ...f.properties, count, t: count / max, bbox: box } };
    }),
  };
  const labels = {
    type: 'FeatureCollection' as const,
    features: items.map(({ f }) => {
      const count = counts.get(f.id) ?? 0;
      return {
        type: 'Feature' as const,
        id: f.id,
        geometry: { type: 'Point' as const, coordinates: [f.properties.lx, f.properties.ly] },
        properties: {
          nome: f.properties.romano ? `Municipio ${f.properties.romano}` : f.properties.nome,
          conteggio: count === 0 ? 'nessun luogo' : `${count} ${count === 1 ? 'luogo' : 'luoghi'}`,
          count,
        },
      };
    }),
  };
  return { areas, labels };
}

/** Municipi e quartieri con il conteggio dei luoghi passati (cambia con i filtri). */
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
    const mCounts = new Map<number, number>();
    const qCounts = new Map<number, number>();
    for (const v of venues) {
      if (v.latitude == null || v.longitude == null) continue;
      if (v.municipio) mCounts.set(v.municipio, (mCounts.get(v.municipio) ?? 0) + 1);
      const x = v.longitude;
      const y = v.latitude;
      const hit = raw.q.find(
        ({ box, polys, f }) =>
          x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inGeometry(x, y, polys),
      );
      if (hit) qCounts.set(hit.f.id, (qCounts.get(hit.f.id) ?? 0) + 1);
    }
    return { municipi: withCounts(raw.m, mCounts), quartieri: withCounts(raw.q, qCounts) };
  }, [raw, venues]);
}

const foldName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();

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
