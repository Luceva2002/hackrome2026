/**
 * Tassonomia condivisa da pipeline (scripts/) e UI.
 * Nessuna dipendenza da Next o dal browser: deve girare anche con `tsx`.
 */

export interface Discipline {
  id: string;
  label: string;
  emoji: string;
  /** Gruppo per i filtri (es. tutte le varianti del calcio) */
  group?: string;
}

export const DISCIPLINES: Discipline[] = [
  { id: 'calcio5', label: 'Calcio a 5', emoji: '⚽', group: 'calcio' },
  { id: 'calcio8', label: 'Calcio a 7-8-9', emoji: '⚽', group: 'calcio' },
  { id: 'calcio11', label: 'Calcio a 11', emoji: '⚽', group: 'calcio' },
  { id: 'basket', label: 'Basket', emoji: '🏀' },
  { id: 'volley', label: 'Pallavolo', emoji: '🏐' },
  { id: 'beach_volley', label: 'Beach volley / tennis', emoji: '🏐' },
  { id: 'tennis', label: 'Tennis', emoji: '🎾' },
  { id: 'padel_squash', label: 'Squash', emoji: '🎾' },
  { id: 'tennistavolo', label: 'Tennistavolo', emoji: '🏓' },
  { id: 'badminton', label: 'Badminton', emoji: '🏸' },
  { id: 'nuoto', label: 'Nuoto', emoji: '🏊' },
  { id: 'subacquea', label: 'Attività subacquee', emoji: '🤿' },
  { id: 'ginnastica', label: 'Ginnastica', emoji: '🤸' },
  { id: 'danza', label: 'Danza sportiva', emoji: '💃' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘' },
  { id: 'atletica', label: 'Atletica leggera', emoji: '🏃' },
  { id: 'corsa', label: 'Corsa', emoji: '🏃' },
  { id: 'calisthenics', label: 'Calisthenics', emoji: '💪' },
  { id: 'pesistica', label: 'Pesistica', emoji: '🏋️' },
  { id: 'judo', label: 'Judo', emoji: '🥋', group: 'arti_marziali' },
  { id: 'karate', label: 'Karate', emoji: '🥋', group: 'arti_marziali' },
  { id: 'taekwondo', label: 'Taekwondo', emoji: '🥋', group: 'arti_marziali' },
  { id: 'kung_fu', label: 'Kung fu / Wushu', emoji: '🥋', group: 'arti_marziali' },
  { id: 'arti_marziali', label: 'Arti marziali', emoji: '🥋', group: 'arti_marziali' },
  { id: 'lotta', label: 'Lotta', emoji: '🤼' },
  { id: 'pugilato', label: 'Pugilato', emoji: '🥊' },
  { id: 'kickboxing', label: 'Kickboxing / Muay thai', emoji: '🥊' },
  { id: 'scherma', label: 'Scherma', emoji: '🤺' },
  { id: 'pallamano', label: 'Pallamano', emoji: '🤾' },
  { id: 'rugby', label: 'Rugby', emoji: '🏉' },
  { id: 'football_americano', label: 'Football americano', emoji: '🏈' },
  { id: 'baseball', label: 'Baseball / Softball', emoji: '⚾' },
  { id: 'cricket', label: 'Cricket', emoji: '🏏' },
  { id: 'hockey', label: 'Hockey', emoji: '🏑' },
  { id: 'pattinaggio', label: 'Pattinaggio / Skate', emoji: '🛼' },
  { id: 'ghiaccio', label: 'Sport del ghiaccio', emoji: '⛸️' },
  { id: 'equitazione', label: 'Equitazione', emoji: '🏇' },
  { id: 'arrampicata', label: 'Arrampicata', emoji: '🧗' },
  { id: 'ciclismo', label: 'Ciclismo / MTB', emoji: '🚴' },
  { id: 'canottaggio', label: 'Canottaggio', emoji: '🚣' },
  { id: 'kayak', label: 'Canoa / Kayak', emoji: '🛶' },
  { id: 'vela', label: 'Vela', emoji: '⛵' },
  { id: 'sci_nautico', label: 'Sci nautico', emoji: '🌊' },
  { id: 'triathlon', label: 'Triathlon', emoji: '🏊' },
  { id: 'golf', label: 'Golf', emoji: '⛳' },
  { id: 'bocce', label: 'Bocce', emoji: '🎳' },
  { id: 'bowling', label: 'Bowling', emoji: '🎳' },
  { id: 'biliardo', label: 'Biliardo', emoji: '🎱' },
  { id: 'tiro', label: 'Tiro (arco, volo, segno)', emoji: '🎯' },
  { id: 'pesca', label: 'Pesca sportiva', emoji: '🎣' },
  { id: 'orientamento', label: 'Orienteering', emoji: '🧭' },
  { id: 'scacchi', label: 'Scacchi / Dama / Bridge', emoji: '♟️' },
  { id: 'motori', label: 'Sport motoristici', emoji: '🏍️' },
  { id: 'aria', label: 'Volo e paracadutismo', emoji: '🪂' },
  { id: 'paintball', label: 'Paintball', emoji: '🎯' },
];

const DISCIPLINE_BY_ID = new Map(DISCIPLINES.map((d) => [d.id, d]));

export function getDiscipline(id: string): Discipline {
  return DISCIPLINE_BY_ID.get(id) ?? { id, label: id, emoji: '🏅' };
}

/** Valori grezzi della colonna Sport del censimento → disciplina. */
const RAW_SPORT_MAP: Record<string, string> = {
  'calcio-5': 'calcio5',
  'calcio 8-7-9': 'calcio8',
  'calcio-11': 'calcio11',
  basket: 'basket',
  volley: 'volley',
  'beach volley/tennis soccer': 'beach_volley',
  tennis: 'tennis',
  squash: 'padel_squash',
  'tennis tavolo': 'tennistavolo',
  badminton: 'badminton',
  'nuoto/attivita natatorie': 'nuoto',
  'attivita subacquee': 'subacquea',
  ginnastica: 'ginnastica',
  'danza sportiva': 'danza',
  'atletica leggera': 'atletica',
  pesistica: 'pesistica',
  judo: 'judo',
  karate: 'karate',
  taekwondo: 'taekwondo',
  'wushu kong fu': 'kung_fu',
  'kung fu': 'kung_fu',
  'arti marziali': 'arti_marziali',
  lotta: 'lotta',
  pugilato: 'pugilato',
  kickboxing: 'kickboxing',
  'thai boxe/muay thai': 'kickboxing',
  scherma: 'scherma',
  pallamano: 'pallamano',
  rugby: 'rugby',
  'football americano': 'football_americano',
  'baseball/softball': 'baseball',
  criket: 'cricket',
  hockey: 'hockey',
  'pattinaggio/skate': 'pattinaggio',
  'sport ghiaccio': 'ghiaccio',
  'sport equestri/turismo equestre': 'equitazione',
  'arrampicata sportiva': 'arrampicata',
  'mountain bike': 'ciclismo',
  canottaggio: 'canottaggio',
  kayak: 'kayak',
  vela: 'vela',
  'sci nautico/wakeboard': 'sci_nautico',
  motonautica: 'motori',
  triathlon: 'triathlon',
  golf: 'golf',
  bocce: 'bocce',
  bowling: 'bowling',
  'biliardo sportivo': 'biliardo',
  'tiro con arco': 'tiro',
  'tiro volo': 'tiro',
  'tiro segno': 'tiro',
  'pesca sportiva': 'pesca',
  orientamento: 'orientamento',
  'scacchi/dama': 'scacchi',
  bridge: 'scacchi',
  'sport motoristici': 'motori',
  motocross: 'motori',
  'aereoclub aeronautica sportiva': 'aria',
  paracadutismo: 'aria',
  'paint ball': 'paintball',
};

/** Valori della colonna Sport che sono strutture, non discipline. */
const RAW_STRUCTURE_MAP: Record<string, VenueKind> = {
  palestra: 'palestra',
  piscina: 'piscina',
  'impianto campo polivalente': 'campo',
};

/** Valori della colonna Sport che descrivono lo stato dell'impianto. */
const RAW_STATUS_MAP: Record<string, OperationalStatus> = {
  ristrutturazione: 'ristrutturazione',
  inagibile: 'inagibile',
  realizzazione: 'realizzazione',
  progettazione: 'progettazione',
};

/** Valori generici, non informativi ma non sospetti. */
const RAW_GENERIC = new Set([
  '',
  'attività sportiva ed agonistica',
  'attività sportiva',
  'attività agonistica',
  'attività agonistica anche per div. abili',
]);

export type SportTokenKind = 'discipline' | 'structure' | 'status' | 'generic' | 'junk';

export interface ClassifiedSport {
  kind: SportTokenKind;
  value?: string;
}

export function classifyRawSport(raw: string): ClassifiedSport {
  const key = raw.trim().toLowerCase();
  if (RAW_GENERIC.has(key)) return { kind: 'generic' };
  if (RAW_SPORT_MAP[key]) return { kind: 'discipline', value: RAW_SPORT_MAP[key] };
  if (RAW_STRUCTURE_MAP[key]) return { kind: 'structure', value: RAW_STRUCTURE_MAP[key] };
  if (RAW_STATUS_MAP[key]) return { kind: 'status', value: RAW_STATUS_MAP[key] };
  return { kind: 'junk' };
}

// ─── Tipologia (struttura) ────────────────────────────────────────────────

export type VenueKind =
  | 'centro_sportivo'
  | 'palestra'
  | 'piscina'
  | 'campo'
  | 'palestra_scolastica'
  | 'spazio_informale'
  | 'altro';

export const VENUE_KINDS: { id: VenueKind; label: string; color: string; emoji: string }[] = [
  { id: 'centro_sportivo', label: 'Centro sportivo', color: '#2563eb', emoji: '🏟️' },
  { id: 'palestra', label: 'Palestra', color: '#7c3aed', emoji: '🏋️' },
  { id: 'piscina', label: 'Piscina', color: '#0891b2', emoji: '🏊' },
  { id: 'campo', label: 'Campo all’aperto', color: '#16a34a', emoji: '⚽' },
  { id: 'palestra_scolastica', label: 'Palestra scolastica', color: '#ea580c', emoji: '🏫' },
  { id: 'spazio_informale', label: 'Spazio della community', color: '#db2777', emoji: '🌳' },
  { id: 'altro', label: 'Altro impianto', color: '#475467', emoji: '📍' },
];

export function getVenueKind(id: string) {
  return VENUE_KINDS.find((k) => k.id === id) ?? VENUE_KINDS[VENUE_KINDS.length - 1];
}

// ─── Stato operativo ──────────────────────────────────────────────────────

export type OperationalStatus =
  | 'attivo'
  | 'inagibile'
  | 'ristrutturazione'
  | 'realizzazione'
  | 'progettazione'
  | 'da_verificare';

export const STATUS_LABELS: Record<OperationalStatus, string> = {
  attivo: 'Attivo',
  inagibile: 'Inagibile',
  ristrutturazione: 'In ristrutturazione',
  realizzazione: 'In realizzazione',
  progettazione: 'In progettazione',
  da_verificare: 'Da verificare',
};

// ─── Accessibilità e natura ───────────────────────────────────────────────

export type Accessibility = 'si' | 'no' | 'da_verificare';

export const ACCESSIBILITY_LABELS: Record<Accessibility, string> = {
  si: 'Attività per persone con disabilità',
  no: 'Non accessibile',
  da_verificare: 'Accessibilità da verificare',
};

export type VenueNature = 'pubblico' | 'concessione' | 'privato' | 'scuola' | 'informale' | 'da_verificare';

export const NATURE_LABELS: Record<VenueNature, string> = {
  pubblico: 'Pubblico',
  concessione: 'Pubblico in concessione',
  privato: 'Privato',
  scuola: 'Scuola pubblica',
  informale: 'Spazio libero',
  da_verificare: 'Da verificare',
};

// ─── Municipi ─────────────────────────────────────────────────────────────

export const MUNICIPI = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV',
] as const;

export function municipioLabel(n: number | null | undefined): string {
  if (!n || n < 1 || n > 15) return 'Municipio da verificare';
  return `Municipio ${MUNICIPI[n - 1]}`;
}

/** Accetta "XV", "15", "municipio 15" → 15 */
export function parseMunicipio(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return input >= 1 && input <= 15 ? input : null;
  const s = input.trim().toUpperCase().replace(/^MUNICIPIO\s*/, '');
  const n = Number(s);
  if (Number.isInteger(n) && n >= 1 && n <= 15) return n;
  const idx = (MUNICIPI as readonly string[]).indexOf(s);
  return idx >= 0 ? idx + 1 : null;
}

/**
 * Riforma 2013 (Del. AC n. 11/2013): dai 19 Municipi (numerazione I–XX, il XIV
 * è diventato Fiumicino nel 1992) ai 15 attuali. Ogni vecchio Municipio è
 * confluito per intero in uno nuovo, quindi la conversione è deterministica a
 * meno di piccole rettifiche di confine (per questo la confidenza è 0.85).
 */
export const OLD_TO_NEW_MUNICIPIO: Record<number, number> = {
  1: 1, 17: 1,
  2: 2, 3: 2,
  4: 3,
  5: 4,
  6: 5, 7: 5,
  8: 6,
  9: 7, 10: 7,
  11: 8,
  12: 9,
  13: 10,
  15: 11,
  16: 12,
  18: 13,
  19: 14,
  20: 15,
};
