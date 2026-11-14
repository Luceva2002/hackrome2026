/**
 * Ponte tra l'assistente (o qualunque altra parte dell'app) e la mappa.
 *
 * Filtri e luogo selezionato passano dall'URL (`/mappa?disciplina=…&luogo=…`):
 * è il contratto stabile. Il ponte serve per ciò che l'URL non dice: i
 * movimenti di camera (volo, giro panoramico, vista d'insieme).
 * I comandi inviati quando la mappa non è montata aspettano che si monti.
 */
export type MapCommand =
  | { type: 'flyTo'; lng: number; lat: number; zoom?: number; pitch?: number; bearing?: number }
  | { type: 'overview' }
  | { type: 'fitResults' }
  /** Giro: vola su ogni luogo, uno dopo l'altro (per presentare i risultati a voce) */
  | { type: 'tour'; ids: string[]; dwellMs?: number }
  | { type: 'orbit'; on: boolean }
  /** Livello di lettura: Roma intera, un Municipio (1–15) o un'area (id di public/geo/quartieri.json) */
  | { type: 'zone'; municipio?: number; area?: number };

type Listener = (cmd: MapCommand) => void;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * I comandi arrivano anche dal motore vocale (testo di un modello, non fidato):
 * coordinate fuori range farebbero lanciare Mapbox, liste enormi creerebbero
 * centinaia di timer. Qui si scarta o si limita, mai si lancia.
 */
export function sanitizeMapCommand(cmd: MapCommand): MapCommand | null {
  switch (cmd?.type) {
    case 'flyTo':
      if (!finite(cmd.lng) || !finite(cmd.lat) || Math.abs(cmd.lng) > 180 || Math.abs(cmd.lat) > 90) return null;
      return {
        type: 'flyTo',
        lng: cmd.lng,
        lat: cmd.lat,
        zoom: finite(cmd.zoom) ? clamp(cmd.zoom, 8, 19) : undefined,
        pitch: finite(cmd.pitch) ? clamp(cmd.pitch, 0, 70) : undefined,
        bearing: finite(cmd.bearing) ? cmd.bearing % 360 : undefined,
      };
    case 'tour': {
      const ids = Array.isArray(cmd.ids) ? cmd.ids.filter((x) => typeof x === 'string').slice(0, 10) : [];
      if (!ids.length) return null;
      return { type: 'tour', ids, dwellMs: finite(cmd.dwellMs) ? clamp(cmd.dwellMs, 1500, 8000) : undefined };
    }
    case 'orbit':
      return { type: 'orbit', on: cmd.on === true };
    case 'zone': {
      const municipio = finite(cmd.municipio) && Number.isInteger(cmd.municipio) && cmd.municipio >= 1 && cmd.municipio <= 15 ? cmd.municipio : undefined;
      const area = finite(cmd.area) && Number.isInteger(cmd.area) && municipio ? cmd.area : undefined;
      return { type: 'zone', municipio, area };
    }
    case 'overview':
    case 'fitResults':
      return { type: cmd.type };
    default:
      return null;
  }
}

let listener: Listener | null = null;
/** In attesa della mappa: solo gli ultimi, e solo se recenti (un volo di 1 minuto fa non serve più) */
let queue: { cmd: MapCommand; at: number }[] = [];
const QUEUE_TTL = 8000;

export const mapBridge = {
  send(raw: MapCommand) {
    const cmd = sanitizeMapCommand(raw);
    if (!cmd) return;
    if (listener) listener(cmd);
    else queue = [...queue, { cmd, at: Date.now() }].slice(-5);
  },
  /** La mappa si registra al montaggio; restituisce la funzione per staccarsi. */
  attach(fn: Listener) {
    listener = fn;
    const fresh = queue.filter((q) => Date.now() - q.at < QUEUE_TTL);
    queue = [];
    for (const q of fresh) fn(q.cmd);
    return () => {
      if (listener === fn) listener = null;
    };
  },
};
