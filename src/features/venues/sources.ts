import sources from '../../../data/sources.json';

export interface SourceInfo {
  id: string;
  titolo: string;
  ente: string;
  url: string;
  licenza: string;
}

const EXTRA: Record<string, { titolo: string; ente: string }> = {
  gestore: { titolo: 'Gestore verificato', ente: 'Dato inserito dal gestore dell’impianto' },
  community: { titolo: 'Community', ente: 'Segnalato da un cittadino' },
  derivato: { titolo: 'Elaborazione RomaInCampo', ente: 'Dedotto dalle fonti pubbliche' },
};

export function sourceLabel(id: string): { titolo: string; ente: string; licenza?: string } {
  const s = (sources as SourceInfo[]).find((x) => x.id === id);
  if (s) return { titolo: s.titolo, ente: s.ente, licenza: s.licenza };
  return EXTRA[id] ?? { titolo: id, ente: '' };
}

export const ALL_SOURCES = sources as SourceInfo[];
