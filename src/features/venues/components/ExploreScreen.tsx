'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { List, LocateFixed, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';

import { useShell } from '@/components/shell/ShellProvider';
import { useGeolocation } from '@/hooks/use-geolocation';
import { VENUE_KINDS } from '@/lib/sports/taxonomy';
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
        className="absolute top-0 inset-x-0 h-48 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(244,245,247,0.75), rgba(244,245,247,0))' }}
        aria-hidden
      />

      <h1 className="sr-only">Mappa dei luoghi dove fare sport a Roma</h1>

      {/* Riga sotto la top bar: filtri attivi + tipologie a un tocco (fanno anche da legenda dei pin) */}
      <div className="absolute z-20 inset-x-0 top-[calc(var(--safe-t)+var(--edge)+var(--control-h)+var(--gap))] pointer-events-none">
        <div className="flex gap-(--gap) overflow-x-auto no-scrollbar px-edge pb-2 [&>*]:pointer-events-auto" role="group" aria-label="Filtri rapidi">
          {summary && (
            <span className="flex shrink-0 liquid-glass rounded-full h-chip">
              <button type="button" onClick={openSearch} className="pl-3.5 pr-2 flex items-center gap-2 text-[14px] font-bold text-hi max-w-[60vw]">
                <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden />
                <span className="truncate">{summary}</span>
              </button>
              <button type="button" onClick={() => setFilters({})} aria-label="Azzera i filtri" className="w-10 flex items-center justify-center text-hi border-l border-black/5">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </span>
          )}
          {VENUE_KINDS.map((k) => {
            const on = filters.tipo === k.id;
            return (
              <motion.button
                key={k.id}
                type="button"
                whileTap={{ scale: 0.94 }}
                aria-pressed={on}
                onClick={() => setFilters({ ...filters, tipo: on ? undefined : k.id })}
                className={`shrink-0 h-chip pl-1.5 pr-3.5 rounded-full flex items-center gap-2 text-[14px] font-semibold transition-colors ${
                  on ? 'bg-ink text-white shadow-(--shadow-float)' : 'liquid-glass text-hi'
                }`}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[14px]" style={{ background: k.color }} aria-hidden>
                  {k.emoji}
                </span>
                {k.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Annuncio per screen reader: numero di risultati */}
      <p className="sr-only" role="status" aria-live="polite">
        {countText}
      </p>

      {/* Elenco: pannello su desktop, foglio a tutto schermo su mobile */}
      <section
        aria-label="Elenco dei luoghi"
        className={`${mobileList ? 'flex' : 'hidden'} lg:flex flex-col absolute z-20 left-edge right-edge top-[calc(var(--safe-t)+8.5rem)] bottom-[calc(var(--dock-space)+var(--control-h)+var(--gap))] lg:top-32 lg:right-auto lg:bottom-[var(--dock-space)] lg:w-[400px] liquid-glass-thick rounded-sheet overflow-hidden`}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
          <p className="text-[14px] font-bold text-hi" aria-hidden>
            {countText}
          </p>
          {all && located < results.length && (
            <span className="text-[12px] text-mid shrink-0">{(results.length - located).toLocaleString('it-IT')} senza posizione</span>
          )}
        </div>
        <div className="overflow-y-auto px-3 pb-4">
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

      {/* Barra mobile: mappa / elenco */}
      <div className="under-sheet absolute z-30 inset-x-0 bottom-[var(--dock-space)] px-edge pointer-events-none flex items-center justify-center">
        <button
          type="button"
          onClick={async () => {
            const loc = geo.location ?? (await geo.requestAccess());
            if (loc) mapRef.current?.flyTo(loc.longitude, loc.latitude, 15);
          }}
          aria-label="Centra la mappa sulla mia posizione"
          className="pointer-events-auto absolute right-edge w-control h-control rounded-full liquid-glass flex items-center justify-center text-hi active:scale-90 transition-transform"
        >
          <LocateFixed className={`w-5 h-5 ${geo.loading ? 'animate-pulse' : ''}`} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMobileList((v) => !v)}
          aria-expanded={mobileList}
          className="lg:hidden pointer-events-auto h-control px-5 rounded-full bg-ink/90 backdrop-blur-md text-white font-bold text-[15px] flex items-center gap-2 shadow-(--shadow-float) active:scale-95 transition-transform"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {mobileList ? <MapIcon className="w-5 h-5" aria-hidden /> : <List className="w-5 h-5" aria-hidden />}
          {mobileList ? 'Mostra la mappa' : `Elenco · ${all ? results.length.toLocaleString('it-IT') : '…'}`}
        </button>
      </div>

      <VenueSheet id={selectedId} onClose={() => setSelectedId(null)} userLocation={geo.location} />
    </div>
  );
}
