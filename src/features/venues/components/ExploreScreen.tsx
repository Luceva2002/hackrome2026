'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, Map as MapIcon } from 'lucide-react';

import { AppNav } from '@/components/layout/AppNav';
import { useGeolocation } from '@/hooks/use-geolocation';
import { getVenueKind, VENUE_KINDS } from '@/lib/sports/taxonomy';
import { describeFilters, filterVenues } from '../filters';
import { useVenueFilters } from '../hooks/use-venue-filters';
import type { VenueSummary } from '../types';
import { LIST_PAGE, VenueList } from './VenueList';
import { VenueFiltersBar } from './VenueFiltersBar';
import { VenueSheet } from './VenueSheet';
import { VenuesMap, type VenuesMapHandle } from './VenuesMap';

export function ExploreScreen() {
  const mapRef = useRef<VenuesMapHandle>(null);
  const geo = useGeolocation();
  const { filters, setFilters, patch, selectedId, setSelectedId } = useVenueFilters();

  const [all, setAll] = useState<VenueSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mobileList, setMobileList] = useState(false);
  const [limit, setLimit] = useState(LIST_PAGE);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/venues');
      if (!res.ok) throw new Error(String(res.status));
      setAll((await res.json()).venues);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const nearMe = useCallback(async () => {
    const loc = geo.location ?? (await geo.requestAccess());
    if (loc) patch({ vicino: { lat: loc.latitude, lng: loc.longitude, km: 2 }, municipio: undefined });
  }, [geo, patch]);

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

      <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 pt-safe pointer-events-none">
        <div className="pointer-events-auto">
          <AppNav />
        </div>
        <div className="pointer-events-auto mt-3 sm:max-w-[560px]">
          <h1 className="sr-only">Esplora i luoghi dove fare sport a Roma</h1>
          <VenueFiltersBar filters={filters} onChange={setFilters} onNearMe={nearMe} locating={geo.loading} />
        </div>
      </div>

      {/* Annuncio per screen reader: numero di risultati */}
      <p className="sr-only" role="status" aria-live="polite">
        {countText}
      </p>

      {/* Elenco: pannello su desktop, foglio a tutto schermo su mobile */}
      <section
        aria-label="Elenco dei luoghi"
        className={`${mobileList ? 'flex' : 'hidden'} lg:flex flex-col absolute z-20 left-0 right-0 bottom-0 top-[13.5rem] lg:top-[15.5rem] lg:left-6 lg:right-auto lg:bottom-6 lg:w-[400px] glass-heavy rounded-t-[28px] lg:rounded-[28px] overflow-hidden`}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <p className="text-[14px] font-bold text-hi" aria-hidden>
            {countText}
          </p>
          {all && located < results.length && (
            <span className="text-[12px] text-mid shrink-0">{(results.length - located).toLocaleString('it-IT')} senza posizione</span>
          )}
        </div>
        <div className="overflow-y-auto px-3 pb-24 lg:pb-4">
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
      <div className="hidden lg:flex absolute z-10 right-6 bottom-6 glass rounded-2xl px-3 py-2 gap-3 flex-wrap max-w-[520px]" aria-hidden>
        {VENUE_KINDS.map((k) => (
          <span key={k.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-mid">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: getVenueKind(k.id).color }} />
            {k.label}
          </span>
        ))}
      </div>

      {/* Barra mobile: mappa / elenco */}
      <div className="lg:hidden absolute z-30 bottom-0 left-0 right-0 px-4 pb-safe pointer-events-none flex justify-center">
        <button
          type="button"
          onClick={() => setMobileList((v) => !v)}
          aria-expanded={mobileList}
          className="pointer-events-auto h-14 px-6 rounded-full bg-ink text-white font-bold text-[15px] flex items-center gap-2 shadow-(--shadow-float)"
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
