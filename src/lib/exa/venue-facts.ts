/**
 * Ricerca sul web delle informazioni operative di un impianto (Agente Catasto).
 *
 * Una ricerca Exa con output strutturato: per ogni campo trovato restituisce
 * il valore, gli URL che lo sostengono (grounding di Exa) e una confidenza.
 * Un campo senza almeno un URL viene scartato: nessun dato senza fonte.
 * Il risultato è il materiale per una `proposal` (mai una scrittura diretta
 * sulla scheda): chi lo usa lo passa alla coda delle proposte.
 */
import { getExa } from './client';

export const VENUE_FACT_FIELDS = ['opening_hours', 'phone', 'website', 'prices', 'description'] as const;
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
    opening_hours: { type: 'string', description: 'Orari di apertura come scritti dalla fonte' },
    phone: { type: 'string', description: 'Telefono della struttura' },
    website: { type: 'string', description: 'Sito ufficiale della struttura' },
    prices: { type: 'string', description: 'Tariffe o quote, come scritte dalla fonte' },
    description: { type: 'string', description: 'Una o due frasi su cosa offre la struttura' },
  },
} as const;

const SYSTEM_PROMPT = [
  "Stai verificando la scheda di un impianto sportivo di Roma per un catasto pubblico.",
  "Usa solo pagine che parlano proprio di questa struttura, a questo indirizzo: scarta omonimi in altre città o altre sedi.",
  "Preferisci il sito ufficiale della struttura, le pagine di Roma Capitale e dei Municipi, le federazioni sportive, gli atti di concessione.",
  "Riporta i valori come scritti nella fonte, senza riformularli né completarli.",
  "Se un campo non è scritto esplicitamente in una fonte, omettilo. Mai una stima o un valore plausibile.",
].join(' ');

export async function findVenueFacts(venue: { name: string; address?: string | null }): Promise<VenueFactsResult> {
  const where = venue.address ? `${venue.address}, Roma` : 'Roma';
  const res = await getExa().search(`${venue.name}, ${where}: impianto sportivo, orari, contatti, tariffe`, {
    type: 'auto',
    objective:
      `Trovare le informazioni operative dell'impianto sportivo "${venue.name}" (${where}) per una scheda pubblica: ` +
      'prima il sito ufficiale e le pagine istituzionali, poi directory affidabili; escludere omonimi altrove. ' +
      'Estrarre orari di apertura, telefono, sito, tariffe e una breve descrizione.',
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
    const sources = g.flatMap((e) => e.citations).filter((c, i, all) => c.url && all.findIndex((x) => x.url === c.url) === i);
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

/**
 * Trasforma i fatti trovati nel formato di `proposals` (kind 'update'):
 * solo i campi che cambiano rispetto alla scheda attuale.
 */
export function toUpdateProposal(
  current: Partial<Record<VenueFactField, string | null>>,
  facts: VenueFactsResult,
) {
  const payload: Record<string, { old: string | null; new: string }> = {};
  const fieldSources: Record<string, { raw: string; confidence: number; note: string }> = {};
  for (const [field, fact] of Object.entries(facts.fields) as [VenueFactField, VenueFact][]) {
    const old = current[field] ?? null;
    if (old?.trim() === fact.value) continue;
    payload[field] = { old, new: fact.value };
    fieldSources[field] = { raw: fact.value, confidence: fact.confidence, note: fact.sources.map((s) => s.url).join(' ') };
  }
  const values = Object.values(fieldSources).map((f) => f.confidence);
  return {
    kind: 'update' as const,
    payload,
    field_sources: fieldSources,
    confidence: values.length ? Math.min(...values) : 0,
  };
}
