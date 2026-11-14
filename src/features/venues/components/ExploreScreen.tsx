'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Compass, LocateFixed } from 'lucide-react';

import { useAssistant } from '@/features/assistant/AssistantProvider';
import { municipioColor, useAreas, type Zone } from '@/features/map/areas';
import { mapBridge } from '@/features/map/map-bridge';
import { useGeolocation } from '@/hooks/use-geolocation';
import { describeFilters, filterVenues } from '../filters';
import { useVenueFilters } from '../hooks/use-venue-filters';
import { useVenues } from '../hooks/use-venues';
import { VenueSheet } from './VenueSheet';
import { VenuesMap, type VenuesMapHandle } from './VenuesMap';

/**
 * La mappa è il centro dell'app: niente elenco né filtri fissi sopra.
 * Si filtra dalla ricerca (dock) o a voce; l'assistente muove la camera.
 * Alternativa accessibile alla mappa: i risultati nella tendina di ricerca.
 */
export function ExploreScreen() {
  const mapRef = useRef<VenuesMapHandle>(null);
  const geo = useGeolocation();
  const { filters, selectedId, setSelectedId } = useVenueFilters();
  const { status } = useAssistant();
  const { venues: all } = useVenues();

  const results = useMemo(() => (all ? filterVenues(all, filters) : []), [all, filters]);
  const summary = describeFilters(filters);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const areas = useAreas(results);
  const [zone, setZone] = useState<Zone>({ level: 'roma' });
  const desktop = useIsDesktop();
  // Su desktop i pannelli stanno ai lati: la camera inquadra nello spazio libero
  const padding = desktop ? { top: 120, bottom: 60, left: 80, right: 80 } : { top: 110, bottom: 150, left: 30, right: 30 };
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  // Filtri cambiati (dalla ricerca o dalla voce): il Municipio nei filtri diventa il livello,
  // pochi risultati → la camera li inquadra, nessun filtro → Roma intera
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    if (!all) return;
    if (filterKey === '{}') setZone({ level: 'roma' });
    else if (typeof filters.municipio === 'number') setZone({ level: 'municipio', m: filters.municipio });
    else if (results.length <= 40 && zoneRef.current.level === 'roma') mapRef.current?.fitTo(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, all]);

  // Luogo selezionato (card della Home, ricerca, assistente) → si entra nella sua area e si vola in 3D
  useEffect(() => {
    if (!all || !selectedId) return;
    const v = all.find((x) => x.id === selectedId);
    if (v?.latitude == null || v.longitude == null) return;
    const a = areas?.areaAt(v.longitude, v.latitude);
    if (a?.municipio) setZone({ level: 'area', m: a.municipio, id: a.id, quiet: true });
    mapRef.current?.flyTo(v.longitude, v.latitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, selectedId, !!areas]);

  // Comandi di camera dall'assistente
  useEffect(
    () =>
      mapBridge.attach((cmd) => {
        const m = mapRef.current;
        if (!m) return;
        if (cmd.type === 'flyTo') m.flyTo(cmd.lng, cmd.lat, cmd.zoom, { pitch: cmd.pitch, bearing: cmd.bearing });
        if (cmd.type === 'overview') m.overview();
        if (cmd.type === 'fitResults') setTimeout(() => m.fitTo(resultsRef.current), 300);
        if (cmd.type === 'orbit') m.orbit(cmd.on);
        if (cmd.type === 'zone') {
          if (cmd.area && cmd.municipio) setZone({ level: 'area', m: cmd.municipio, id: cmd.area });
          else if (cmd.municipio) setZone({ level: 'municipio', m: cmd.municipio });
          else setZone({ level: 'roma' });
        }
        if (cmd.type === 'tour') {
          cmd.ids.forEach((id, i) =>
            setTimeout(() => {
              const v = all?.find((x) => x.id === id);
              if (v?.latitude != null && v.longitude != null) m.flyTo(v.longitude, v.latitude, 16.5);
            }, i * (cmd.dwellMs ?? 3500)),
          );
        }
      }),
    [all],
  );

  // Mentre l'assistente ascolta, la città gira piano: si vede che è "viva"
  const listening = status === 'listening';
  useEffect(() => {
    mapRef.current?.orbit(listening);
    return () => mapRef.current?.orbit(false);
  }, [listening]);

  const select = useCallback((id: string) => setSelectedId(id), [setSelectedId]);

  const countText = !all
    ? 'Caricamento dei luoghi…'
    : `${results.length.toLocaleString('it-IT')} ${results.length === 1 ? 'luogo' : 'luoghi'} sulla mappa${summary ? `: ${summary}` : ''}`;

  return (
    <div className="h-full w-full relative overflow-hidden bg-(--bg)">
      <h1 className="sr-only">Mappa dei luoghi dove fare sport</h1>
      <div className="absolute inset-0">
        <VenuesMap
          ref={mapRef}
          venues={results}
          selectedId={selectedId}
          onSelect={select}
          userLocation={geo.location}
          areas={areas}
          zone={zone}
          onZone={setZone}
          padding={padding}
        />
      </div>

      {/* Velo in alto per leggere logo e profilo sopra la mappa */}
      <div
        className="absolute top-0 inset-x-0 h-28 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to bottom, rgba(244,245,247,0.6), rgba(244,245,247,0))' }}
        aria-hidden
      />

      {/* L'assistente sta ascoltando o pensando: bordo dorato che respira */}
      <motion.div
        aria-hidden
        className="absolute inset-0 z-10 pointer-events-none"
        initial={false}
        animate={{ opacity: status === 'listening' || status === 'thinking' || status === 'speaking' ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        style={{ boxShadow: 'inset 0 0 80px 10px rgba(245,179,1,0.45)' }}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {countText}
      </p>

      {/* Dove sono: Roma › Municipio › area (si torna su con un tocco) */}
      {areas && zone.level !== 'roma' && (
        <nav
          aria-label="Livello della mappa"
          className="under-sheet absolute z-20 left-edge top-[calc(var(--safe-t)+var(--edge)+var(--control-h)+var(--gap))] max-w-[calc(100%-2*var(--edge))]"
        >
          <ol className="liquid-glass rounded-full h-chip pl-1.5 pr-3 flex items-center gap-1 text-[14px] font-semibold text-hi">
            <li>
              <button type="button" onClick={() => setZone({ level: 'roma' })} className="h-8 px-2.5 rounded-full hover:bg-white/70">
                Roma
              </button>
            </li>
            <li className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-low shrink-0" aria-hidden />
              <button
                type="button"
                onClick={() => setZone({ level: 'municipio', m: zone.m })}
                aria-current={zone.level === 'municipio' ? 'location' : undefined}
                className="h-8 px-2.5 rounded-full hover:bg-white/70 flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: municipioColor(zone.m) }} aria-hidden />
                Municipio {areas.romano.get(zone.m)}
              </button>
            </li>
            {zone.level === 'area' && (
              <li className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3.5 h-3.5 text-low shrink-0" aria-hidden />
                <span aria-current="location" className="px-1.5 truncate">
                  {areas.areaInfo.get(zone.id)?.nome}
                </span>
              </li>
            )}
          </ol>
        </nav>
      )}

      {/* Controlli della camera, sopra il dock a destra */}
      <div className="under-sheet absolute z-30 right-edge bottom-[var(--dock-space)] lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 flex flex-col gap-(--gap)">
        <button
          type="button"
          onClick={() => setZone({ level: 'roma' })}
          aria-label="Vista d'insieme in 3D"
          className="w-control h-control rounded-full liquid-glass flex items-center justify-center text-hi active:scale-90 transition-transform"
        >
          <Compass className="w-5 h-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={async () => {
            const loc = geo.location ?? (await geo.requestAccess());
            if (loc) mapRef.current?.flyTo(loc.longitude, loc.latitude, 15.5);
          }}
          aria-label="Centra la mappa sulla mia posizione"
          className="w-control h-control rounded-full liquid-glass flex items-center justify-center text-hi active:scale-90 transition-transform"
        >
          <LocateFixed className={`w-5 h-5 ${geo.loading ? 'animate-pulse' : ''}`} aria-hidden />
        </button>
      </div>

      <VenueSheet id={selectedId} onClose={() => setSelectedId(null)} userLocation={geo.location} />
    </div>
  );
}

function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setD(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return d;
}
