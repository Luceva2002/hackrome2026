'use client';

import { useCallback, useEffect, useState } from 'react';

import type { VenueSummary } from '../types';

/** Un solo download dei luoghi per sessione, condiviso da Home, Mappa e Ricerca. */
let cache: VenueSummary[] | null = null;
let inflight: Promise<VenueSummary[]> | null = null;
const listeners = new Set<(v: VenueSummary[]) => void>();

/** Un luogo appena segnalato compare subito su mappa e ricerca, senza riscaricare tutto */
export function addVenue(v: VenueSummary) {
  if (!cache) return; // non ancora scaricati: arriverà col primo download
  cache = [...cache.filter((x) => x.id !== v.id), v];
  listeners.forEach((l) => l(cache!));
}

export function fetchVenues(): Promise<VenueSummary[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch('/api/venues')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => (cache = d.venues as VenueSummary[]))
    .finally(() => (inflight = null));
  return inflight;
}

export function useVenues() {
  const [venues, setVenues] = useState<VenueSummary[] | null>(cache);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    fetchVenues().then(setVenues, () => setError(true));
  }, []);

  useEffect(() => {
    if (!cache) load();
    listeners.add(setVenues);
    return () => void listeners.delete(setVenues);
  }, [load]);

  const reload = useCallback(() => {
    cache = null; // "Riprova" deve scaricare davvero, non restituire la copia in memoria
    load();
  }, [load]);

  return { venues, error, reload };
}
