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
import { ResultsCarousel } from './ResultsCarousel';
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
  const { venues: all, error, reload } = useVenues();

  // Il filtro per quartiere (`zona`) richiede i confini: si applica dopo, con le aree caricate
  const base = useMemo(() => (all ? filterVenues(all, filters) : []), [all, filters]);
  const areas = useAreas(base);
  const zonaKey = filters.zona?.join(',');
  const results = useMemo(() => {
    if (!zonaKey || !areas) return base;
    const ids = new Set(zonaKey.split(',').map(Number));
    return base.filter((v) => ids.has(areas.areaOf(v)?.id ?? -1));
  }, [base, areas, zonaKey]);
  // Il luogo aperto resta sulla mappa anche se i filtri lo escluderebbero (link condiviso, Home)
  const shown = useMemo(() => {
    if (!all || !selectedId || results.some((v) => v.id === selectedId)) return results;
    const sel = all.find((v) => v.id === selectedId);
    return sel ? [...results, sel] : results;
  }, [all, results, selectedId]);
  const summary = describeFilters(filters);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const areasRef = useRef(areas);
  areasRef.current = areas;
  const [zone, setZone] = useState<Zone>({ level: 'roma' });
  const desktop = useIsDesktop();
  // Lista dei risultati sopra il dock: solo per una ricerca vera e con la scheda del luogo chiusa
  const filterKey = JSON.stringify(filters);
  const carousel = !!all && filterKey !== '{}' && results.length > 0 && results.length <= 60 && !selectedId;
  // La camera inquadra nello spazio libero: su mobile tra logo/percorso in alto e dock (e lista) in basso,
  // su desktop tra la ricerca in alto e i bordi (i pannelli si aprono ai lati)
  const padding = desktop
    ? { top: 110, bottom: carousel ? 190 : 60, left: 80, right: 120 }
    : { top: 150, bottom: carousel ? 260 : 120, left: 24, right: 24 };
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  // Filtri cambiati (dalla ricerca o dalla voce): il Municipio nei filtri diventa il livello,
  // pochi risultati → la camera li inquadra, nessun filtro → Roma intera
  useEffect(() => {
    if (!all) return;
    const zona = filters.zona ?? [];
    if (filterKey === '{}') setZone({ level: 'roma' });
    else if (zona.length) {
      // Un quartiere: si entra nel suo livello (la mappa lo inquadra); più quartieri: si inquadrano i risultati
      const info = areas?.areaInfo.get(zona[0]);
      if (zona.length === 1 && info) setZone({ level: 'area', m: info.municipio, id: zona[0] });
      else if (areas) mapRef.current?.fitTo(resultsRef.current);
    } else if (typeof filters.municipio === 'number') setZone({ level: 'municipio', m: filters.municipio });
    else {
      // Area scelta solo perché si era aperto un luogo: la nuova ricerca torna su Roma
      const z = zoneRef.current;
      const fromPlace = z.level === 'area' && z.quiet;
      if (results.length <= 60 && (z.level === 'roma' || fromPlace)) {
        if (fromPlace) setZone({ level: 'roma', quiet: true });
        mapRef.current?.fitTo(results);
      } else if (fromPlace) setZone({ level: 'roma' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, all, !!areas]);

  // Giro dell'assistente: i timer si cancellano a ogni nuovo comando, se l'utente
  // tocca la mappa o un luogo, e quando si lascia la pagina
  const tourTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stopTour = useCallback(() => {
    tourTimers.current.forEach(clearTimeout);
    tourTimers.current = [];
  }, []);
  useEffect(() => stopTour, [stopTour]);

  // Luogo selezionato (card della Home, ricerca, assistente) → si entra nella sua area e si vola in 3D
  useEffect(() => {
    if (!all || !selectedId) return;
    const v = all.find((x) => x.id === selectedId);
    if (v?.latitude == null || v.longitude == null) return;
    const a = areas?.areaOf(v);
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
        stopTour();
        if (cmd.type === 'flyTo') m.flyTo(cmd.lng, cmd.lat, cmd.zoom, { pitch: cmd.pitch, bearing: cmd.bearing });
        if (cmd.type === 'overview') m.overview();
        if (cmd.type === 'fitResults') setTimeout(() => m.fitTo(resultsRef.current), 300);
        if (cmd.type === 'orbit') m.orbit(cmd.on);
        if (cmd.type === 'zone') {
          // Un'area inventata (o di un altro Municipio) darebbe briciole vuote e nessuna camera
          const areaOk = cmd.area != null && areasRef.current?.areaInfo.get(cmd.area)?.municipio === cmd.municipio;
          if (cmd.area && cmd.municipio && areaOk) setZone({ level: 'area', m: cmd.municipio, id: cmd.area });
          else if (cmd.municipio) setZone({ level: 'municipio', m: cmd.municipio });
          else setZone({ level: 'roma' });
        }
        if (cmd.type === 'tour') {
          tourTimers.current = cmd.ids.map((id, i) =>
            setTimeout(() => {
              const v = all?.find((x) => x.id === id);
              if (v?.latitude != null && v.longitude != null) mapRef.current?.flyTo(v.longitude, v.latitude, 16.5);
            }, i * (cmd.dwellMs ?? 3500)),
          );
        }
      }),
    [all, stopTour],
  );

  // Mentre l'assistente ascolta, la città gira piano: si vede che è "viva"
  const listening = status === 'listening';
  // (allo smontaggio l'orbita la ferma VenuesMap)
  useEffect(() => {
    mapRef.current?.orbit(listening);
  }, [listening]);

  const select = useCallback(
    (id: string) => {
      stopTour();
      setSelectedId(id);
    },
    [setSelectedId, stopTour],
  );

  const countText = error
    ? 'Non riesco a caricare i luoghi.'
    : !all
    ? 'Caricamento dei luoghi…'
    : `${results.length.toLocaleString('it-IT')} ${results.length === 1 ? 'luogo' : 'luoghi'} sulla mappa${summary ? `: ${summary}` : ''}`;

  return (
    <div className={`h-full w-full relative overflow-hidden bg-(--bg) ${carousel ? 'has-results' : ''}`}>
      <h1 className="sr-only">Mappa dei luoghi dove fare sport</h1>
      <div className="absolute inset-0">
        <VenuesMap
          ref={mapRef}
          venues={shown}
          selectedId={selectedId}
          onSelect={select}
          onUserMove={stopTour}
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

      {error && (
        <div className="absolute z-30 inset-x-edge top-24 mx-auto max-w-[420px] liquid-glass rounded-2xl p-4 flex items-center gap-3">
          <p className="flex-1 text-[14px] text-hi">Non riesco a caricare i luoghi. Controlla la connessione.</p>
          <button type="button" onClick={reload} className="h-11 px-5 rounded-xl bg-ink text-white font-bold shrink-0">
            Riprova
          </button>
        </div>
      )}

      {/* Dove sono: Roma › Municipio › area (si torna su con un tocco) */}
      {areas && zone.level !== 'roma' && (
        <nav
          aria-label="Livello della mappa"
          className="under-sheet absolute z-20 left-edge top-[calc(var(--safe-t)+var(--edge)+var(--control-h)+var(--gap))] max-w-[calc(100%-2*var(--edge))]"
        >
          <ol className="liquid-glass rounded-full h-chip pl-1.5 pr-3 flex items-center gap-1 text-[14px] font-semibold text-hi">
            <li>
              <button type="button" onClick={() => setZone({ level: 'roma' })} className="relative h-8 px-2.5 rounded-full hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-gold-500 after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']">
                Roma
              </button>
            </li>
            <li className="flex items-center gap-1 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-low shrink-0" aria-hidden />
              <button
                type="button"
                onClick={() => setZone({ level: 'municipio', m: zone.m })}
                aria-current={zone.level === 'municipio' ? 'location' : undefined}
                className="relative h-8 px-2.5 rounded-full hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-gold-500 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] flex items-center gap-1.5 whitespace-nowrap"
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
          {zone.level === 'area' && (
            <p className="mt-(--gap) liquid-glass rounded-full h-8 px-3 inline-flex items-center text-[13px] font-semibold text-mid">
              {(() => {
                // Conta quello che la mappa mostra davvero qui: i risultati più il luogo aperto
                const n = shown.filter((v) => areas.areaOf(v)?.id === zone.id).length;
                if (n === 0) return summary ? 'Nessun luogo con questi filtri in quest\'area' : 'Nessun luogo in quest\'area';
                return `${n.toLocaleString('it-IT')} ${n === 1 ? 'luogo' : 'luoghi'} in quest'area`;
              })()}
            </p>
          )}
        </nav>
      )}

      {carousel && (
        <div className="under-sheet absolute z-20 inset-x-0 bottom-[var(--dock-space)] lg:right-auto lg:w-[min(760px,calc(100%-160px))]">
          <ResultsCarousel
            venues={results}
            from={filters.vicino}
            onFocus={(v) => {
              stopTour();
              if (v.latitude != null && v.longitude != null) mapRef.current?.flyTo(v.longitude, v.latitude, 16, { offset: [0, -55] }); // a metà tra la barra in alto e la lista
            }}
            onOpen={select}
          />
        </div>
      )}

      {/* Controlli della camera, sopra il dock (e sopra la lista dei risultati) a destra */}
      <div className={`under-sheet absolute z-30 right-edge ${carousel ? 'bottom-[calc(var(--dock-space)+148px)]' : 'bottom-[var(--dock-space)]'} lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 flex flex-col gap-(--gap)`}>
        <button
          type="button"
          onClick={() => (zone.level === 'roma' ? mapRef.current?.overview() : setZone({ level: 'roma' }))}
          aria-label="Vista d'insieme in 3D"
          className="w-control h-control rounded-full liquid-glass flex items-center justify-center text-hi active:scale-90 transition-transform"
        >
          <Compass className="w-5 h-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={async () => {
            const loc = geo.location ?? (await geo.requestAccess());
            if (!loc) return;
            stopTour();
            // Si salta subito all'ultimo livello (il quartiere dove sono): via i rilievi di Roma e i colori
            // dei Municipi, restano i pin attorno a me. Quiet: la camera va sulla posizione, non sul quartiere.
            const a = areas?.areaAt(loc.longitude, loc.latitude);
            if (a?.municipio) setZone({ level: 'area', m: a.municipio, id: a.id, quiet: true });
            mapRef.current?.flyTo(loc.longitude, loc.latitude, 15.5);
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
