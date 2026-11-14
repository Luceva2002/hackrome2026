/**
 * Costo di un luogo o di un'attività. Si mostra "gratuito" o un prezzo solo quando
 * c'è un dato con fonte (gestore verificato, fonte pubblica, proposta approvata) o,
 * per le attività, quando lo dichiara chi le organizza. Altrimenti "Costo da verificare".
 */
export type Cost = 'gratuito' | 'a_pagamento' | 'da_verificare';

export interface CostInfo {
  cost: Cost;
  /** Prezzo come testo breve, es. "da 8 € l'ora" */
  price: string | null;
  note: string | null;
}

export const COST_LABELS: Record<Cost, string> = {
  gratuito: 'Gratuito',
  a_pagamento: 'A pagamento',
  da_verificare: 'Costo da verificare',
};

export const UNKNOWN_COST: CostInfo = { cost: 'da_verificare', price: null, note: null };

/** Testo breve per un'etichetta: "Gratuito", "A pagamento · da 8 € l'ora", "Costo da verificare" */
export function costText(c: CostInfo, feminine = false): string {
  if (c.cost === 'gratuito') return feminine ? 'Gratuita' : 'Gratuito';
  if (c.cost === 'a_pagamento') return c.price ? `A pagamento · ${c.price}` : 'A pagamento';
  return 'Costo da verificare';
}

const FREE = /\b(gratuit[oaie]|gratis|ingresso libero|accesso libero|offerta libera)\b/i;

/**
 * Le attività hanno una nota libera scritta da chi le organizza (price_note):
 * "Gratuita" → gratuita; qualunque altro testo → a pagamento, il testo è il prezzo;
 * vuota → da verificare.
 */
export function activityCost(priceNote: string | null | undefined): CostInfo {
  const t = priceNote?.trim();
  if (!t) return UNKNOWN_COST;
  if (FREE.test(t)) return { cost: 'gratuito', price: null, note: t.length > 10 ? t : null };
  return { cost: 'a_pagamento', price: t, note: null };
}
