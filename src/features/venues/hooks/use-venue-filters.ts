'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { filtersToSearchParams, searchParamsToFilters, type VenueFilters } from '../filters';

/**
 * Ultima query string chiesta al router e non ancora arrivata in `useSearchParams`.
 * Senza, due modifiche ravvicinate (es. la voce: disciplina poi municipio) partono
 * entrambe dall'URL vecchio e la seconda cancella la prima. Condivisa tra le istanze.
 */
let pending: { qs: string; base: string } | null = null;

/** I filtri vivono nell'URL: condivisibili, tornano col tasto indietro, li imposta anche la voce. */
export function useVenueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params?.toString() ?? '';
  // Valida solo finché l'URL è quello da cui è partita (un "indietro" la annulla)
  if (pending && pending.base !== current) pending = null;

  const filters = useMemo(() => searchParamsToFilters(new URLSearchParams(current)), [current]);

  const go = useCallback(
    (p: URLSearchParams) => {
      const qs = p.toString();
      pending = { qs, base: current };
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, current],
  );
  const latest = useCallback(() => new URLSearchParams(pending?.qs ?? current), [current]);

  const setFilters = useCallback(
    (next: VenueFilters) => {
      const p = filtersToSearchParams(next);
      const luogo = latest().get('luogo');
      if (luogo) p.set('luogo', luogo);
      go(p);
    },
    [go, latest],
  );

  const patch = useCallback(
    (p: Partial<VenueFilters>) => setFilters({ ...searchParamsToFilters(latest()), ...p }),
    [latest, setFilters],
  );

  const selectedId = params?.get('luogo') ?? null;
  const setSelectedId = useCallback(
    (id: string | null) => {
      const p = latest();
      if (id) p.set('luogo', id);
      else p.delete('luogo');
      go(p);
    },
    [go, latest],
  );

  return { filters, setFilters, patch, selectedId, setSelectedId };
}
