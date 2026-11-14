/** Una foto si mostra solo se sappiamo da dove viene e con che licenza. */
export interface VenuePhoto {
  url: string;
  /** Riga di credito visibile, es. "Mario Rossi · CC BY-SA 4.0 · Wikimedia Commons" */
  credit: string;
  /** Pagina della foto (autore e licenza completi) */
  sourceUrl: string;
  alt: string;
  provider: 'wikimedia' | 'exa' | 'gestore';
  /** Perché pensiamo sia questo luogo (es. "Wikidata: Stadio dei Marmi, a 40 m") */
  match: string;
}

export interface PhotoQuery {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

/** Un fornitore prova a trovare una foto verificabile; null se non è sicuro. */
export type PhotoProvider = (v: PhotoQuery, signal?: AbortSignal) => Promise<VenuePhoto | null>;
