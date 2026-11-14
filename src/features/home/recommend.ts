import { distanceKm } from '@/features/venues/filters';
import type { VenueSummary } from '@/features/venues/types';

/**
 * Contratto per i "Consigliati" della Home.
 *
 * Oggi: euristica trasparente sui soli dati che abbiamo (nessun profilo inventato).
 * Fabi può sostituire `recommendVenues` con una versione che usa le preferenze
 * dell'utente e i fatti raccolti via Exa, mantenendo la stessa firma e
 * restituendo sempre un `reason` leggibile (lo mostriamo nella card).
 */
export interface RecommendContext {
  location?: { lat: number; lng: number } | null;
  /** Discipline preferite dell'utente: da collegare al profilo (oggi vuoto). */
  disciplines?: string[];
}

export interface Recommendation {
  venue: VenueSummary;
  /** Perché lo consigliamo, in italiano, sempre vero rispetto ai dati. */
  reason?: string;
  distanceKm?: number;
}

function completeness(v: VenueSummary): number {
  let s = 0;
  if (v.manager_verified) s += 4;
  if (v.accessibility === 'si') s += 2;
  if (v.status === 'attivo') s += 2;
  if (v.latitude != null) s += 1;
  if (v.structures) s += 1;
  s += Math.min(v.disciplines.length, 3) * 0.5;
  return s;
}

function reasonFor(v: VenueSummary, ctx: RecommendContext): string {
  if (ctx.disciplines?.some((d) => v.disciplines.includes(d))) return 'Per le discipline che ti interessano';
  if (v.manager_verified) return 'Gestore verificato';
  if (v.accessibility === 'si') return 'Accessibilità dichiarata';
  return 'Scheda con più dati verificati';
}

export function recommendVenues(all: VenueSummary[], ctx: RecommendContext, limit = 8): Recommendation[] {
  const prefs = new Set(ctx.disciplines ?? []);
  return all
    .filter((v) => v.latitude != null && (v.status === 'attivo' || v.status === 'da_verificare'))
    .map((v) => ({ v, s: completeness(v) + (v.disciplines.some((d) => prefs.has(d)) ? 5 : 0) }))
    .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name, 'it'))
    .slice(0, limit)
    .map(({ v }) => ({
      venue: v,
      reason: reasonFor(v, ctx),
      distanceKm: ctx.location && v.latitude != null && v.longitude != null
        ? distanceKm(ctx.location, { lat: v.latitude, lng: v.longitude })
        : undefined,
    }));
}

export function nearestVenues(all: VenueSummary[], loc: { lat: number; lng: number }, limit = 8): Recommendation[] {
  return all
    .filter((v) => v.latitude != null && v.longitude != null)
    .map((v) => ({ venue: v, distanceKm: distanceKm(loc, { lat: v.latitude!, lng: v.longitude! }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((r) => ({ ...r, reason: undefined as string | undefined }));
}
