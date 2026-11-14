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
