'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MapPinned, RotateCcw } from 'lucide-react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { useShell } from '@/components/shell/ShellProvider';
import { useGeolocation } from '@/hooks/use-geolocation';
import { describeFilters, filterVenues, filtersToSearchParams, searchParamsToFilters, type VenueFilters } from '@/features/venues/filters';
import { useVenues } from '@/features/venues/hooks/use-venues';
import { VenueRow } from '@/features/venues/components/VenueList';
import { SearchField, SearchFilters } from './SearchFilters';
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
  const [shown, setShown] = useState(6);

  // All'apertura riparte dai filtri già applicati alla mappa
  useEffect(() => {
    if (searchOpen) setDraft(pathname === '/mappa' ? searchParamsToFilters(new URLSearchParams(params?.toString())) : {});
  }, [searchOpen, pathname, params]);

  const results = useMemo(() => (venues ? filterVenues(venues, draft) : []), [venues, draft]);
  useEffect(() => setShown(6), [draft]);
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

  const active = Object.values(draft).some((v) => v != null && v !== '');

  return (
    <BottomSheet
      open={searchOpen}
      onClose={closeSearch}
      title="Cerca un luogo"
      size="tall"
      toolbar={<SearchField value={draft.q ?? ''} onChange={(q) => setDraft((d) => ({ ...d, q: q || undefined }))} />}
      footer={
        <div className="flex items-center gap-2">
          {active && (
            <button
              type="button"
              onClick={() => setDraft({})}
              className="h-14 px-4 rounded-full glass-well text-hi font-bold text-[15px] flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Azzera
            </button>
          )}
          <button
            type="button"
            onClick={() => go()}
            className="flex-1 min-w-0 h-14 rounded-full bg-gold-500 hover:bg-gold-400 active:scale-[0.98] transition-transform text-(--on-gold) font-bold text-[16px] flex items-center justify-center gap-2 shadow-(--shadow-gold)"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <MapPinned className="w-5 h-5 shrink-0" aria-hidden />
            <span className="truncate">
              {venues ? `Mostra ${results.length.toLocaleString('it-IT')} ${results.length === 1 ? 'luogo' : 'luoghi'}` : 'Caricamento…'}
            </span>
          </button>
        </div>
      }
    >
      <SearchFilters filters={draft} onChange={setDraft} onNearMe={nearMe} locating={geo.loading} />

      <p className="sr-only" role="status" aria-live="polite">
        {venues ? `${results.length} luoghi${summary ? `, ${summary}` : ''}` : ''}
      </p>

      {active && (
        <section className="mt-7" aria-labelledby="search-preview">
          <h3 id="search-preview" className="eyebrow mb-2.5">
            Anteprima · {results.length.toLocaleString('it-IT')} {results.length === 1 ? 'luogo' : 'luoghi'}
          </h3>
          {results.length === 0 ? (
            <p className="text-[14px] text-mid py-4">Nessun luogo con questi filtri. Prova a toglierne uno.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Risultati della ricerca">
              {results.slice(0, shown).map((v) => (
                <VenueRow key={v.id} venue={v} selected={false} onSelect={(id) => go({ luogo: id })} />
              ))}
            </ul>
          )}
          {results.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + 20)}
              className="mt-3 w-full h-control rounded-full glass-well text-hi font-bold text-[14px]"
            >
              Mostra altri {Math.min(20, results.length - shown)} di {(results.length - shown).toLocaleString('it-IT')}
            </button>
          )}
        </section>
      )}

      <WebResults query={draft.q ?? ''} />
    </BottomSheet>
  );
}
