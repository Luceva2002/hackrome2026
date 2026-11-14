import 'server-only';

import { z } from 'zod';

import { activityFiltersSchema, activityFiltersToParams, filterActivities } from '@/features/activities/filters';
import { listUpcoming, PUBLIC_COLUMNS } from '@/features/activities/server/repository';
import type { ActivityPublic } from '@/features/activities/types';
import { LEVEL_LABELS } from '@/features/activities/types';
import { describeFilters, distanceKm, filterVenues, filtersToSearchParams, venueFiltersSchema } from '@/features/venues/filters';
import { getVenue, listVenues } from '@/features/venues/server/repository';
import type { VenueSummary } from '@/features/venues/types';
import { formatSlot } from '@/lib/rome-time';
import {
  ACCESSIBILITY_LABELS,
  DISCIPLINES,
  getDiscipline,
  getVenueKind,
  municipioLabel,
  NATURE_LABELS,
  STATUS_LABELS,
} from '@/lib/sports/taxonomy';

import { defineTool } from './types';

/** Risultati letti a voce: pochi, il resto lo mostra lo schermo */
const MAX_ITEMS = 8;

const DISCIPLINE_IDS = ['calcio', ...DISCIPLINES.map((d) => d.id)] as [string, ...string[]];
const disciplina = z
  .enum(DISCIPLINE_IDS)
  .optional()
  .describe('Sport. "calcio" comprende calcio a 5, 8 e 11. Traduci la richiesta dell’utente in uno di questi id.');

const withUrl = (path: string, params: URLSearchParams) => (params.size ? `${path}?${params}` : path);

const venueBrief = (v: VenueSummary, from?: { lat: number; lng: number }) => ({
  id: v.id,
  nome: v.name,
  indirizzo: v.address,
  municipio: municipioLabel(v.municipio),
  tipo: getVenueKind(v.kind).label,
  sport: v.disciplines.map((d) => getDiscipline(d).label),
  accessibilita: ACCESSIBILITY_LABELS[v.accessibility],
  natura: NATURE_LABELS[v.nature],
  segnalato_dalla_community: v.community,
  /** Apre la scheda del luogo e porta la mappa sul punto vero */
  url: `/mappa?luogo=${encodeURIComponent(v.id)}`,
  ...(from && v.latitude != null && v.longitude != null
    ? { distanza_km: Math.round(distanceKm(from, { lat: v.latitude, lng: v.longitude }) * 10) / 10 }
    : {}),
});

const activityBrief = (a: ActivityPublic) => ({
  id: a.id,
  titolo: a.title,
  sport: getDiscipline(a.discipline).label,
  livello: LEVEL_LABELS[a.level],
  quando: formatSlot(a.starts_at, a.ends_at),
  inizio: a.starts_at,
  luogo: a.venue_name ?? a.place_label,
  municipio: municipioLabel(a.municipio),
  posti_liberi: a.spots_left,
  in_lista_attesa: a.waitlist_count,
  accessibile: a.accessible,
  organizzatore: a.owner_name,
  url: `/attivita/${a.id}`,
});

export const cercaImpianti = defineTool({
  name: 'cerca_impianti',
  description:
    'Cerca luoghi per fare sport a Roma (impianti, palestre, piscine, campi, spazi della community) con filtri combinati. ' +
    'Restituisce il totale, i primi risultati e `url`. Subito dopo chiama SEMPRE `naviga` con quell’url: l’utente deve vedere sullo schermo ciò che gli dici.',
  input: venueFiltersSchema.extend({ disciplina }),
  run: async (f) => {
    const { venues } = await listVenues();
    const found = filterVenues(venues, f);
    if (f.vicino) {
      const at = f.vicino;
      const d = (v: VenueSummary) => distanceKm(at, { lat: v.latitude!, lng: v.longitude! });
      found.sort((a, b) => d(a) - d(b));
    }
    return {
      totale: found.length,
      filtri: describeFilters(f) || 'nessuno',
      risultati: found.slice(0, MAX_ITEMS).map((v) => venueBrief(v, f.vicino)),
      url: withUrl('/mappa', filtersToSearchParams(f)),
    };
  },
});

export const dettagliLuogo = defineTool({
  name: 'dettagli_luogo',
  description:
    'Scheda completa di un luogo dato il suo id (da cerca_impianti): orari, contatti, sport, accessibilità e la fonte di ogni dato. ' +
    'Cita la fonte quando leggi un dato incerto.',
  input: z.object({ id: z.string().min(1).max(64).describe('Id del luogo') }),
  run: async ({ id }) => {
    const v = await getVenue(id);
    if (!v) return { errore: 'Luogo non trovato' };
    return {
      ...venueBrief(v),
      stato: STATUS_LABELS[v.status],
      strutture: v.structures,
      orari: v.opening_hours,
      telefono: v.phone,
      sito: v.website,
      descrizione: v.description,
      gestore_verificato: v.manager_verified,
      fonti: Object.fromEntries(Object.entries(v.fields).map(([campo, s]) => [campo, s?.source])),
      url: `/mappa?luogo=${encodeURIComponent(v.id)}`,
    };
  },
});

export const cercaAttivita = defineTool({
  name: 'cerca_attivita',
  description:
    'Cerca attività sportive organizzate dai cittadini (eventi a cui iscriversi), solo future e pubblicate. ' +
    'Restituisce il totale, le prime in ordine di data e `url`. Subito dopo chiama SEMPRE `naviga` con quell’url: l’utente deve vedere sullo schermo ciò che gli dici.',
  input: activityFiltersSchema.extend({ disciplina }),
  run: async (f, { sb }) => {
    const found = filterActivities(await listUpcoming(sb), f);
    return {
      totale: found.length,
      risultati: found.slice(0, MAX_ITEMS).map(activityBrief),
      url: withUrl('/attivita', activityFiltersToParams(f)),
    };
  },
});

export const dettagliAttivita = defineTool({
  name: 'dettagli_attivita',
  description: 'Dettaglio di un’attività dato il suo id (da cerca_attivita): descrizione, luogo, posti, lista d’attesa, costo.',
  input: z.object({ id: z.string().uuid().describe('Id dell’attività') }),
  run: async ({ id }, { sb }) => {
    const { data, error } = await sb.from('activities_public').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error('Lettura attività non riuscita');
    if (!data) return { errore: 'Attività non trovata' };
    const a = data as ActivityPublic;
    return {
      ...activityBrief(a),
      descrizione: a.description,
      capienza: a.capacity,
      costo: a.price_note,
      annullata: a.status === 'cancelled',
      id_luogo: a.venue_id,
      url: `/attivita/${a.id}`,
    };
  },
});

/** Strumenti eseguiti sul server ed esposti via MCP: solo letture di dati pubblici */
export const READ_TOOLS = [cercaImpianti, dettagliLuogo, cercaAttivita, dettagliAttivita];
