'use client';

/**
 * PUNTO DI AGGANCIO PER FABI (ricerca via Exa).
 *
 * Compare nella tendina di ricerca sotto i luoghi trovati. Riceve la frase
 * cercata dall'utente; può chiamare `POST /api/exa/search {query, objective}`
 * (branch feat/exa) e mostrare i risultati con il sito di provenienza.
 * Regole: citare sempre la fonte, non scrivere mai sulle schede dei luoghi.
 * Oggi non mostra nulla.
 */
export function WebResults({ query }: { query: string }) {
  void query;
  return null;
}
