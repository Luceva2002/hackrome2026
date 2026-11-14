'use client';

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import MapGL, { Layer, Marker, Source, type MapRef, type MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

import { UserLocationDot } from '@/features/map/components/UserLocationDot';
import { DEFAULT_CENTER, MAPBOX_TOKEN, MAP_LIGHT_PRESET, MAP_STYLES } from '@/lib/mapbox/config';
import { VENUE_KINDS } from '@/lib/sports/taxonomy';
import type { VenueSummary } from '../types';
import { densityGrid } from './density';
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
const OVERVIEW = { center: [12.49, 41.885] as [number, number], zoom: 11.3, pitch: 52, bearing: -18 };

interface Props {
  venues: VenueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

const PIN_EXPR = ['concat', 'pin-', ['get', 'kind']] as unknown as string;
const PIN_SEL_EXPR = ['concat', 'pin-', ['get', 'kind'], '-sel'] as unknown as string;

/**
 * Mappa 3D: da lontano prismi esagonali di densità, avvicinandosi punti colorati
 * per tipologia, da vicino pin con l'icona del tipo di luogo. Tutto in WebGL.
 */
export const VenuesMap = forwardRef<VenuesMapHandle, Props>(function VenuesMap(
  { venues, selectedId, onSelect, userLocation },
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

  const density = useMemo(() => densityGrid(venues), [venues]);

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
      const f = e.features?.[0];
      if (!f) return;
      if (f.layer?.id === 'density') {
        const { cx, cy } = f.properties as { cx: number; cy: number };
        mapRef.current?.flyTo({ center: [cx, cy], zoom: 15, pitch: 58, duration: reducedMotion() ? 0 : 1600, essential: true });
        return;
      }
      const id = f.properties?.id as string | undefined;
      if (id) onSelect(id);
    },
    [onSelect],
  );

  return (
    <MapGL
      ref={mapRef}
      initialViewState={{ longitude: DEFAULT_CENTER.longitude, latitude: DEFAULT_CENTER.latitude, zoom: 10, pitch: 0, bearing: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLES.standard3d}
      mapboxAccessToken={MAPBOX_TOKEN}
      maxPitch={70}
      interactiveLayerIds={['density', 'venue-dots', 'venue-pins']}
      onLoad={onLoad}
      onClick={onClick}
      cursor="auto"
      onMouseEnter={(e) => {
        if (e.features?.length) e.target.getCanvas().style.cursor = 'pointer';
      }}
      onMouseLeave={(e) => {
        e.target.getCanvas().style.cursor = '';
      }}
      // La mappa è un'immagine per gli screen reader: l'elenco accanto è l'alternativa navigabile
      aria-hidden
    >
      <Source id="density" type="geojson" data={density}>
        <Layer
          id="density"
          type="fill-extrusion"
          maxzoom={14.6}
          paint={{
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 't'], 0, '#fde68a', 0.3, '#f5b301', 0.65, '#ea580c', 1, '#be123c'],
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 10, ['*', ['get', 'count'], 110], 14, ['*', ['get', 'count'], 40]],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.88, 13.2, 0.75, 14.4, 0],
            'fill-extrusion-vertical-gradient': true,
            'fill-extrusion-emissive-strength': 0.55,
          }}
        />
      </Source>

      <Source id="venues" type="geojson" data={geojson}>
        <Layer
          id="venue-dots"
          type="circle"
          slot="top"
          minzoom={12.4}
          paint={{
            'circle-color': KIND_COLOR_EXPR,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.4, 2.5, 14, 5, 15, 6.5],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12.4, 0, 13.2, 1, 14.8, 1, 15.3, 0],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 12.4, 0, 13.2, 1, 14.8, 1, 15.3, 0],
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

      {userLocation && (
        <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
          <UserLocationDot />
        </Marker>
      )}
    </MapGL>
  );
});
