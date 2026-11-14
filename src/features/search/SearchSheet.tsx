'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MapPinned } from 'lucide-react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useShell } from '@/components/shell/ShellProvider';
import { useGeolocation } from '@/hooks/use-geolocation';
import { describeFilters, filterVenues, filtersToSearchParams, searchParamsToFilters, type VenueFilters } from '@/features/venues/filters';
import { useVenues } from '@/features/venues/hooks/use-venues';
import { VenueFiltersBar } from '@/features/venues/components/VenueFiltersBar';
import { VenueRow } from '@/features/venues/components/VenueList';
import { WebResults } from './web/WebResults';

/** Tendina dal basso: barra di ricerca in cima, filtri sotto, risultati in diretta. */
export function SearchSheet() {
  const { searchOpen, closeSearch } = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const geo = useGeolocation();
  const { venues } = useVenues();
  const [draft, setDraft] = useState<VenueFilters>({});

  // All'apertura riparte dai filtri già applicati alla mappa
  useEffect(() => {
    if (searchOpen) setDraft(pathname === '/mappa' ? searchParamsToFilters(new URLSearchParams(params?.toString())) : {});
  }, [searchOpen, pathname, params]);

  const results = useMemo(() => (venues ? filterVenues(venues, draft) : []), [venues, draft]);
  const summary = describeFilters(draft);

  const go = (extra?: Record<string, string>) => {
    const p = filtersToSearchParams(draft);
    for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
    closeSearch();
    router.push(`/mappa${p.toString() ? `?${p}` : ''}`);
  };

  const nearMe = async () => {
    const loc = geo.location ?? (await geo.requestAccess());
    if (loc) setDraft((d) => ({ ...d, municipio: undefined, vicino: { lat: loc.latitude, lng: loc.longitude, km: 2 } }));
  };

  return (
    <BottomSheet
      open={searchOpen}
      onClose={closeSearch}
      title="Cerca un luogo"
      hideTitle
      footer={
        <button
          type="button"
          onClick={() => go()}
          className="w-full h-14 rounded-2xl bg-gold-500 hover:bg-gold-400 text-(--on-gold) font-bold text-[16px] flex items-center justify-center gap-2 shadow-(--shadow-gold)"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <MapPinned className="w-5 h-5" aria-hidden />
          {venues ? `Mostra ${results.length.toLocaleString('it-IT')} luoghi sulla mappa` : 'Caricamento…'}
        </button>
      }
    >
      <VenueFiltersBar filters={draft} onChange={setDraft} onNearMe={nearMe} locating={geo.loading} layout="sheet" />

      <p className="sr-only" role="status" aria-live="polite">
        {venues ? `${results.length} luoghi${summary ? `, ${summary}` : ''}` : ''}
      </p>

      <h3 className="eyebrow mt-5 mb-2">{summary ? `Risultati · ${summary}` : 'Tutti i luoghi'}</h3>
      <ul className="flex flex-col gap-2" aria-label="Risultati della ricerca">
        {results.slice(0, 20).map((v) => (
          <VenueRow key={v.id} venue={v} selected={false} onSelect={(id) => go({ luogo: id })} />
        ))}
      </ul>
      {results.length > 20 && (
        <p className="text-[13px] text-mid mt-3 text-center">Altri {results.length - 20} sulla mappa.</p>
      )}

      <WebResults query={draft.q ?? ''} />
    </BottomSheet>
  );
}
