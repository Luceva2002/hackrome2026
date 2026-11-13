'use client';

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import MapGL, { Layer, Marker, Source, type MapRef, type MapMouseEvent } from 'react-map-gl/mapbox';
import type { GeoJSONSource } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { UserLocationDot } from '@/features/map/components/UserLocationDot';
import { DEFAULT_CENTER, MAPBOX_TOKEN, MAP_LIGHT_PRESET, MAP_STYLES } from '@/lib/mapbox/config';
import { VENUE_KINDS } from '@/lib/sports/taxonomy';
import type { VenueSummary } from '../types';

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

const KIND_COLOR_EXPR = [
  'match',
  ['get', 'kind'],
  ...VENUE_KINDS.flatMap((k) => [k.id, k.color]),
  '#475467',
] as unknown as string;

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
    };
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
      interactiveLayerIds={['clusters', 'venue-points']}
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
          id="clusters"
          type="circle"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': '#0f172a',
            'circle-opacity': 0.88,
            'circle-radius': ['step', ['get', 'point_count'], 16, 20, 21, 100, 27],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#f5b301',
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={['has', 'point_count']}
          layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-allow-overlap': true }}
          paint={{ 'text-color': '#ffffff', 'text-emissive-strength': 1 }}
        />
        <Layer
          id="venue-points"
          type="circle"
          filter={['!', ['has', 'point_count']]}
          paint={{
            'circle-color': KIND_COLOR_EXPR,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 9],
            'circle-stroke-width': ['case', ['==', ['get', 'community'], 1], 3, 2],
            'circle-stroke-color': ['case', ['==', ['get', 'community'], 1], '#f5b301', '#ffffff'],
            'circle-opacity': ['case', ['==', ['get', 'inactive'], 1], 0.45, 1],
            'circle-emissive-strength': 1,
          }}
        />
        <Layer
          id="venue-selected"
          type="circle"
          filter={['==', ['get', 'id'], selectedId ?? '']}
          paint={{
            'circle-color': 'rgba(0,0,0,0)',
            'circle-radius': 16,
            'circle-stroke-width': 4,
            'circle-stroke-color': '#f5b301',
            'circle-emissive-strength': 1,
          }}
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
