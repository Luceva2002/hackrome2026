/**
 * Adattatore della fonte "censimento-cmrc".
 *
 *   npm run pipeline:censimento            # tutta Roma
 *   npm run pipeline:censimento -- --limit 50
 *
 * Legge data/raw/impiantisportivi.csv, aggrega le righe impianto×sport,
 * normalizza discipline/strutture/stato/accessibilità, converte il Municipio
 * e scrive data/processed/venues.json (+ review.json con le righe sospette).
 * Non scrive mai sul database: il seed e le proposals sono passi separati.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';

import {
  OLD_TO_NEW_MUNICIPIO,
  classifyRawSport,
  type Accessibility,
  type OperationalStatus,
  type VenueKind,
  type VenueNature,
} from '../../src/lib/sports/taxonomy';
import type { FieldSource, VenueRecord } from '../../src/features/venues/types';
import { geocodeKey, loadGeocodeCache } from './geocode-cache';
import { labelMatches } from './address';
import { loadMunicipi, municipioAt } from './municipi';

const SOURCE = 'censimento-cmrc';
const ROOT = resolve(__dirname, '../..');
const RAW = resolve(ROOT, 'data/raw/impiantisportivi.csv');
const OUT = resolve(ROOT, 'data/processed/venues.json');
const REVIEW = resolve(ROOT, 'data/processed/review.json');
const SNAPSHOT = resolve(ROOT, 'data/processed/snapshots.json');

interface Row {
  NomeImpianto: string;
  Comune: string;
  Municipio: string;
  Indirizzo: string;
  Struttura: string;
  Attivita: string;
  Sport: string;
  Descrizione: string;
}

const argLimit = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? Number(process.argv[i + 1]) : null;
})();
const force = process.argv.includes('--force');

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const normKey = (s: string) =>
  clean(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`"“”.]/g, '')
    .replace(/\s*,\s*/g, ',');

/** Testo libero con virgolette sbilanciate → ripulito, o null se è un frammento. */
function cleanStructures(values: string[]): { text: string | null; broken: boolean } {
  let broken = false;
  const candidates = values
    .map((v) => {
      const t = clean(v);
      if (t.startsWith('"') || t.endsWith('"')) broken = true;
      return t.replace(/^"+|"+$/g, '').trim();
    })
    .filter(Boolean);
  if (!candidates.length) return { text: null, broken };
  // La versione più lunga è la più completa (le righe dello stesso impianto la ripetono)
  const text = candidates.sort((a, b) => b.length - a.length)[0];
  return { text, broken };
}

/** "19.2 Parco…" → "Parco…"; virgolette CSV raddoppiate → tipografiche */
function cleanName(raw: string): string {
  let n = clean(raw).replace(/^\d+(\.\d+)+\s+/, '').replace(/""/g, '"');
  if ((n.match(/"/g) ?? []).length % 2 === 1) n = n.replace(/^"|"$/g, '');
  if (/^".*"$/.test(n) && (n.match(/"/g) ?? []).length === 2) n = n.slice(1, -1);
  return n.replace(/"([^"]+)"/g, '“$1”').replace(/"/g, '').trim();
}

const sortKey = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^[^a-z0-9]+/, '');

const SCHOOL_RE =
  /\b(I\.?\s?I\.?\s?S|I\.?\s?T\.?\s?[ICGS]|I\.?\s?C\.|S\.?\s?M\.?\s?S|L\.?\s?S\.|L\.?\s?A\.|C\.?\s?D\.|liceo|scuola|istituto|circolo didattico|IPSIA|ITIS|ITC)\b/i;

function deriveKind(name: string, structures: string | null, structureTokens: Set<VenueKind>, nDisc: number): {
  kind: VenueKind;
  confidence: number;
} {
  const s = (structures ?? '').toLowerCase();
  if (SCHOOL_RE.test(name)) return { kind: 'palestra_scolastica', confidence: 0.8 };
  const hasPool = structureTokens.has('piscina') || /piscin|vasca/.test(s);
  const hasGym = structureTokens.has('palestra') || /palestr/.test(s);
  const hasField = structureTokens.has('campo') || /campo|campi|pista|polivalente/.test(s);
  const kinds = [hasPool, hasGym, hasField].filter(Boolean).length;
  if (kinds >= 2 || nDisc >= 5) return { kind: 'centro_sportivo', confidence: 0.75 };
  if (hasPool) return { kind: 'piscina', confidence: 0.8 };
  if (hasGym) return { kind: 'palestra', confidence: 0.8 };
  if (hasField) return { kind: 'campo', confidence: 0.7 };
  return { kind: 'altro', confidence: 0.4 };
}

function main() {
  const buf = readFileSync(RAW);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const snapshots: Record<string, { sha256: string; at: string; rows: number }> = existsSync(SNAPSHOT)
    ? JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
    : {};
  if (!force && !argLimit && snapshots[SOURCE]?.sha256 === sha256 && existsSync(OUT)) {
    const geocodeChanged = process.argv.includes('--after-geocode');
    if (!geocodeChanged) {
      console.log(`[${SOURCE}] hash invariato (${sha256.slice(0, 12)}…): salto. Usa --force per rigenerare.`);
      return;
    }
  }

  const text = buf.toString('utf8').replace(/^﻿/, '');
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy' });
  const rows = parsed.data.filter((r) => clean(r.NomeImpianto));
  const roma = rows.filter((r) => clean(r.Comune).toUpperCase() === 'ROMA');

  const groups = new Map<string, Row[]>();
  for (const r of roma) {
    const key = `${normKey(r.NomeImpianto)}|${normKey(r.Indirizzo)}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const cache = loadGeocodeCache();
  const municipi = loadMunicipi();
  const venues: VenueRecord[] = [];
  const review: { id: string; name: string; notes: string[]; raw: Row[] }[] = [];
  let junkTotal = 0;

  for (const [key, g] of groups) {
    const first = g[0];
    const id = 'cmrc-' + createHash('sha1').update(key).digest('hex').slice(0, 12);
    const name = cleanName(first.NomeImpianto);
    const address = clean(first.Indirizzo) || null;
    const notes: string[] = [];

    const disciplines = new Set<string>();
    const structureTokens = new Set<VenueKind>();
    const statuses = new Set<OperationalStatus>();
    const levels = new Set<string>();
    let disabled = false;
    let junk = 0;

    for (const r of g) {
      const c = classifyRawSport(r.Sport);
      if (c.kind === 'discipline') disciplines.add(c.value!);
      else if (c.kind === 'structure') structureTokens.add(c.value as VenueKind);
      else if (c.kind === 'status') statuses.add(c.value as OperationalStatus);
      else if (c.kind === 'junk') junk++;

      const meta = `${r.Descrizione} ${r.Attivita}`.toUpperCase();
      if (/DIV\.?\s*ABIL/.test(meta)) disabled = true;
      if (/INAGIBIL/.test(meta)) statuses.add('inagibile');
      if (/RISTRUTTURAZ/.test(meta)) statuses.add('ristrutturazione');
      if (/REALIZZAZ/.test(meta)) statuses.add('realizzazione');
      if (/PROGETTAZ/.test(meta)) statuses.add('progettazione');
      if (/AGONISTIC/.test(meta)) levels.add('agonistica');
      if (/SPORTIV/.test(meta)) levels.add('sportiva');
      if (/MOTORI/.test(meta)) levels.add('motoria');
    }
    if (/DIV\.?\s*ABIL/i.test(g.map((r) => r.Sport).join(' '))) disabled = true;

    const { text: structures, broken } = cleanStructures(g.map((r) => r.Struttura));
    if (junk) {
      junkTotal += junk;
      notes.push(`${junk} righe del CSV malformate (colonne spostate): discipline da verificare`);
    }
    if (broken) notes.push('Descrizione delle strutture troncata nel CSV');
    if (!address) notes.push('Indirizzo mancante');

    const status: OperationalStatus =
      (['inagibile', 'ristrutturazione', 'realizzazione', 'progettazione'] as const).find((s) =>
        statuses.has(s),
      ) ?? 'da_verificare';
    if (statuses.size > 1) notes.push(`Stati in conflitto nel censimento: ${[...statuses].join(', ')}`);

    const accessibility: Accessibility = disabled ? 'si' : 'da_verificare';
    const kindRes = deriveKind(name, structures, structureTokens, disciplines.size);
    const nature: VenueNature = kindRes.kind === 'palestra_scolastica' ? 'scuola' : 'da_verificare';

    // Municipio: vecchia numerazione → nuova; il point-in-polygon vince se disponibile
    const oldMun = Number(clean(first.Municipio).replace(/\D/g, '')) || null;
    let municipio = oldMun ? (OLD_TO_NEW_MUNICIPIO[oldMun] ?? null) : null;
    let munSource: FieldSource = {
      source: SOURCE,
      raw: clean(first.Municipio),
      confidence: municipio ? 0.85 : 0,
      note: 'Convertito dalla numerazione a 20 Municipi (riforma 2013)',
    };

    const geo = address ? cache[geocodeKey(address)] : undefined;
    // Un risultato che non contiene il nome della via cercata è un falso positivo
    const geoOk = !!geo && geo.status === 'ok' && labelMatches(address!, geo.label);
    const lat = geoOk ? (geo!.lat ?? null) : null;
    const lng = geoOk ? (geo!.lng ?? null) : null;
    if (lat != null && lng != null && municipi) {
      const pip = municipioAt(municipi, lng, lat);
      if (pip) {
        if (municipio && pip !== municipio) notes.push(`Municipio: censimento → ${municipio}, posizione → ${pip}`);
        municipio = pip;
        munSource = { source: 'derivato', confidence: 0.95, note: 'Calcolato dalla posizione (point-in-polygon)' };
      }
    }
    if (address && !geo) notes.push('Posizione non ancora geocodificata');
    if (geo && !geoOk) notes.push('Posizione da verificare: il geocoding non ha trovato la via');

    const venue: VenueRecord = {
      id,
      name,
      address,
      municipio,
      latitude: lat,
      longitude: lng,
      kind: kindRes.kind,
      nature,
      disciplines: [...disciplines].sort(),
      structures,
      levels: [...levels].sort(),
      status,
      accessibility,
      opening_hours: null,
      phone: null,
      website: null,
      description: null,
      community: false,
      manager_verified: false,
      needs_review: notes.some((n) => !n.startsWith('Posizione')),
      review_notes: notes,
      fields: {
        name: { source: SOURCE, confidence: 0.9, raw: clean(first.NomeImpianto) },
        address: { source: SOURCE, confidence: address ? 0.9 : 0 },
        municipio: munSource,
        ...(lat != null
          ? {
              position: {
                source: 'geocoding-mapbox',
                // Mapbox v6 non sempre restituisce match_code: la precisione la dà il tipo di risultato
                confidence: geo!.quality?.startsWith('address') ? 0.8 : 0.55,
                note: geo!.quality?.startsWith('address')
                  ? 'Geocodificato dall’indirizzo, precisione al numero civico'
                  : 'Geocodificato dall’indirizzo, precisione solo alla via: posizione approssimativa',
                raw: geo!.label,
              },
            }
          : {}),
        kind: { source: 'derivato', confidence: kindRes.confidence, note: 'Dedotto da nome e strutture del censimento' },
        nature: {
          source: nature === 'scuola' ? 'derivato' : SOURCE,
          confidence: nature === 'scuola' ? 0.7 : 0,
          note: nature === 'scuola' ? 'Dedotto dal nome dell’istituto' : 'Il censimento non indica la gestione',
        },
        disciplines: {
          source: SOURCE,
          confidence: junk ? 0.6 : 0.85,
          raw: [...new Set(g.map((r) => clean(r.Sport)))].filter(Boolean).join(' · ').slice(0, 400),
        },
        structures: { source: SOURCE, confidence: structures ? 0.8 : 0 },
        levels: { source: SOURCE, confidence: levels.size ? 0.8 : 0 },
        status: {
          source: SOURCE,
          confidence: status === 'da_verificare' ? 0 : 0.6,
          note: 'Dato precedente al 2013',
        },
        accessibility: {
          source: SOURCE,
          confidence: disabled ? 0.6 : 0,
          note: disabled ? 'Il censimento indica attività “anche per div. abili”' : 'Il censimento non lo indica',
        },
      },
    };
    venues.push(venue);
    if (venue.needs_review) review.push({ id, name, notes, raw: g.slice(0, 3) });
  }

  venues.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'it'));
  const out = argLimit ? venues.slice(0, argLimit) : venues;

  writeFileSync(OUT, JSON.stringify(out));
  writeFileSync(REVIEW, JSON.stringify(review, null, 1));
  if (!argLimit) {
    snapshots[SOURCE] = { sha256, at: new Date().toISOString(), rows: rows.length };
    writeFileSync(SNAPSHOT, JSON.stringify(snapshots, null, 2));
  }

  const geocoded = out.filter((v) => v.latitude != null).length;
  console.log(
    [
      `[${SOURCE}] righe lette: ${rows.length} · Roma: ${roma.length} · impianti: ${out.length}`,
      `  discipline riconosciute: ${out.filter((v) => v.disciplines.length).length} · righe spazzatura: ${junkTotal}`,
      `  accessibilità dichiarata: ${out.filter((v) => v.accessibility === 'si').length} · stato non attivo: ${out.filter((v) => v.status !== 'da_verificare').length}`,
      `  geocodificati: ${geocoded}/${out.length} · in revisione: ${review.length}`,
      `  → ${OUT.replace(ROOT + '/', '')}`,
    ].join('\n'),
  );
}

main();
