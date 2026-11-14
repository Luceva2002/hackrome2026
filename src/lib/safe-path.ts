const BASE = 'https://app.invalid';

/**
 * Solo percorsi interni all'app (`/mappa?…`). Scarta URL assoluti, `//host`,
 * `/\host` e trucchi simili che il browser trasformerebbe in un altro sito:
 * vale per il `next` del login e per gli URL che chiede l'assistente.
 */
export function safeAppPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  try {
    const u = new URL(raw, BASE);
    return u.origin === BASE ? u.pathname + u.search + u.hash : null;
  } catch {
    return null;
  }
}

/**
 * Aprire un luogo dalla mappa (`/mappa?luogo=…`) tiene la ricerca in corso: chiusa la scheda,
 * si ritrova la lista dei risultati invece di tutta Roma.
 */
export function keepSearch(path: string, current = window.location.search) {
  const next = new URL(path, 'http://x');
  const luogo = next.searchParams.get('luogo');
  if (!luogo || next.searchParams.size !== 1) return path;
  const p = new URLSearchParams(current);
  p.set('luogo', luogo);
  return `/mappa?${p}`;
}
