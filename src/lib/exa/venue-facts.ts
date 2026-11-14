/**
 * Verifica sul web delle informazioni di un impianto (Agente Catasto).
 *
 * Una ricerca Exa con output strutturato: per ogni campo trovato restituisce
 * il valore, gli URL che lo sostengono (grounding di Exa) e una confidenza.
 * Un campo senza almeno un URL viene scartato: nessun dato senza fonte.
 * Il risultato è il materiale per una `proposal` (mai una scrittura diretta
 * sulla scheda): chi lo usa lo passa alla coda delle proposte.
 */
import { getExa } from './client';

/** Id della riga in `sources` (migration 020_exa_fonte_web.sql). */
export const EXA_SOURCE_ID = 'exa_web';

/** Campi che chiediamo a Exa (max 10 proprietà per lo schema di /search). */
export const VENUE_FACT_FIELDS = [
  'status',
  'current_name',
  'opening_hours',
  'phone',
  'website',
  'cost',
  'cost_price',
  'cost_note',
] as const;
export type VenueFactField = (typeof VENUE_FACT_FIELDS)[number];

export type VenueFact = {
  value: string;
  sources: { url: string; title: string }[];
  confidence: number;
};

export type VenueFactsResult = {
  fields: Partial<Record<VenueFactField, VenueFact>>;
  /** Campi che Exa ha riempito ma senza una fonte citata: scartati. */
  droppedWithoutSource: VenueFactField[];
  results: { url: string; title: string | null }[];
  costDollars?: number;
};

const CONFIDENCE = { low: 0.3, medium: 0.6, high: 0.85 } as const;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['attivo', 'chiuso', 'ristrutturazione'],
      description: 'Stato attuale della struttura secondo fonti recenti',
    },
    current_name: { type: 'string', description: 'Nome attuale, solo se diverso da quello cercato' },
    opening_hours: { type: 'string', description: 'Orari di apertura come scritti dalla fonte' },
    phone: { type: 'string', description: 'Telefono della struttura' },
    website: { type: 'string', description: 'Sito ufficiale della struttura' },
    cost: {
      type: 'string',
      enum: ['gratuito', 'a_pagamento'],
      description: "'gratuito' se l'accesso o l'uso dei campi è gratuito, 'a_pagamento' se si paga",
    },
    cost_price: { type: 'string', description: 'Prezzo o tariffa come scritti dalla fonte, con unità (es. a persona, all\'ora), max 80 caratteri' },
    cost_note: { type: 'string', description: 'Condizioni di accesso, es. senza prenotazione, solo tesserati; max 200 caratteri' },
  },
} as const;

const SYSTEM_PROMPT = [
  'Stai verificando la scheda di un impianto sportivo di Roma per un catasto pubblico; i dati di partenza sono vecchi di oltre dieci anni.',
  'Usa solo pagine che parlano proprio di questa struttura, a questo indirizzo: scarta omonimi in altre città o altre sedi.',
  'Preferisci il sito ufficiale della struttura, le pagine di Roma Capitale e dei Municipi, le federazioni sportive, gli atti di concessione, e fonti recenti.',
  'Riporta i valori come scritti nella fonte, senza riformularli né completarli.',
  "Per il sito, indica il sito della struttura stessa, non una directory o un social se ne esiste uno ufficiale.",
  "Lo stato 'chiuso' solo se una fonte dice che la struttura è chiusa o dismessa; current_name solo se una fonte usa un nome diverso per la stessa struttura allo stesso indirizzo.",
  'Se un campo non è scritto esplicitamente in una fonte, omettilo. Mai una stima o un valore plausibile.',
].join(' ');

export async function findVenueFacts(
  venue: { name: string; address?: string | null },
  opts: { deep?: boolean } = {},
): Promise<VenueFactsResult> {
  const where = venue.address ? `${venue.address}, Roma` : 'Roma';
  const res = await getExa().search(`${venue.name}, ${where}: impianto sportivo, orari, prezzi e contatti`, {
    // deep: lo schema chiede fatti che stanno su pagine diverse (orari, tariffe, stato).
    type: opts.deep ? 'deep' : 'auto',
    objective:
      `Verificare se l'impianto sportivo "${venue.name}" (${where}) è ancora attivo e come si chiama oggi, ` +
      'e trovarne orari, telefono, sito, se è gratuito o a pagamento, con quale prezzo e a quali condizioni. ' +
      'Prima il sito ufficiale e le pagine istituzionali, poi directory affidabili e recenti; escludere omonimi altrove.',
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: OUTPUT_SCHEMA as never,
    contents: { highlights: true },
  });

  const content = (res.output?.content ?? {}) as Record<string, unknown>;
  const grounding = res.output?.grounding ?? [];
  const fields: VenueFactsResult['fields'] = {};
  const dropped: VenueFactField[] = [];

  for (const field of VENUE_FACT_FIELDS) {
    const raw = content[field];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const g = grounding.filter((e) => e.field === field || e.field.endsWith(`.${field}`));
    const sources = g
      .flatMap((e) => e.citations)
      .filter((c, i, all) => c.url && all.findIndex((x) => x.url === c.url) === i);
    if (!sources.length) {
      dropped.push(field);
      continue;
    }
    const confidence = Math.max(...g.map((e) => CONFIDENCE[e.confidence] ?? CONFIDENCE.low));
    fields[field] = { value: raw.trim(), sources, confidence };
  }

  return {
    fields,
    droppedWithoutSource: dropped,
    results: res.results.map((r) => ({ url: r.url, title: r.title })),
    costDollars: res.costDollars?.total,
  };
}

/** Valori attuali della scheda, con i nomi delle colonne di `venues`. */
export type VenueCurrent = {
  name?: string | null;
  status?: string | null;
  opening_hours?: string | null;
  phone?: string | null;
  website?: string | null;
  cost?: string | null;
  cost_price?: string | null;
  cost_note?: string | null;
};

/** Limiti delle colonne in 031_cost.sql. */
const MAX_LEN: Partial<Record<keyof VenueCurrent, number>> = { cost_price: 80, cost_note: 200 };
const COST_COLUMNS = ['cost', 'cost_price', 'cost_note'] as const;

/** Da campo di Exa a colonna di `venues` (e valore). */
function toColumn(field: VenueFactField, value: string): [keyof VenueCurrent, string] {
  switch (field) {
    case 'current_name':
      return ['name', value];
    case 'status':
      // Il catasto non ha "chiuso": la struttura chiusa diventa inagibile, con la nota della fonte.
      return ['status', value === 'chiuso' ? 'inagibile' : value];
    default:
      return [field, value];
  }
}

/**
 * Trasforma i fatti trovati nel formato di `proposals` (kind 'update'):
 * solo i campi che cambiano rispetto alla scheda attuale.
 */
export function toUpdateProposal(current: VenueCurrent, facts: VenueFactsResult) {
  const payload: Record<string, { old: string | null; new: string | null }> = {};
  const fieldSources: Record<string, { raw: string; confidence: number; note: string }> = {};
  for (const [field, fact] of Object.entries(facts.fields) as [VenueFactField, VenueFact][]) {
    const [column, rawValue] = toColumn(field, fact.value);
    const max = MAX_LEN[column];
    const value = max ? rawValue.slice(0, max) : rawValue;
    const old = current[column] ?? null;
    if (old?.trim().toLowerCase() === value.toLowerCase()) continue;
    payload[column] = { old, new: value };
    // Il costo ha una sola fonte, sotto la chiave "cost" (contratto di 031_cost.sql).
    const key = (COST_COLUMNS as readonly string[]).includes(column) ? 'cost' : column;
    const urls = fact.sources.map((s) => s.url).join(' ');
    const prev = fieldSources[key];
    fieldSources[key] = {
      raw: prev ? `${prev.raw} · ${fact.value}` : fact.value,
      confidence: prev ? Math.min(prev.confidence, fact.confidence) : fact.confidence,
      note: field === 'status' && fact.value === 'chiuso' ? `Chiuso secondo: ${urls}` : [prev?.note, urls].filter(Boolean).join(' '),
    };
  }
  // Costo: i tre campi vanno insieme. Se Exa dice "gratuito", il vecchio prezzo si azzera.
  if (payload.cost?.new === 'gratuito' && current.cost_price && !payload.cost_price) {
    payload.cost_price = { old: current.cost_price, new: null };
  }
  if (payload.cost_price && !payload.cost && facts.fields.cost === undefined) {
    // Un prezzo senza la dichiarazione del costo implica "a pagamento" solo se la scheda non dice già altro.
    if ((current.cost ?? 'da_verificare') === 'da_verificare') payload.cost = { old: current.cost ?? 'da_verificare', new: 'a_pagamento' };
  }
  const values = Object.values(fieldSources).map((f) => f.confidence);
  return {
    kind: 'update' as const,
    payload,
    field_sources: fieldSources,
    confidence: values.length ? Math.min(...values) : 0,
  };
}
