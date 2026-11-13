import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const GEOCODE_CACHE = resolve(__dirname, '../../data/processed/geocode-cache.json');

export interface GeocodeEntry {
  status: 'ok' | 'not_found';
  lat?: number;
  lng?: number;
  relevance?: number;
  quality?: string;
  label?: string;
  at: string;
}

export type GeocodeCache = Record<string, GeocodeEntry>;

export function geocodeKey(address: string): string {
  return address.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function loadGeocodeCache(): GeocodeCache {
  return existsSync(GEOCODE_CACHE) ? JSON.parse(readFileSync(GEOCODE_CACHE, 'utf8')) : {};
}

export function saveGeocodeCache(cache: GeocodeCache) {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(GEOCODE_CACHE, JSON.stringify(sorted, null, 1));
}
