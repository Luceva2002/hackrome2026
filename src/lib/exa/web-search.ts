/**
 * Ricerca web per l'agente vocale (strumento `cerca_sul_web`).
 *
 * L'LLM sceglie sia `query` sia `objective` (consiglio di Exa: mai uno
 * strumento di ricerca con la sola query) e li passiamo invariati.
 * `type: 'lite'` perché è una conversazione a voce: conta la latenza.
 * I risultati servono solo a rispondere a voce, citando il sito: non
 * diventano mai dati delle schede.
 */
import { SEARCH_OBJECTIVE_TOOL_DESCRIPTION } from 'exa-js';
import { z } from 'zod';

import { getExa } from './client';

export const webSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(300),
  objective: z.string().trim().min(2).max(1000),
});
export type WebSearchInput = z.infer<typeof webSearchInputSchema>;

export type WebSearchHit = { title: string | null; url: string; site: string; highlights: string[] };

/** Definizione dello strumento, da registrare tra i client tools della voce. */
export const WEB_SEARCH_TOOL = {
  name: 'cerca_sul_web',
  description:
    "Cerca sul web aggiornato, per domande a cui il catasto di RomaInCampo non risponde (notizie su un impianto, eventi in città, come arrivarci). Descrivi la pagina ideale invece di elencare parole chiave. Usa prima gli strumenti dell'app.",
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'La ricerca, in linguaggio naturale' },
      objective: { type: 'string', description: SEARCH_OBJECTIVE_TOOL_DESCRIPTION },
    },
    required: ['query', 'objective'],
  },
} as const;

/** Pochi risultati: l'agente li legge a voce, oltre 5 è solo latenza. */
const VOICE_RESULTS = 5;

export async function webSearch({ query, objective }: WebSearchInput): Promise<WebSearchHit[]> {
  const res = await getExa().search(query, {
    type: 'lite',
    objective,
    numResults: VOICE_RESULTS,
    userLocation: 'IT',
    contents: { highlights: true },
  });
  return res.results.map((r) => ({
    title: r.title,
    url: r.url,
    site: safeHost(r.url),
    highlights: r.highlights ?? [],
  }));
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
