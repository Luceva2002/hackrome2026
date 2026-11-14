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
  | { type: 'orbit'; on: boolean };

type Listener = (cmd: MapCommand) => void;

let listener: Listener | null = null;
const queue: MapCommand[] = [];

export const mapBridge = {
  send(cmd: MapCommand) {
    if (listener) listener(cmd);
    else queue.push(cmd);
  },
  /** La mappa si registra al montaggio; restituisce la funzione per staccarsi. */
  attach(fn: Listener) {
    listener = fn;
    while (queue.length) fn(queue.shift()!);
    return () => {
      if (listener === fn) listener = null;
    };
  },
};
