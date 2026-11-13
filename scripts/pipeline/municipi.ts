/**
 * Point-in-polygon sui confini dei 15 Municipi.
 * Facoltativo: se data/raw/municipi-roma.geojson non c'è, la pipeline usa la
 * conversione dalla vecchia numerazione (vedi DECISIONS.md).
 * Ogni feature deve avere una proprietà numerica o romana del Municipio
 * (municipio | MUNICIPIO | num | nome).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseMunicipio } from '../../src/lib/sports/taxonomy';

type Ring = [number, number][];
interface Area {
  n: number;
  polygons: Ring[][];
}

const FILE = resolve(__dirname, '../../data/raw/municipi-roma.geojson');

export function loadMunicipi(): Area[] | null {
  if (!existsSync(FILE)) return null;
  const gj = JSON.parse(readFileSync(FILE, 'utf8')) as {
    features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
  };
  const areas: Area[] = [];
  for (const f of gj.features) {
    const p = f.properties ?? {};
    const raw = p.municipio ?? p.MUNICIPIO ?? p.num ?? p.nome ?? p.NOME;
    const n = parseMunicipio(typeof raw === 'number' ? raw : String(raw ?? ''));
    if (!n) continue;
    const polys =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as Ring[]]
        : f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as Ring[][])
          : [];
    areas.push({ n, polygons: polys });
  }
  return areas.length ? areas : null;
}

function inRing(ring: Ring, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function municipioAt(areas: Area[], lng: number, lat: number): number | null {
  for (const a of areas) {
    for (const poly of a.polygons) {
      if (poly.length && inRing(poly[0], lng, lat) && !poly.slice(1).some((h) => inRing(h, lng, lat))) return a.n;
    }
  }
  return null;
}
