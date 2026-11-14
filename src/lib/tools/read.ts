import 'server-only';

import { z } from 'zod';

import { activityFiltersSchema, activityFiltersToParams, filterActivities } from '@/features/activities/filters';
import { listUpcoming, PUBLIC_COLUMNS } from '@/features/activities/server/repository';
import type { ActivityPublic } from '@/features/activities/types';
import { LEVEL_LABELS } from '@/features/activities/types';
import { describeFilters, distanceKm, filterVenues, filtersToSearchParams, textMatches, venueFiltersSchema, type VenueFilters } from '@/features/venues/filters';
import { getVenue, listVenues } from '@/features/venues/server/repository';
import type { VenueSummary } from '@/features/venues/types';
import { costText } from '@/lib/cost';
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

import { areaById, areaIdAt, geocode, resolveZona } from './places';
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

/** Quartiere di ogni luogo: le coordinate non cambiano durante la vita del server */
const areaMemo = new Map<string, number | null>();
const areaOfVenue = (v: VenueSummary) => {
  if (v.latitude == null || v.longitude == null) return null;
  if (!areaMemo.has(v.id)) areaMemo.set(v.id, areaIdAt(v.longitude, v.latitude));
  return areaMemo.get(v.id)!;
};

export const cercaImpianti = defineTool({
  name: 'cerca_impianti',
  description:
    'Cerca luoghi per fare sport a Roma (impianti, palestre, piscine, campi, spazi della community) con filtri combinati. ' +
    'Un quartiere o una zona va in `zona` (anche detto male: lo riconosce lo strumento), una via o un indirizzo in `indirizzo`, ' +
    'il nome di un impianto in `q`. Restituisce il totale, i primi risultati e `url`. ' +
    'Subito dopo chiama SEMPRE `naviga` con quell’url: l’utente deve vedere sullo schermo ciò che gli dici.',
  input: venueFiltersSchema.omit({ zona: true }).extend({
    disciplina,
    q: z.string().trim().max(80).optional().describe('Solo il nome (o parte del nome) di un impianto, es. "Foro Italico", "Aniene". Mai sport, quartieri o frasi intere.'),
    zona: z.string().trim().max(60).optional().describe('Quartiere, rione o zona di Roma come l’ha detto l’utente, es. "Garbatella", "Torrevecchia", "Monti".'),
    indirizzo: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe('Via, piazza, indirizzo o punto noto di Roma, es. "via Cassia", "piazza Zambeccari 3", "stazione Termini". Cerca entro 1 km (o `vicino.km`).'),
  }),
  run: async ({ zona: zonaName, indirizzo, ...rest }) => {
    const f: VenueFilters = { ...rest };
    const notes: string[] = [];
    const { venues } = await listVenues();

    // Quartiere: dal campo zona, oppure da un `q` che in realtà è un quartiere ("impianti a Garbatella")
    let areas = zonaName ? resolveZona(zonaName).areas : [];
    if (zonaName && !areas.length) notes.push(`Non conosco il quartiere “${zonaName}”: ho cercato il nome nei luoghi.`);
    if (zonaName && !areas.length) f.q = zonaName;
    if (!zonaName && f.q) {
      // "Garbatella" è un quartiere; "Aniene" è (anche) il nome di un circolo: resta testo se c'è un luogo con quel nome
      const asArea = resolveZona(f.q);
      const byText = venues.some((v) => textMatches(v, f.q!));
      if (asArea.areas.length && (asArea.leading || !byText)) {
        areas = asArea.areas;
        delete f.q;
      }
    }
    if (areas.length) f.zona = areas.map((a) => a.id);

    let indirizzo_trovato: string | undefined;
    if (indirizzo) {
      const g = await geocode(indirizzo);
      if (!g) return { totale: 0, errore: `Non trovo “${indirizzo}” a Roma. Chiedi all’utente di ripetere l’indirizzo o il quartiere.` };
      indirizzo_trovato = g.trovato;
      f.vicino = { lat: g.lat, lng: g.lng, km: f.vicino?.km ?? 1 };
    }

    const found = filterVenues(venues, f, areaOfVenue);
    if (f.vicino) {
      const at = f.vicino;
      const d = (v: VenueSummary) => distanceKm(at, { lat: v.latitude!, lng: v.longitude! });
      found.sort((a, b) => d(a) - d(b));
    }
    const approx = !!f.q && found.length > 0 && !found.some((v) => textMatches(v, f.q!));
    if (approx) notes.push(`Nessun nome uguale a “${f.q}”: questi sono i più simili, chiedi conferma.`);
    if (!found.length && f.q) notes.push('Nessun luogo con quel nome. Se è una via o un indirizzo riprova con `indirizzo`, se è un quartiere con `zona`.');
    if (!found.length && areas.length) notes.push('Nessun luogo con questi filtri nel quartiere: proponi di cercare nei dintorni (indirizzo o vicino, 2 km).');

    return {
      totale: found.length,
      filtri: [areas.length ? areas.map((a) => a.nome).join(', ') : '', indirizzo_trovato ? `vicino a ${indirizzo_trovato}` : '', describeFilters({ ...f, zona: undefined })]
        .filter(Boolean)
        .join(', ') || 'nessuno',
      ...(areas.length ? { quartieri: areas.map((a) => `${a.nome} (${municipioLabel(a.municipio)})`) } : {}),
      ...(notes.length ? { note: notes } : {}),
      risultati: found.slice(0, MAX_ITEMS).map((v) => venueBrief(v, f.vicino)),
      url: withUrl('/mappa', filtersToSearchParams(f)),
    };
  },
});

export const dettagliLuogo = defineTool({
  name: 'dettagli_luogo',
  description:
    'Scheda completa di un luogo dato il suo id (da cerca_impianti): orari, contatti, costo, sport, accessibilità, la fonte di ogni dato ' +
    'e le attività in programma lì a cui ci si può iscrivere. Cita la fonte quando leggi un dato incerto. Dopo chiama `naviga` con l’url.',
  input: z.object({ id: z.string().min(1).max(64).describe('Id del luogo') }),
  run: async ({ id }, { sb }) => {
    const v = await getVenue(id);
    if (!v) return { errore: 'Luogo non trovato' };
    return {
      ...venueBrief(v),
      stato: STATUS_LABELS[v.status],
      quartiere: (() => {
        const id = v.latitude != null && v.longitude != null ? areaIdAt(v.longitude, v.latitude) : null;
        return id ? areaById(id)?.nome : undefined;
      })(),
      costo: costText({ cost: v.cost, price: v.cost_price, note: v.cost_note }),
      nota_costo: v.cost_note,
      livelli: v.levels,
      strutture: v.structures,
      orari: v.opening_hours,
      telefono: v.phone,
      sito: v.website,
      descrizione: v.description,
      gestore_verificato: v.manager_verified,
      da_verificare: v.needs_review ? v.review_notes : undefined,
      fonti: Object.fromEntries(Object.entries(v.fields).map(([campo, s]) => [campo, s?.source])),
      attivita_in_programma: filterActivities(await listUpcoming(sb), { luogo: v.id })
        .slice(0, 5)
        .map((a) => ({ id: a.id, titolo: a.title, quando: formatSlot(a.starts_at, a.ends_at), posti_liberi: a.spots_left, url: `/attivita/${a.id}` })),
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
