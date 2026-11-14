'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';

import { useShell } from '@/components/shell/ShellProvider';
import { useGeolocation } from '@/hooks/use-geolocation';
import { getVenueKind, VENUE_KINDS } from '@/lib/sports/taxonomy';
import { describeFilters, filterVenues } from '../filters';
import { useVenueFilters } from '../hooks/use-venue-filters';
import { useVenues } from '../hooks/use-venues';
import { LIST_PAGE, VenueList } from './VenueList';
import { VenueSheet } from './VenueSheet';
import { VenuesMap, type VenuesMapHandle } from './VenuesMap';

export function ExploreScreen() {
  const mapRef = useRef<VenuesMapHandle>(null);
  const geo = useGeolocation();
  const { filters, setFilters, selectedId, setSelectedId } = useVenueFilters();

  const { openSearch } = useShell();
  const { venues: all, error: loadError, reload: load } = useVenues();
  const [mobileList, setMobileList] = useState(false);
  const [limit, setLimit] = useState(LIST_PAGE);

  const results = useMemo(() => (all ? filterVenues(all, filters) : []), [all, filters]);
  const located = useMemo(() => results.filter((v) => v.latitude != null).length, [results]);
  const summary = describeFilters(filters);

  // Filtri cambiati → la mappa inquadra i risultati (anche quando li cambia la voce)
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setLimit(LIST_PAGE);
    if (!all || filterKey === '{}') return;
    mapRef.current?.fitTo(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, all]);

  const select = useCallback(
    (id: string) => {
      setSelectedId(id);
      setMobileList(false);
      const v = all?.find((x) => x.id === id);
      if (v?.latitude != null && v.longitude != null) mapRef.current?.flyTo(v.longitude, v.latitude);
    },
    [all, setSelectedId],
  );

  const countText = !all
    ? 'Caricamento dei luoghi…'
    : `${results.length.toLocaleString('it-IT')} ${results.length === 1 ? 'luogo' : 'luoghi'}${summary ? ` · ${summary}` : ''}`;

  return (
    <div className="h-full w-full relative overflow-hidden bg-(--bg)">
      <div className="absolute inset-0">
        <VenuesMap
          ref={mapRef}
          venues={results}
          selectedId={selectedId}
          onSelect={select}
          userLocation={geo.location}
        />
      </div>

      <div
        className="absolute top-0 left-0 right-0 h-40 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(244,245,247,0.92), rgba(244,245,247,0))' }}
        aria-hidden
      />

      <h1 className="sr-only">Mappa dei luoghi dove fare sport a Roma</h1>

      {/* Filtri attivi: si modificano dalla barra di ricerca in basso */}
      {summary && (
        <div className="absolute z-20 left-0 right-0 top-[calc(env(safe-area-inset-top)+4.75rem)] px-4 sm:px-6 flex gap-2 pointer-events-none">
          <button
            type="button"
            onClick={openSearch}
            className="pointer-events-auto liquid-glass rounded-full h-11 pl-3.5 pr-4 min-w-0 flex items-center gap-2 text-[14px] font-bold text-hi"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden />
            <span className="truncate">{summary}</span>
          </button>
          <button
            type="button"
            onClick={() => setFilters({})}
            aria-label="Azzera i filtri"
            className="pointer-events-auto liquid-glass rounded-full w-11 h-11 shrink-0 flex items-center justify-center text-hi"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      {/* Annuncio per screen reader: numero di risultati */}
      <p className="sr-only" role="status" aria-live="polite">
        {countText}
      </p>

      {/* Elenco: pannello su desktop, foglio a tutto schermo su mobile */}
      <section
        aria-label="Elenco dei luoghi"
        className={`${mobileList ? 'flex' : 'hidden'} lg:flex flex-col absolute z-20 left-0 right-0 bottom-0 top-[calc(env(safe-area-inset-top)+8.5rem)] lg:top-24 lg:left-6 lg:right-auto lg:bottom-28 lg:w-[400px] glass-heavy rounded-t-[28px] lg:rounded-[28px] overflow-hidden`}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <p className="text-[14px] font-bold text-hi" aria-hidden>
            {countText}
          </p>
          {all && located < results.length && (
            <span className="text-[12px] text-mid shrink-0">{(results.length - located).toLocaleString('it-IT')} senza posizione</span>
          )}
        </div>
        <div className="overflow-y-auto px-3 pb-dock lg:pb-4">
          {loadError ? (
            <div className="text-center py-10">
              <p className="text-[14px] text-mid mb-3">Non riesco a caricare i luoghi.</p>
              <button type="button" onClick={load} className="h-11 px-5 rounded-xl bg-ink text-white font-bold">
                Riprova
              </button>
            </div>
          ) : !all ? (
            <ul className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="h-[76px] rounded-2xl bg-white/70 animate-pulse" />
              ))}
            </ul>
          ) : (
            <VenueList
              venues={results}
              selectedId={selectedId}
              onSelect={select}
              limit={limit}
              onMore={() => setLimit((l) => l + LIST_PAGE)}
            />
          )}
        </div>
      </section>

      {/* Legenda (desktop) */}
      <div className="hidden lg:flex absolute z-10 right-6 bottom-28 glass rounded-2xl px-3 py-2 gap-3 flex-wrap max-w-[520px]" aria-hidden>
        {VENUE_KINDS.map((k) => (
          <span key={k.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-mid">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: getVenueKind(k.id).color }} />
            {k.label}
          </span>
        ))}
      </div>

      {/* Barra mobile: mappa / elenco */}
      <div className="lg:hidden absolute z-30 left-0 right-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] px-4 pointer-events-none flex justify-center">
        <button
          type="button"
          onClick={() => setMobileList((v) => !v)}
          aria-expanded={mobileList}
          className="pointer-events-auto h-12 px-5 rounded-full bg-ink text-white font-bold text-[15px] flex items-center gap-2 shadow-(--shadow-float)"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {mobileList ? <MapIcon className="w-5 h-5" aria-hidden /> : <List className="w-5 h-5" aria-hidden />}
          {mobileList ? 'Mostra la mappa' : `Elenco · ${all ? results.length.toLocaleString('it-IT') : '…'}`}
        </button>
      </div>

      <VenueSheet id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
