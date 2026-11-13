/**
 * Filtri di "Esplora Luoghi": un'unica definizione per URL, API, UI e voce.
 */
import { z } from 'zod';

import { DISCIPLINES, getDiscipline, municipioLabel, parseMunicipio, VENUE_KINDS, NATURE_LABELS } from '@/lib/sports/taxonomy';
import type { VenueSummary } from './types';

export const venueFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().describe('Testo libero su nome e indirizzo'),
  disciplina: z.string().optional().describe(`Id disciplina, es. ${DISCIPLINES.slice(0, 6).map((d) => d.id).join(', ')}`),
  tipo: z.enum(VENUE_KINDS.map((k) => k.id) as [string, ...string[]]).optional().describe('Tipologia di struttura'),
  municipio: z.union([z.number().int().min(1).max(15), z.string()]).optional().describe('Municipio 1–15 o numero romano'),
  accessibile: z.boolean().optional().describe('Solo luoghi con accessibilità dichiarata'),
  natura: z.enum(Object.keys(NATURE_LABELS) as [string, ...string[]]).optional(),
  vicino: z
    .object({ lat: z.number(), lng: z.number(), km: z.number().min(0.2).max(30).default(2) })
    .optional()
    .describe('Raggio dalla posizione'),
});

export type VenueFilters = z.infer<typeof venueFiltersSchema>;

/** Gruppi: "calcio" comprende calcio a 5, 8 e 11 */
function disciplineMatches(venueDisciplines: string[], wanted: string) {
  if (venueDisciplines.includes(wanted)) return true;
  return venueDisciplines.some((d) => getDiscipline(d).group === wanted);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterVenues(venues: VenueSummary[], f: VenueFilters): VenueSummary[] {
  const mun = f.municipio != null ? parseMunicipio(f.municipio) : null;
  const q = f.q ? fold(f.q) : null;
  return venues.filter((v) => {
    if (f.disciplina && !disciplineMatches(v.disciplines, f.disciplina)) return false;
    if (f.tipo && v.kind !== f.tipo) return false;
    if (mun && v.municipio !== mun) return false;
    if (f.accessibile && v.accessibility !== 'si') return false;
    if (f.natura && v.nature !== f.natura) return false;
    if (q && !fold(`${v.name} ${v.address ?? ''}`).includes(q)) return false;
    if (f.vicino) {
      if (v.latitude == null || v.longitude == null) return false;
      if (distanceKm({ lat: v.latitude, lng: v.longitude }, f.vicino) > f.vicino.km) return false;
    }
    return true;
  });
}

// ─── URL <-> filtri ────────────────────────────────────────────────────────

export function filtersToSearchParams(f: VenueFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.disciplina) p.set('disciplina', f.disciplina);
  if (f.tipo) p.set('tipo', f.tipo);
  if (f.municipio != null) {
    const n = parseMunicipio(f.municipio);
    if (n) p.set('municipio', String(n));
  }
  if (f.accessibile) p.set('accessibile', '1');
  if (f.natura) p.set('natura', f.natura);
  if (f.vicino) p.set('vicino', `${f.vicino.lat.toFixed(5)},${f.vicino.lng.toFixed(5)},${f.vicino.km}`);
  return p;
}

export function searchParamsToFilters(p: URLSearchParams): VenueFilters {
  const f: VenueFilters = {};
  const q = p.get('q');
  if (q) f.q = q;
  const d = p.get('disciplina');
  if (d) f.disciplina = d;
  const t = p.get('tipo');
  if (t && VENUE_KINDS.some((k) => k.id === t)) f.tipo = t;
  const m = parseMunicipio(p.get('municipio'));
  if (m) f.municipio = m;
  if (p.get('accessibile') === '1') f.accessibile = true;
  const n = p.get('natura');
  if (n && n in NATURE_LABELS) f.natura = n;
  const near = p.get('vicino')?.split(',').map(Number);
  if (near && near.length === 3 && near.every(Number.isFinite)) f.vicino = { lat: near[0], lng: near[1], km: near[2] };
  return f;
}

/** Descrizione leggibile (per screen reader e per la voce) */
export function describeFilters(f: VenueFilters): string {
  const parts: string[] = [];
  if (f.disciplina) parts.push(getDiscipline(f.disciplina).label.toLowerCase());
  if (f.tipo) parts.push(VENUE_KINDS.find((k) => k.id === f.tipo)?.label.toLowerCase() ?? f.tipo);
  if (f.municipio != null) parts.push(municipioLabel(parseMunicipio(f.municipio)));
  if (f.accessibile) parts.push('accessibili');
  if (f.natura) parts.push(NATURE_LABELS[f.natura as keyof typeof NATURE_LABELS].toLowerCase());
  if (f.vicino) parts.push(`entro ${f.vicino.km} km`);
  if (f.q) parts.push(`“${f.q}”`);
  return parts.join(', ');
}
