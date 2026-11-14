'use client';

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import MapGL, { Layer, Marker, Source, type MapRef, type MapMouseEvent } from 'react-map-gl/mapbox';
import type { GeoJSONSource } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { UserLocationDot } from '@/features/map/components/UserLocationDot';
import { DEFAULT_CENTER, MAPBOX_TOKEN, MAP_LIGHT_PRESET, MAP_STYLES } from '@/lib/mapbox/config';
import type { VenueSummary } from '../types';
import { registerPins } from './map-pins';

export interface VenuesMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitTo: (venues: VenueSummary[]) => void;
}

interface Props {
  venues: VenueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

const PIN_EXPR = ['concat', 'pin-', ['get', 'kind']] as unknown as string;
const PIN_SEL_EXPR = ['concat', 'pin-', ['get', 'kind'], '-sel'] as unknown as string;

/** Mappa con clustering nativo Mapbox: regge 2.000 punti senza un Marker DOM per luogo. */
export const VenuesMap = forwardRef<VenuesMapHandle, Props>(function VenuesMap(
  { venues, selectedId, onSelect, userLocation },
  ref,
) {
  const mapRef = useRef<MapRef>(null);

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

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, zoom = 16) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1200, essential: true });
    },
    fitTo(list) {
      const pts = list.filter((v) => v.latitude != null && v.longitude != null);
      if (!pts.length || !mapRef.current) return;
      if (pts.length === 1) {
        mapRef.current.flyTo({ center: [pts[0].longitude!, pts[0].latitude!], zoom: 15.5, duration: 1200 });
        return;
      }
      let minX = 180, minY = 90, maxX = -180, maxY = -90;
      for (const p of pts) {
        minX = Math.min(minX, p.longitude!); maxX = Math.max(maxX, p.longitude!);
        minY = Math.min(minY, p.latitude!); maxY = Math.max(maxY, p.latitude!);
      }
      mapRef.current.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, duration: 1200, maxZoom: 15 });
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
    } catch {
      // stile senza config
    }
  }, []);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      if (f.layer?.id === 'clusters') {
        const src = mapRef.current?.getSource('venues') as GeoJSONSource | undefined;
        const clusterId = f.properties?.cluster_id as number;
        src?.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
          mapRef.current?.easeTo({ center: [lng, lat], zoom, duration: 600 });
        });
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
      initialViewState={{ longitude: DEFAULT_CENTER.longitude, latitude: DEFAULT_CENTER.latitude, zoom: 11, pitch: 0 }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLES.standard3d}
      mapboxAccessToken={MAPBOX_TOKEN}
      maxPitch={60}
      dragRotate={false}
      interactiveLayerIds={['clusters', 'venue-pins']}
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
      <Source id="venues" type="geojson" data={geojson} cluster clusterMaxZoom={14} clusterRadius={46}>
        <Layer
          id="cluster-halo"
          type="circle"
          slot="top"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#f5b301',
            'circle-opacity': 0.22,
            'circle-radius': ['step', ['get', 'point_count'], 26, 20, 32, 100, 40],
            'circle-blur': 0.35,
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="clusters"
          type="circle"
          slot="top"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#0f172a',
            'circle-radius': ['step', ['get', 'point_count'], 18, 20, 22, 100, 28],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          slot="top"
          filter={['has', 'point_count']}
          layout={{
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': ['step', ['get', 'point_count'], 13, 100, 15],
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          }}
          paint={{ 'text-color': '#ffffff', 'text-emissive-strength': 1 }}
        />
        <Layer
          id="venue-pins"
          type="symbol"
          slot="top"
          filter={['!', ['has', 'point_count']]}
          layout={{
            'icon-image': PIN_EXPR,
            'icon-anchor': 'bottom',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.72, 14, 0.9, 17, 1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'symbol-sort-key': ['get', 'lat_rank'],
          }}
          paint={{
            'icon-opacity': ['case', ['==', ['get', 'inactive'], 1], 0.5, 1],
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
