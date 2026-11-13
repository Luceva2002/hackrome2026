/**
 * Normalizzazione degli indirizzi del censimento e verifica dei risultati del
 * geocoding. Serve perché Mapbox, con "…, Roma" nella query, a volte risponde
 * con "Via Roma Libera" o "Via Romagna": un risultato che non contiene il nome
 * della via cercata viene scartato (posizione "da verificare").
 */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bl\.\s*go\b\.?/gi, 'Largo'],
  [/\bp\.\s*zza\b\.?/gi, 'Piazza'],
  [/\bp\.\s*le\b\.?/gi, 'Piazzale'],
  [/\bv\.\s*le\b\.?/gi, 'Viale'],
  [/\bc\.\s*so\b\.?/gi, 'Corso'],
  [/\blungotev\.?\b/gi, 'Lungotevere'],
  [/\bloc\.\s*/gi, ''],
  [/\bcard\.\s*/gi, 'Cardinale '],
];

const STREET_TYPES =
  /\b(via|viale|piazza|piazzale|largo|vicolo|lungotevere|lungomare|circonvallazione|strada|salita|borgo|corso|clivo|piazzetta|passeggiata|parco|villa)\b/i;

const GENERIC = new Set(
  'via viale piazza piazzale largo vicolo lungotevere lungomare circonvallazione strada salita borgo corso clivo piazzetta passeggiata della delle dello degli dei del di da san santa sant roma snc'.split(
    ' ',
  ),
);

export interface ParsedAddress {
  street: string;
  number: string | null;
  tokens: string[];
}

export function parseAddress(address: string): ParsedAddress {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => STREET_TYPES.test(p) || /\bl\.\s*go\b|\bp\.\s*zza\b|\bv\.\s*le\b/i.test(p));
  const streetRaw = parts[idx >= 0 ? idx : 0] ?? address;
  const after = parts[(idx >= 0 ? idx : 0) + 1];
  const number = after && /^\d/.test(after) ? after.match(/^\d+[a-z]?/i)?.[0] ?? null : null;
  let street = streetRaw;
  for (const [re, rep] of ABBREVIATIONS) street = street.replace(re, rep);
  // Le iniziali ("G.P.", "A.") confondono il geocoder
  street = street.replace(/\b([A-Z]\.\s*)+/g, '').replace(/\s+/g, ' ').trim();
  const tokens = fold(street)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !GENERIC.has(t));
  return { street, number, tokens };
}

/** Il risultato contiene almeno una parola significativa della via cercata? */
export function labelMatches(address: string, label: string | undefined): boolean {
  if (!label) return false;
  // Deve essere nel Comune di Roma, non in un altro comune della provincia
  if (!/\b00\d{3} Roma\b/.test(label)) return false;
  const { tokens } = parseAddress(address);
  if (!tokens.length) return false;
  const street = fold(label.split(',')[0]);
  return tokens.some((t) => street.includes(t));
}
