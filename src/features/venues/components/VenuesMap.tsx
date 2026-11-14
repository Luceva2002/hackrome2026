'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import MapGL, { AttributionControl, Layer, Marker, Source, type MapRef, type MapMouseEvent, type ViewStateChangeEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FilterSpecification } from 'mapbox-gl';

import { UserLocationDot } from '@/features/map/components/UserLocationDot';
import { DEFAULT_CENTER, MAPBOX_TOKEN, MAP_LIGHT_PRESET, MAP_STYLES } from '@/lib/mapbox/config';
import { VENUE_KINDS } from '@/lib/sports/taxonomy';
import type { VenueSummary } from '../types';
import { type Areas, type BBox, type Zone } from '@/features/map/areas';
import { registerPins } from './map-pins';
import { registerHatches } from '@/features/map/hatch';

export interface VenuesMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number, opts?: { pitch?: number; bearing?: number; offset?: [number, number] }) => void;
  fitTo: (venues: VenueSummary[]) => void;
  overview: () => void;
  /** Rotazione lenta della camera (es. mentre l'assistente ascolta) */
  orbit: (on: boolean) => void;
}

type CameraMap = Pick<MapRef, 'cameraForBounds' | 'easeTo'>;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KIND_COLOR_EXPR = [
  'match',
  ['get', 'kind'],
  ...VENUE_KINDS.flatMap((k) => [k.id, k.color]),
  '#475467',
] as unknown as string;

/**
 * Pose della camera, come la vista 3D di Urbe Hub: Roma inclinata e ruotata di 17°,
 * Municipio e quartiere col nord in alto e meno inclinati (la mappa si legge, i pin si toccano).
 */
const ROMA_BEARING = -17;
const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
const pose = () =>
  isDesktop() ? { roma: 52, municipio: 42, area: 40, venue: 50 } : { roma: 48, municipio: 38, area: 36, venue: 45 };
/** Sopra questo numero di risultati Roma resta a tessere; sotto, i luoghi si vedono già da Roma */
const FEW = 60;
/** Stile della mappa di Urbe Hub: opacità dei riempimenti, velo, confini dei Municipi */
const OPAC = { area: 0.42, zf: 0.5, areaVicino: 0.26, zfVicino: 0.32 };
const VELO = { colore: '#1C2024', opacita: 0.38 };
const AMARANTO = '#8E001C';
/** Raggio del tocco attorno al dito e altezza indicativa di un pin, in px */
const TOUCH_RADIUS = 18;
const PIN_HEIGHT = 44;

interface Props {
  venues: VenueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  /** Municipi e quartieri con i conteggi (da useAreas, calcolati nello schermo) */
  areas: Areas | null;
  /** Livello di lettura: Roma, un Municipio, un'area. Decide cosa si vede, non lo zoom. */
  zone: Zone;
  onZone: (z: Zone) => void;
  /** Spazio occupato da pannelli sopra la mappa, per inquadrare nello spazio libero */
  padding?: { top: number; bottom: number; left: number; right: number };
  /** L'utente ha preso in mano la mappa (trascina, zoom, rotazione) */
  onUserMove?: () => void;
}

const ATTRIBUTION =
  'Quartieri: <a href="https://geoportale.comune.roma.it" target="_blank" rel="noopener noreferrer">Roma Capitale</a> · Municipi: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL) · Mappa e colori: <a href="https://romaquartieri.it" target="_blank" rel="noopener noreferrer">Urbe Hub, romaquartieri.it</a> (MIT)';

const vis = (on: boolean) => ({ visibility: (on ? 'visible' : 'none') as 'visible' | 'none' });

const LABEL_LAYOUT = (size: number) => ({
  'text-field': ['format', ['get', 'nome'], { 'font-scale': 1 }, '\n', {}, ['get', 'conteggio'], { 'font-scale': 0.8 }] as unknown as string,
  'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
  'text-size': size,
  'text-max-width': 9,
  'symbol-sort-key': ['-', 0, ['get', 'count']] as unknown as number,
});
const LABEL_PAINT = { 'text-color': '#0f172a', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.6, 'text-emissive-strength': 1 };

const PIN_EXPR = ['concat', 'pin-', ['get', 'kind']] as unknown as string;
const PIN_SEL_EXPR = ['concat', 'pin-', ['get', 'kind'], '-sel'] as unknown as string;

/**
 * Mappa a livelli, come la mappa dei quartieri di romaquartieri.it (Urbe Hub, MIT):
 *  - Roma: le aree in rilievo, colore del loro Municipio, altezza per tipo;
 *  - Municipio: tutto a terra, le sue aree colorate (retino per le zone funzionali),
 *    il resto velato; i luoghi sono punti toccabili, da vicino diventano pin;
 *  - quartiere: l'area chiara con il contorno, i pin dei suoi luoghi, il resto velato.
 * Cosa si vede dipende dal livello scelto, non dallo zoom: i luoghi del quartiere
 * si vedono sempre, qualunque zoom raggiunga l'inquadratura.
 */
export const VenuesMap = forwardRef<VenuesMapHandle, Props>(function VenuesMap(
  { venues, selectedId, onSelect, userLocation, areas, zone, onZone, padding, onUserMove },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const orbitRaf = useRef<number | null>(null);
  const loaded = useRef(false);
  // Prima del load i voli su un luogo o sui risultati andrebbero persi: si tiene l'ultimo e lo si applica al load
  const pendingCam = useRef<(() => void) | null>(null);
  const whenReady = (fn: () => void) => {
    if (loaded.current) fn();
    else pendingCam.current = fn;
  };
  const stopOrbit = () => {
    if (orbitRaf.current != null) cancelAnimationFrame(orbitRaf.current);
    orbitRaf.current = null;
  };
  useEffect(() => stopOrbit, []);
  /** L'istanza arriva con l'evento load: al primo load il ref di react-map-gl può essere ancora vuoto */
  const inst = useRef<CameraMap | null>(null);
  /** zoom dove l'ultima inquadratura automatica si è fermata: allontanarsi molto risale di livello */
  const framedZoom = useRef<number | null>(null);

  const areaOf = areas?.areaOf;
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: venues
        .filter((v) => v.latitude != null && v.longitude != null)
        .map((v) => {
          const a = areaOf?.(v);
          return {
            type: 'Feature' as const,
            id: v.id,
            geometry: { type: 'Point' as const, coordinates: [v.longitude!, v.latitude!] },
            properties: {
              id: v.id,
              kind: v.kind,
              area: a?.id ?? -1,
              mun: a?.municipio ?? -1,
              community: v.community ? 1 : 0,
              lat_rank: Math.round((90 - v.latitude!) * 10000),
              inactive: v.status === 'inagibile' || v.status === 'progettazione' || v.status === 'realizzazione' ? 1 : 0,
            },
          };
        }),
    }),
    [venues, areaOf],
  );

  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  const [hoverMun, setHoverMun] = useState<number | null>(null);
  const pad = padding ?? { top: 140, bottom: 120, left: 24, right: 24 };
  const padRef = useRef(pad);
  padRef.current = pad;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const areasRef = useRef(areas);
  areasRef.current = areas;

  /** Inquadra il livello corrente nello spazio libero tra barra in alto e dock */
  const frame = useCallback((animate = true) => {
    const m = mapRef.current ?? inst.current;
    const ar = areasRef.current;
    const z = zoneRef.current;
    if (!m || !ar || !loaded.current || ((z.level === 'area' || z.level === 'roma') && z.quiet)) return;
    const p = pose();
    const duration = !animate || reducedMotion() ? 0 : 1500;
    const fit = (b: BBox, pitch: number, bearing: number, maxZoom: number, roma = false) => {
      try {
        // Roma intera: solo logo sopra e dock sotto, ai lati si può rifilare la costa (come Urbe Hub su mobile)
        const pd = roma ? { ...padRef.current, top: Math.min(padRef.current.top, 90), left: 0, right: 0 } : padRef.current;
        const cam = m.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pd, pitch, bearing, maxZoom });
        if (!cam) return;
        if (roma && !isDesktop() && cam.zoom != null) cam.zoom += 0.4;
        m.easeTo({ ...cam, pitch, bearing, duration, essential: true });
        framedZoom.current = cam.zoom ?? null;
      } catch {
        // mappa senza dimensioni (per esempio senza token): il livello resta giusto
      }
    };
    if (z.level === 'roma') fit(ar.romaBox, p.roma, ROMA_BEARING, 11.5, true);
    if (z.level === 'municipio') {
      const b = ar.municipioBox.get(z.m);
      if (b) fit(b, p.municipio, 0, 14);
    }
    if (z.level === 'area') {
      const a = ar.areaInfo.get(z.id);
      if (a) fit(a.box, p.area, 0, 16.2);
    }
  }, []);

  // Il livello cambia → la camera inquadra la zona (le maschere cambiano nello stesso render)
  const zoneKey = JSON.stringify(zone);
  const hasAreas = !!areas;
  useEffect(() => {
    frame();
  }, [zoneKey, hasAreas, frame]);

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, zoom = 16.2, opts) {
      whenReady(() => {
      const m = mapRef.current;
      if (!m) return;
      const desk = isDesktop();
      m.flyTo({
        center: [lng, lat],
        zoom,
        pitch: opts?.pitch ?? pose().venue,
        // niente rotazioni che disorientano: il nord resta dov'è
        bearing: opts?.bearing ?? (zoneRef.current.level === 'roma' ? 0 : m.getBearing()),
        duration: reducedMotion() ? 0 : 1600,
        curve: 1.3,
        essential: true,
        // la scheda del luogo copre il basso (mobile) o il lato destro (desktop): il luogo resta libero
        offset: opts?.offset ?? (desk ? [-200, 0] : [0, -Math.round(window.innerHeight * 0.18)]),
      });
      framedZoom.current = zoom;
      });
    },
    overview() {
      if (zoneRef.current.level === 'roma') frame();
      else onZone({ level: 'roma' });
    },
    orbit(on) {
      stopOrbit();
      if (!on || reducedMotion()) return;
      const step = () => {
        const m = mapRef.current;
        if (!m) return;
        // Non durante un volo o un inquadramento: setBearing li interromperebbe a metà
        if (!m.isEasing()) m.setBearing(m.getBearing() + 0.06);
        orbitRaf.current = requestAnimationFrame(step);
      };
      orbitRaf.current = requestAnimationFrame(step);
    },
    fitTo(list) {
      whenReady(() => fitNow(list));
    },
  }));

  const fitNow = (list: VenueSummary[]) => {
    {
      const m = mapRef.current;
      if (!m) return;
      const pts = list.filter((v) => v.latitude != null && v.longitude != null);
      if (!pts.length) return;
      if (pts.length === 1) {
        m.flyTo({ center: [pts[0].longitude!, pts[0].latitude!], zoom: 16, pitch: pose().venue, bearing: 0, duration: 1500 });
        return;
      }
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const p of pts) {
        minX = Math.min(minX, p.longitude!); maxX = Math.max(maxX, p.longitude!);
        minY = Math.min(minY, p.latitude!); maxY = Math.max(maxY, p.latitude!);
      }
      try {
        m.fitBounds([[minX, minY], [maxX, maxY]], { padding: padRef.current, pitch: pose().municipio, bearing: 0, duration: 1400, maxZoom: 15.5 });
      } catch {
        // mappa senza dimensioni
      }
    }
  };

  const onLoad = useCallback((e: { target: unknown }) => {
    inst.current = e.target as CameraMap;
    const map = e.target as unknown as {
      setConfigProperty?: (s: string, k: string, v: unknown) => void;
      on: (ev: string, cb: (e: { id: string }) => void) => void;
    } & Parameters<typeof registerPins>[0];
    if (map) {
      registerPins(map);
      registerHatches(map);
      map.on('styleimagemissing', (e) => {
        if (e.id.startsWith('pin-')) registerPins(map, e.id);
        if (e.id.startsWith('retino-')) registerHatches(map);
      });
    }
    try {
      map?.setConfigProperty?.('basemap', 'lightPreset', MAP_LIGHT_PRESET);
      map?.setConfigProperty?.('basemap', 'showPointOfInterestLabels', false);
      map?.setConfigProperty?.('basemap', 'showTransitLabels', false);
      map?.setConfigProperty?.('basemap', 'theme', 'faded');
    } catch {
      // stile senza config
    }
    loaded.current = true;
    // le icone sono arrivate dopo il primo disegno dei simboli: si ridispongono i luoghi e le aree
    for (const id of ['venues', 'aree'] as const) {
      const src = (e.target as { getSource?: (id: string) => { setData?: (d: unknown) => void } | undefined }).getSource?.(id);
      const data = id === 'venues' ? geojsonRef.current : areasRef.current?.aree;
      if (src?.setData && data) src.setData(data);
    }
    (e.target as { getCanvas?: () => HTMLCanvasElement }).getCanvas?.().setAttribute('aria-hidden', 'true');
    // Un link con un luogo o dei filtri ha già chiesto la sua camera: vince sull'ingresso su Roma
    const cam = pendingCam.current;
    pendingCam.current = null;
    if (cam) setTimeout(cam, 0);
    else frame();
  }, [frame]);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const feats = e.features ?? [];
      // Due tocchi distinti. Prima i luoghi: si cerca attorno al dito (un punto è più piccolo
      // di un polpastrello) e vince il più vicino. Solo dove non c'è un luogo il tocco è dell'area.
      const r = TOUCH_RADIUS;
      const layers = ['venue-dots', 'venue-pins'].filter((id) => e.target.getLayer(id));
      const hits = layers.length
        ? e.target.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r + PIN_HEIGHT]], { layers })
        : [];
      let best: string | null = null;
      let bestD = Infinity;
      for (const f of hits) {
        if (f.geometry.type !== 'Point' || !f.properties?.id) continue;
        const p = e.target.project(f.geometry.coordinates as [number, number]);
        // il pin sta sopra il suo punto: si misura dal centro del disegno, non dalla punta
        const cy = f.layer?.id === 'venue-pins' ? p.y - PIN_HEIGHT / 2 : p.y;
        const d = Math.hypot(p.x - e.point.x, cy - e.point.y);
        if (d < bestD) {
          bestD = d;
          best = f.properties.id as string;
        }
      }
      if (best && bestD <= r + PIN_HEIGHT / 2) {
        onSelect(best);
        return;
      }
      const area = feats.find((f) => f.layer?.id?.startsWith('aree-'));
      if (!area) return;
      const m = Number(area.properties?.municipio);
      const id = Number(area.properties?.id);
      if (zone.level === 'roma' || m !== zone.m) onZone({ level: 'municipio', m });
      else if (zone.level !== 'area' || zone.id !== id) onZone({ level: 'area', m, id });
    },
    [onSelect, onZone, zone],
  );

  // Solo i gesti dell'utente (originalEvent), non i voli lanciati dal codice
  const userMoved = useCallback(
    (e: ViewStateChangeEvent) => {
      if (!(e as { originalEvent?: Event }).originalEvent) return;
      stopOrbit();
      onUserMove?.();
    },
    [onUserMove],
  );

  // Allontanarsi molto con le dita risale di un livello (quartiere → Municipio → Roma)
  const onMoveEnd = useCallback(
    (e: { originalEvent?: unknown; viewState: { zoom: number } }) => {
      const z = zoneRef.current;
      const f = framedZoom.current;
      if (!e.originalEvent || f == null || z.level === 'roma') return;
      if (e.viewState.zoom < f - 1.6) onZone(z.level === 'area' ? { level: 'municipio', m: z.m } : { level: 'roma' });
    },
    [onZone],
  );

  const onMove = useCallback(
    (e: MapMouseEvent) => {
      if (zone.level !== 'roma') return;
      const f = e.features?.find((x) => x.layer?.id === 'aree-roma');
      const m = f ? Number(f.properties?.municipio) : null;
      setHoverMun((cur) => (cur === m ? cur : m));
    },
    [zone.level],
  );

  const inMun = zone.level === 'roma' ? -1 : zone.m;
  const selArea = zone.level === 'area' ? zone.id : -1;
  const few = venues.length <= FEW;
  const atRoma = zone.level === 'roma';
  const near = zone.level === 'area';
  // Roma con pochi risultati: tutto a terra, così i pin si vedono e si toccano
  const flat = !atRoma || few;
  /** Aree colorate: a Roma (piatta) tutte, dentro un Municipio solo le sue */
  const areaFilter = (zf: boolean) =>
    (atRoma
      ? ['==', ['get', 'zf'], zf]
      : ['all', ['==', ['get', 'zf'], zf], ['==', ['get', 'municipio'], inMun], ['!=', ['get', 'id'], selArea]]) as unknown as FilterSpecification;
  const veloFilter = (near ? ['!=', ['get', 'id'], selArea] : ['!=', ['get', 'municipio'], inMun]) as unknown as FilterSpecification;

  // Luoghi: punti nel Municipio scelto (e attorno al quartiere), pin nel quartiere scelto
  const dotsFilter = (near
    ? ['all', ['==', ['get', 'mun'], inMun], ['!=', ['get', 'area'], selArea]]
    : ['==', ['get', 'mun'], inMun]) as unknown as FilterSpecification;
  const pinsFilter = (atRoma ? ['boolean', true] : near ? ['==', ['get', 'area'], selArea] : ['==', ['get', 'mun'], inMun]) as unknown as FilterSpecification;
  const showPins = (atRoma && few) || !atRoma;

  return (
    <MapGL
      ref={mapRef}
      initialViewState={{ longitude: DEFAULT_CENTER.longitude, latitude: DEFAULT_CENTER.latitude, zoom: 9.6, pitch: 0, bearing: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLES.standard3d}
      mapboxAccessToken={MAPBOX_TOKEN}
      minZoom={8}
      maxZoom={19}
      maxPitch={65}
      attributionControl={false}
      interactiveLayerIds={['aree-roma', 'aree-fill', 'aree-retino', 'aree-velo', 'venue-dots', 'venue-pins']}
      onLoad={onLoad}
      onClick={onClick}
      onMoveStart={userMoved}
      onMoveEnd={onMoveEnd}
      cursor="auto"
      onMouseMove={(e) => {
        onMove(e);
        e.target.getCanvas().style.cursor = e.features?.length ? 'pointer' : '';
      }}
      onMouseLeave={(e) => {
        setHoverMun(null);
        e.target.getCanvas().style.cursor = '';
      }}
    >
      {areas && (
        <Source id="municipi" type="geojson" data={areas.municipi}>
          {/* Confini dei Municipi: amaranto, 1,4 px, 55% (come la 2D di Urbe Hub) */}
          <Layer
            id="mun-linea"
            type="line"
            slot="middle"
            layout={vis(flat)}
            paint={{ 'line-color': AMARANTO, 'line-width': 1.4, 'line-opacity': 0.55, 'line-emissive-strength': 1 }}
          />
        </Source>
      )}
      {areas && (
        <Source id="aree" type="geojson" data={areas.aree}>
          {/* Roma: tutte le aree in rilievo, colore del Municipio, altezza per tipo */}
          <Layer
            id="aree-roma"
            type="fill-extrusion"
            layout={vis(!flat)}
            paint={{
              'fill-extrusion-color': ['get', 'colore'],
              'fill-extrusion-height': ['get', 'hRoma'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.92,
              'fill-extrusion-vertical-gradient': true,
              'fill-extrusion-emissive-strength': 0.7,
            }}
          />
          {/* Roma, al passaggio del mouse: il Municipio si solleva */}
          <Layer
            id="aree-roma-evidenza"
            type="fill-extrusion"
            layout={vis(!flat && hoverMun != null)}
            filter={['==', ['get', 'municipio'], hoverMun ?? -1]}
            paint={{
              'fill-extrusion-color': '#ffffff',
              'fill-extrusion-height': ['+', ['get', 'hRoma'], 140],
              'fill-extrusion-base': ['get', 'hRoma'],
              'fill-extrusion-opacity': 0.5,
              'fill-extrusion-emissive-strength': 1,
            }}
          />
          {/* A terra: riempimento del colore del Municipio, retino per le zone funzionali */}
          <Layer
            id="aree-fill"
            type="fill"
            slot="middle"
            layout={vis(flat)}
            filter={areaFilter(false)}
            paint={{ 'fill-color': ['get', 'colore'], 'fill-opacity': near ? OPAC.areaVicino : OPAC.area, 'fill-emissive-strength': 1 }}
          />
          <Layer
            id="aree-retino"
            type="fill"
            slot="middle"
            layout={vis(flat)}
            filter={areaFilter(true)}
            paint={{ 'fill-pattern': ['get', 'retino'], 'fill-opacity': near ? OPAC.zfVicino : OPAC.zf }}
          />
          <Layer
            id="aree-linea"
            type="line"
            slot="middle"
            layout={vis(flat)}
            filter={(atRoma ? ['boolean', true] : ['==', ['get', 'municipio'], inMun]) as unknown as FilterSpecification}
            paint={{ 'line-color': ['get', 'linea'], 'line-width': 1, 'line-opacity': 0.8, 'line-emissive-strength': 1 }}
          />
          {/* Fuori dal livello: velo scuro leggero (il VELO di Urbe Hub) */}
          <Layer
            id="aree-velo"
            type="fill"
            slot="middle"
            layout={vis(!atRoma)}
            filter={veloFilter}
            paint={{ 'fill-color': VELO.colore, 'fill-opacity': VELO.opacita, 'fill-emissive-strength': 1 }}
          />
          {/* Quartiere scelto: la strada si legge, contorno pieno */}
          <Layer
            id="area-scelta-bordo"
            type="line"
            slot="middle"
            layout={{ ...vis(near), 'line-join': 'round' }}
            filter={['==', ['get', 'id'], selArea]}
            paint={{ 'line-color': ['get', 'linea'], 'line-width': 3.5, 'line-emissive-strength': 1 }}
          />
        </Source>
      )}
      {areas && (
        <Source id="municipi-focus" type="geojson" data={areas.municipi}>
          <Layer
            id="mun-focus"
            type="line"
            slot="middle"
            layout={{ ...vis(zone.level === 'municipio'), 'line-join': 'round' }}
            filter={['==', ['get', 'id'], inMun]}
            paint={{ 'line-color': AMARANTO, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4], 'line-emissive-strength': 1 }}
          />
        </Source>
      )}
      {areas && (
        <Source id="municipi-etichette" type="geojson" data={areas.municipiEtichette}>
          <Layer id="municipi-nomi" type="symbol" slot="top" layout={{ ...LABEL_LAYOUT(13), ...vis(atRoma && !few) }} paint={LABEL_PAINT} />
        </Source>
      )}
      {areas && (
        <Source id="aree-etichette" type="geojson" data={areas.areeEtichette}>
          <Layer
            id="aree-nomi"
            type="symbol"
            slot="top"
            maxzoom={14.5}
            layout={{ ...LABEL_LAYOUT(12), ...vis(zone.level === 'municipio') }}
            filter={['==', ['get', 'municipio'], inMun]}
            paint={LABEL_PAINT}
          />
        </Source>
      )}

      <Source id="venues" type="geojson" data={geojson}>
        {/* Punti: tutti i luoghi del Municipio, toccabili a qualunque zoom */}
        <Layer
          id="venue-dots"
          type="circle"
          slot="top"
          layout={vis(!atRoma)}
          filter={dotsFilter}
          paint={{
            'circle-color': KIND_COLOR_EXPR,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 13, 5, 16, 7],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': ['case', ['==', ['get', 'inactive'], 1], 0.5, 1],
            'circle-pitch-alignment': 'map',
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="community-ring"
          type="circle"
          slot="top"
          layout={vis(showPins)}
          filter={['all', ['==', ['get', 'community'], 1], pinsFilter] as unknown as FilterSpecification}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 8, 16, 10],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#f5b301',
            'circle-emissive-strength': 1,
          }}
        />
        {/* Pin col tipo di luogo: nel quartiere scelto sempre, nel Municipio da vicino */}
        <Layer
          id="venue-pins"
          type="symbol"
          slot="top"
          minzoom={zone.level === 'municipio' ? 14.5 : 0}
          layout={{
            ...vis(showPins),
            'icon-image': PIN_EXPR,
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 14, 0.85, 17, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['get', 'lat_rank'],
            'symbol-z-order': 'source',
          }}
          filter={pinsFilter}
          paint={{
            'icon-opacity': ['case', ['==', ['get', 'inactive'], 1], 0.55, 1],
            'icon-occlusion-opacity': 1,
            'icon-emissive-strength': 1,
          }}
        />
        <Layer
          id="venue-selected"
          type="symbol"
          slot="top"
          filter={['==', ['get', 'id'], selectedId ?? '']}
          layout={{
            'icon-image': PIN_SEL_EXPR,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
          paint={{ 'icon-emissive-strength': 1, 'icon-occlusion-opacity': 1 }}
        />
      </Source>

      <AttributionControl
        compact
        position="bottom-right"
        customAttribution={ATTRIBUTION}
      />

      {userLocation && (
        <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
          <UserLocationDot />
        </Marker>
      )}
    </MapGL>
  );
});
