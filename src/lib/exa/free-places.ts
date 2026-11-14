/**
 * Ricerca di luoghi sportivi gratuiti di Roma che il censimento non ha
 * (campi liberi dei negozi sportivi, playground, campetti di quartiere).
 *
 * È un lavoro di costruzione di una lista, quindi usa l'Agent API di Exa
 * (`/agent`), con `effort` esplicito e attesa dello stato finale. Ogni luogo
 * deve avere un `source_url` che compare anche tra le citazioni del run:
 * gli URL non citati vengono scartati, così non entra niente senza fonte.
 */
import { DISCIPLINES } from '../sports/taxonomy';
import { getExa } from './client';

export type FreePlace = {
  name: string;
  address: string;
  disciplines: string[];
  kind: 'campo' | 'spazio_informale' | 'centro_sportivo';
  nature: 'pubblico' | 'privato' | 'da_verificare';
  cost: 'gratuito' | 'a_pagamento';
  cost_price?: string;
  cost_note?: string;
  description?: string;
  source_url: string;
};

const SCHEMA = {
  type: 'object',
  properties: {
    places: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome del luogo come lo chiama la fonte' },
          address: { type: 'string', description: 'Via e numero civico a Roma, come scritti dalla fonte' },
          disciplines: { type: 'array', items: { type: 'string', enum: DISCIPLINES.map((d) => d.id) } },
          kind: { type: 'string', enum: ['campo', 'spazio_informale', 'centro_sportivo'] },
          nature: { type: 'string', enum: ['pubblico', 'privato', 'da_verificare'] },
          cost: { type: 'string', enum: ['gratuito', 'a_pagamento'] },
          cost_price: { type: 'string', description: 'Solo se a pagamento: prezzo come scritto dalla fonte' },
          cost_note: { type: 'string', description: 'Condizioni di accesso: prenotazione, orari, chi può usarlo' },
          description: { type: 'string', description: 'Una frase su cosa c\'è, dalla fonte' },
          source_url: { type: 'string', format: 'uri', description: 'Pagina che descrive questo luogo e il suo accesso' },
        },
        required: ['name', 'address', 'disciplines', 'kind', 'nature', 'cost', 'source_url'],
      },
    },
  },
  required: ['places'],
} as const;

const QUERY = [
  'Trova i luoghi a Roma (Comune di Roma) dove si può fare sport gratis o quasi, che spesso mancano dai censimenti ufficiali:',
  'campi sportivi liberi o gratuiti dei negozi Decathlon di Roma, il campetto del parco ex Snia (Pigneto/Prenestino),',
  "Scalo Playground a San Lorenzo, playground di basket e calcetto ad accesso libero, aree calisthenics e street workout,",
  'campetti di quartiere riqualificati, piste e skatepark pubblici.',
].join(' ');

const SYSTEM_PROMPT = [
  'Ogni luogo deve avere un indirizzo con via a Roma e una pagina che lo descrive (source_url): niente luoghi senza fonte.',
  "Preferisci pagine ufficiali (Roma Capitale, Municipi, il sito del gestore o del negozio) e articoli recenti; scarta luoghi chiusi o dismessi.",
  "cost 'gratuito' solo se la fonte dice che l'uso è gratuito o libero; altrimenti 'a_pagamento' con il prezzo se c'è.",
  'Non inventare indirizzi, prezzi o discipline: se un dato facoltativo non è scritto nella fonte, omettilo.',
].join(' ');

const norm = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();

export async function findFreePlaces(opts: { exclude?: { name: string }[] } = {}) {
  const exa = getExa();
  const run = await exa.agent.runs.create({
    query: QUERY,
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: SCHEMA as unknown as Record<string, unknown>,
    effort: 'auto',
    budget: { maxCostDollars: 5 },
    ...(opts.exclude?.length ? { input: { exclusion: opts.exclude } } : {}),
  });
  const done = await exa.agent.runs.pollUntilFinished(run.id, { pollInterval: 4000, timeoutMs: 15 * 60_000 });
  if (done.status !== 'completed') {
    throw new Error(`Run Exa ${run.id} finito con stato ${done.status}: ${done.error?.message ?? done.stopReason ?? ''}`);
  }

  const cited = new Set((done.output?.grounding ?? []).flatMap((g) => g.citations.map((c) => norm(c.url))));
  const places = ((done.output?.structured as { places?: FreePlace[] } | undefined)?.places ?? []).filter(
    (p) => p && p.name && p.address && p.source_url,
  );
  const kept = places.filter((p) => cited.has(norm(p.source_url)));
  const dropped = places.filter((p) => !cited.has(norm(p.source_url)));
  const known = new Set(DISCIPLINES.map((d) => d.id));
  for (const p of kept) p.disciplines = (p.disciplines ?? []).filter((d) => known.has(d));

  return {
    runId: run.id,
    stopReason: done.stopReason ?? null,
    costDollars: done.costDollars?.total,
    places: kept,
    droppedWithoutCitation: dropped,
    grounding: done.output?.grounding ?? [],
  };
}
