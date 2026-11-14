'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import MapGL, { AttributionControl, Layer, Marker, Source, type MapRef, type MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { UserLocationDot } from '@/features/map/components/UserLocationDot';
import { DEFAULT_CENTER, MAPBOX_TOKEN, MAP_LIGHT_PRESET, MAP_STYLES } from '@/lib/mapbox/config';
import { VENUE_KINDS } from '@/lib/sports/taxonomy';
import type { VenueSummary } from '../types';
import { type Areas, type BBox, type Zone } from '@/features/map/areas';
import { registerPins } from './map-pins';

export interface VenuesMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number, opts?: { pitch?: number; bearing?: number }) => void;
  fitTo: (venues: VenueSummary[]) => void;
  overview: () => void;
  /** Rotazione lenta della camera (es. mentre l'assistente ascolta) */
  orbit: (on: boolean) => void;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KIND_COLOR_EXPR = [
  'match',
  ['get', 'kind'],
  ...VENUE_KINDS.flatMap((k) => [k.id, k.color]),
  '#475467',
] as unknown as string;

/** Vista d'insieme: Roma inclinata, si leggono i prismi della densità */
const OVERVIEW = { center: [12.47, 41.88] as [number, number], zoom: 10.4, pitch: 48, bearing: -12 };

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
}

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
 * Mappa 3D a livelli, come la vista 3D di romaquartieri.it (Urbe Hub, MIT):
 *  - Roma: tutte le aree in rilievo, colore del loro Municipio, altezza per tipo;
 *  - Municipio: le sue aree in sfumature del suo colore, alte quanto i luoghi, il resto velato;
 *  - area: l'area a terra con il contorno, i pin dei luoghi sopra, il resto velato.
 * Cosa si vede dipende dal livello scelto (non dallo zoom): così camera e maschere
 * restano sincronizzate anche durante i voli.
 */
export const VenuesMap = forwardRef<VenuesMapHandle, Props>(function VenuesMap(
  { venues, selectedId, onSelect, userLocation, areas, zone, onZone, padding },
  ref,
) {
  const mapRef = useRef<MapRef>(null);
  const orbitRaf = useRef<number | null>(null);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: venues
        .filter((v) => v.latitude != null && v.longitude != null)
        .map((v) => ({
          type: 'Feature' as const,
          id: v.id,
          geometry: { type: 'Point' as const, coordinates: [v.longitude!, v.latitude!] },
          properties: {
            id: v.id,
            kind: v.kind,
            community: v.community ? 1 : 0,
            lat_rank: Math.round((90 - v.latitude!) * 10000),
            inactive: v.status === 'inagibile' || v.status === 'progettazione' || v.status === 'realizzazione' ? 1 : 0,
          },
        })),
    }),
    [venues],
  );

  const [hoverMun, setHoverMun] = useState<number | null>(null);
  const pad = padding ?? { top: 110, bottom: 130, left: 40, right: 40 };
  const padRef = useRef(pad);
  padRef.current = pad;

  // Il livello cambia → la camera vola sulla zona (le maschere cambiano insieme, nello stesso render)
  const zoneKey = JSON.stringify(zone);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !areas) return;
    const dur = reducedMotion() ? 0 : 1700;
    const fit = (b: BBox, pitch: number, maxZoom: number) => {
      try {
        m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: padRef.current, pitch, bearing: 0, maxZoom, duration: dur, essential: true });
      } catch {
        // mappa non ancora dimensionata: il livello resta giusto, la camera si sistema al prossimo cambio
      }
    };
    if (zone.level === 'roma') m.flyTo({ ...OVERVIEW, duration: dur, essential: true });
    if (zone.level === 'municipio') {
      const b = areas.municipioBox.get(zone.m);
      if (b) fit(b, 45, 13.5);
    }
    if (zone.level === 'area' && !zone.quiet) {
      const a = areas.areaInfo.get(zone.id);
      if (a) fit(a.box, 55, 16);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneKey, !!areas]);

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, zoom = 16.5, opts) {
      const m = mapRef.current;
      if (!m) return;
      m.flyTo({
        center: [lng, lat],
        zoom,
        pitch: opts?.pitch ?? 60,
        bearing: opts?.bearing ?? m.getBearing() + 25,
        duration: reducedMotion() ? 0 : 2200,
        curve: 1.5,
        essential: true,
        // la scheda copre la metà bassa: il luogo resta visibile sopra
        offset: [0, -120],
      });
    },
    overview() {
      mapRef.current?.flyTo({ ...OVERVIEW, duration: reducedMotion() ? 0 : 2000, essential: true });
    },
    orbit(on) {
      if (orbitRaf.current != null) cancelAnimationFrame(orbitRaf.current);
      orbitRaf.current = null;
      if (!on || reducedMotion()) return;
      const step = () => {
        const m = mapRef.current;
        if (!m) return;
        m.setBearing(m.getBearing() + 0.06);
        orbitRaf.current = requestAnimationFrame(step);
      };
      orbitRaf.current = requestAnimationFrame(step);
    },
    fitTo(list) {
      if (!mapRef.current?.isStyleLoaded()) return;
      const pts = list.filter((v) => v.latitude != null && v.longitude != null);
      if (!pts.length || !mapRef.current) return;
      if (pts.length === 1) {
        mapRef.current.flyTo({ center: [pts[0].longitude!, pts[0].latitude!], zoom: 16, pitch: 60, duration: 1800 });
        return;
      }
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const p of pts) {
        minX = Math.min(minX, p.longitude!); maxX = Math.max(maxX, p.longitude!);
        minY = Math.min(minY, p.latitude!); maxY = Math.max(maxY, p.latitude!);
      }
      mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: { top: 120, bottom: 140, left: 60, right: 60 }, pitch: 50, duration: 1600, maxZoom: 15.5 });
    },
  }));

  const onLoad = useCallback(() => {
    const map = mapRef.current?.getMap() as unknown as {
      setConfigProperty?: (s: string, k: string, v: unknown) => void;
      on: (ev: string, cb: (e: { id: string }) => void) => void;
    } & Parameters<typeof registerPins>[0];
    if (map) {
      registerPins(map);
      map.on('styleimagemissing', (e) => e.id.startsWith('pin-') && registerPins(map, e.id));
    }
    try {
      map?.setConfigProperty?.('basemap', 'lightPreset', MAP_LIGHT_PRESET);
      map?.setConfigProperty?.('basemap', 'showPointOfInterestLabels', false);
      map?.setConfigProperty?.('basemap', 'showTransitLabels', false);
      map?.setConfigProperty?.('basemap', 'theme', 'faded');
    } catch {
      // stile senza config
    }
    // Ingresso: dall'alto si scende inclinati su Roma
    if (!reducedMotion()) mapRef.current?.flyTo({ ...OVERVIEW, duration: 2800, essential: true });
  }, []);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const feats = e.features ?? [];
      // prima i luoghi, poi le aree
      const venue = feats.find((f) => f.layer?.id === 'venue-pins' || f.layer?.id === 'venue-dots');
      if (venue?.properties?.id) {
        onSelect(venue.properties.id as string);
        return;
      }
      const area = feats.find((f) => f.layer?.id?.startsWith('aree-'));
      if (!area) return;
      const m = Number(area.properties?.municipio);
      const id = Number(area.properties?.id);
      if (zone.level === 'roma' || m !== zone.m) onZone({ level: 'municipio', m });
      else onZone({ level: 'area', m, id });
    },
    [onSelect, onZone, zone],
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

  const inMun = zone.level === 'roma' ? null : zone.m;
  const selArea = zone.level === 'area' ? zone.id : -1;

  return (
    <MapGL
      ref={mapRef}
      initialViewState={{ longitude: DEFAULT_CENTER.longitude, latitude: DEFAULT_CENTER.latitude, zoom: 10, pitch: 0, bearing: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLES.standard3d}
      mapboxAccessToken={MAPBOX_TOKEN}
      maxPitch={70}
      attributionControl={false}
      interactiveLayerIds={['aree-roma', 'aree-mun', 'aree-velo', 'venue-dots', 'venue-pins']}
      onLoad={onLoad}
      onClick={onClick}
      cursor="auto"
      onMouseMove={(e) => {
        onMove(e);
        e.target.getCanvas().style.cursor = e.features?.length ? 'pointer' : '';
      }}
      onMouseLeave={(e) => {
        setHoverMun(null);
        e.target.getCanvas().style.cursor = '';
      }}
      // La mappa è un'immagine per gli screen reader: l'elenco accanto è l'alternativa navigabile
      aria-hidden
    >
      {areas && (
        <Source id="aree" type="geojson" data={areas.aree}>
          {/* Roma: tutte le aree, colore del Municipio, altezza per tipo */}
          <Layer
            id="aree-roma"
            type="fill-extrusion"
            layout={vis(zone.level === 'roma')}
            paint={{
              'fill-extrusion-color': ['get', 'colore'],
              'fill-extrusion-height': ['get', 'hRoma'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.88,
              'fill-extrusion-vertical-gradient': true,
              'fill-extrusion-emissive-strength': 0.75,
            }}
          />
          {/* Roma, al passaggio del mouse: il Municipio si solleva e si schiarisce */}
          <Layer
            id="aree-roma-evidenza"
            type="fill-extrusion"
            layout={vis(zone.level === 'roma' && hoverMun != null)}
            filter={['==', ['get', 'municipio'], hoverMun ?? -1]}
            paint={{
              'fill-extrusion-color': '#ffffff',
              'fill-extrusion-height': ['+', ['get', 'hRoma'], 140],
              'fill-extrusion-base': ['get', 'hRoma'],
              'fill-extrusion-opacity': 0.55,
              'fill-extrusion-emissive-strength': 1,
            }}
          />
          {/* Municipio / area: le sue aree in sfumature, alte quanto i luoghi */}
          <Layer
            id="aree-mun"
            type="fill-extrusion"
            layout={vis(inMun != null)}
            filter={['all', ['==', ['get', 'municipio'], inMun ?? -1], ['!=', ['get', 'id'], selArea]]}
            paint={{
              'fill-extrusion-color': ['get', 'sfumatura'],
              'fill-extrusion-height':
                zone.level === 'area' ? 25 : (['+', 40, ['*', ['get', 'tm'], 650]] as unknown as number),
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': zone.level === 'area' ? 0.55 : 0.9,
              'fill-extrusion-vertical-gradient': true,
              'fill-extrusion-emissive-strength': 0.75,
            }}
          />
          {/* Area scelta: a terra, tinta leggera e contorno, i pin restano liberi */}
          <Layer
            id="area-scelta"
            type="fill"
            slot="middle"
            layout={vis(zone.level === 'area')}
            filter={['==', ['get', 'id'], selArea]}
            paint={{ 'fill-color': ['get', 'sfumatura'], 'fill-opacity': 0.28, 'fill-emissive-strength': 1 }}
          />
          <Layer
            id="area-scelta-bordo"
            type="line"
            slot="top"
            layout={vis(zone.level === 'area')}
            filter={['==', ['get', 'id'], selArea]}
            paint={{ 'line-color': ['get', 'colore'], 'line-width': 3.5, 'line-emissive-strength': 1 }}
          />
          {/* Velo bianco su tutto ciò che è fuori dal livello (la "maschera" di Urbe Hub) */}
          <Layer
            id="aree-velo"
            type="fill"
            slot="middle"
            layout={vis(inMun != null)}
            filter={['!=', ['get', 'municipio'], inMun ?? -1]}
            paint={{ 'fill-color': '#ffffff', 'fill-opacity': 0.58, 'fill-emissive-strength': 1 }}
          />
        </Source>
      )}
      {areas && (
        <Source id="municipi-etichette" type="geojson" data={areas.municipiEtichette}>
          <Layer id="municipi-nomi" type="symbol" slot="top" layout={{ ...LABEL_LAYOUT(13), ...vis(zone.level === 'roma') }} paint={LABEL_PAINT} />
        </Source>
      )}
      {areas && (
        <Source id="aree-etichette" type="geojson" data={areas.areeEtichette}>
          <Layer
            id="aree-nomi"
            type="symbol"
            slot="top"
            layout={{ ...LABEL_LAYOUT(12), ...vis(zone.level === 'municipio') }}
            filter={['==', ['get', 'municipio'], inMun ?? -1]}
            paint={LABEL_PAINT}
          />
        </Source>
      )}

      <Source id="venues" type="geojson" data={geojson}>
        <Layer
          id="venue-dots"
          type="circle"
          slot="top"
          minzoom={13.4}
          paint={{
            'circle-color': KIND_COLOR_EXPR,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.4, 3, 14, 5, 15, 6.5],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0, 14, 1, 14.8, 1, 15.3, 0],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0, 14, 1, 14.8, 1, 15.3, 0],
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="community-ring"
          type="circle"
          slot="top"
          minzoom={12.4}
          filter={['==', ['get', 'community'], 1]}
          paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.4, 4.5, 14, 7.5, 15, 9],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#f5b301',
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="venue-pins"
          type="symbol"
          slot="top"
          minzoom={14.6}
          layout={{
            'icon-image': PIN_EXPR,
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 14.6, 0.75, 17, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['get', 'lat_rank'],
          }}
          paint={{
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14.6, 0, 15.1, ['case', ['==', ['get', 'inactive'], 1], 0.5, 1]],
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
          paint={{ 'icon-emissive-strength': 1 }}
        />
      </Source>

      <AttributionControl
        compact
        position="bottom-right"
        customAttribution="Quartieri: Roma Capitale (dati aperti) · Municipi: © OpenStreetMap (ODbL) · via romaquartieri.it"
      />

      {userLocation && (
        <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
          <UserLocationDot />
        </Marker>
      )}
    </MapGL>
  );
});
