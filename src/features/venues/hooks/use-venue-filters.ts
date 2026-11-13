'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { filtersToSearchParams, searchParamsToFilters, type VenueFilters } from '../filters';

/** I filtri vivono nell'URL: condivisibili, tornano col tasto indietro, li imposta anche la voce. */
export function useVenueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => searchParamsToFilters(new URLSearchParams(params?.toString())), [params]);

  const setFilters = useCallback(
    (next: VenueFilters) => {
      const p = filtersToSearchParams(next);
      const luogo = params?.get('luogo');
      if (luogo) p.set('luogo', luogo);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, params],
  );

  const patch = useCallback((p: Partial<VenueFilters>) => setFilters({ ...filters, ...p }), [filters, setFilters]);

  const selectedId = params?.get('luogo') ?? null;
  const setSelectedId = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(params?.toString());
      if (id) p.set('luogo', id);
      else p.delete('luogo');
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, params],
  );

  return { filters, setFilters, patch, selectedId, setSelectedId };
}
