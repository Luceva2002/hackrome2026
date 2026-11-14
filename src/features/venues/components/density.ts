/**
 * Densità dei luoghi su una griglia esagonale (~450 m), per la vista d'insieme
 * in 3D: ogni esagono è un prisma alto quanto il numero di luoghi che contiene.
 * Sostituisce i "pallini" dei gruppi: si legge la città a colpo d'occhio.
 */
import type { VenueSummary } from '../types';

const LAT0 = 41.9;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const R = 450; // raggio dell'esagono in metri
const W = Math.sqrt(3) * R;
const H = 1.5 * R;

function toXY(lng: number, lat: number) {
  return { x: lng * M_PER_DEG_LNG, y: lat * M_PER_DEG_LAT };
}
function toLngLat(x: number, y: number): [number, number] {
  return [x / M_PER_DEG_LNG, y / M_PER_DEG_LAT];
}

/** Esagono "pointy-top" che contiene il punto (coordinate assiali arrotondate). */
function hexOf(x: number, y: number) {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / R;
  const r = ((2 / 3) * y) / R;
  let rx = Math.round(q);
  let rz = Math.round(r);
  const ry = Math.round(-q - r);
  const dx = Math.abs(rx - q);
  const dy = Math.abs(ry - (-q - r));
  const dz = Math.abs(rz - r);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return { q: rx, r: rz };
}

function hexCenter(q: number, r: number) {
  return { x: W * (q + r / 2), y: H * r };
}

export interface DensityCell {
  count: number;
  center: [number, number];
}

export function densityGrid(venues: VenueSummary[]) {
  const cells = new Map<string, { q: number; r: number; count: number }>();
  for (const v of venues) {
    if (v.latitude == null || v.longitude == null) continue;
    const { x, y } = toXY(v.longitude, v.latitude);
    const h = hexOf(x, y);
    const k = `${h.q}:${h.r}`;
    const c = cells.get(k);
    if (c) c.count++;
    else cells.set(k, { ...h, count: 1 });
  }
  let max = 1;
  for (const c of cells.values()) max = Math.max(max, c.count);

  const features = [...cells.values()].map((c) => {
    const { x, y } = hexCenter(c.q, c.r);
    const ring: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      // 0.86: un filo di spazio tra gli esagoni
      ring.push(toLngLat(x + R * 0.86 * Math.cos(a), y + R * 0.86 * Math.sin(a)));
    }
    ring.push(ring[0]);
    return {
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [ring] },
      properties: { count: c.count, t: c.count / max, cx: toLngLat(x, y)[0], cy: toLngLat(x, y)[1] },
    };
  });
  return { type: 'FeatureCollection' as const, features, max };
}
