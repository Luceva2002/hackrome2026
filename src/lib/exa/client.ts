/**
 * Client Exa (ricerca web) per il codice lato server e per gli script.
 *
 * La chiave è EXA_API_KEY in .env.local (mai NEXT_PUBLIC_, mai committata):
 * non arriva mai al browser. Senza chiave le funzioni Exa falliscono con un
 * messaggio chiaro invece di rompere la build.
 */
import Exa from 'exa-js';

let client: Exa | null = null;

export function hasExaKey(): boolean {
  return Boolean(process.env.EXA_API_KEY);
}

export function getExa(): Exa {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('EXA_API_KEY mancante: aggiungila in .env.local');
  client ??= new Exa(key);
  return client;
}
