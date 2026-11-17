'use client';

import type { CityDetails } from '@flanr/shared';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { BaseMap } from '@/components/map/base-map';
import { cityShape } from '@/lib/map/layers';

const sourceId = 'flanr-city';
const highlight = '#111827';
const casing = '#ffffff';

/**
 * The map of a city page with the city's boundary, or its centre when it has none
 * (FR-CITY-001, FR-MAP-001).
 */
export function CityMap({ city }: { city: Pick<CityDetails, 'name' | 'centre' | 'boundary'> }) {
  const t = useTranslations('map');
  const shape = useMemo(() => cityShape(city), [city]);

  const onStyleLoad = useCallback(
    (map: MapboxMap) => {
      const source = map.getSource<GeoJSONSource>(sourceId);
      if (source) source.setData(shape.features);
      else map.addSource(sourceId, { type: 'geojson', data: shape.features });
      if (map.getLayer(`${sourceId}-fill`)) return;
      const polygons = ['==', ['geometry-type'], 'Polygon'];
      map.addLayer({
        id: `${sourceId}-fill`,
        type: 'fill',
        source: sourceId,
        filter: polygons,
        paint: { 'fill-color': highlight, 'fill-opacity': 0.1, 'fill-emissive-strength': 1 },
      });
      map.addLayer({
        id: `${sourceId}-casing`,
        type: 'line',
        source: sourceId,
        filter: polygons,
        paint: { 'line-color': casing, 'line-width': 5, 'line-emissive-strength': 1 },
      });
      map.addLayer({
        id: `${sourceId}-line`,
        type: 'line',
        source: sourceId,
        filter: polygons,
        paint: { 'line-color': highlight, 'line-width': 2.5, 'line-emissive-strength': 1 },
      });
      map.addLayer({
        id: `${sourceId}-point`,
        type: 'circle',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 8,
          'circle-color': highlight,
          'circle-stroke-color': casing,
          'circle-stroke-width': 3,
          'circle-emissive-strength': 1,
        },
      });
    },
    [shape],
  );

  return (
    <BaseMap
      label={t('cityLabel', { name: city.name })}
      initialView={shape.view}
      onStyleLoad={onStyleLoad}
      cooperativeGestures
      className="h-72 sm:h-96"
    />
  );
}
