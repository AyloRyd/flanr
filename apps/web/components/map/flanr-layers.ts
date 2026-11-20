import { cityTileLayers, cityTileMaxZoom } from '@flanr/shared';
import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { MarkerCollection } from '@/lib/map/layers';

/**
 * Flanr's own layers on top of the base map (FR-MAP-003): the city tiles of the API, the
 * user's cities and the highlight of the selected city. Every function can run again after a
 * change of the base style, which removes all of them.
 */

export const citySourceId = 'flanr-cities';
export const layerIds = {
  boundaryFill: 'flanr-city-boundary-fill',
  boundaryLine: 'flanr-city-boundary-line',
  boundaryCasing: 'flanr-city-boundary-casing',
  cityPoints: 'flanr-city-points',
  cityLabels: 'flanr-city-labels',
  visitedValues: 'flanr-visited-values',
  visited: 'flanr-visited',
  planned: 'flanr-planned',
  selection: 'flanr-selection',
} as const;

const highlight = '#111827';
const casing = '#ffffff';

/** Keeps the colours of Flanr's layers as they are under the light presets of the base map. */
const emissive = 1;

const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];

/** All cities of Flanr from the API's vector tiles, and their boundaries for the highlight. */
export function addCityTiles(map: MapboxMap): void {
  if (map.getSource(citySourceId)) return;
  map.addSource(citySourceId, {
    type: 'vector',
    tiles: [`${window.location.origin}/tiles/cities/{z}/{x}/{y}.mvt`],
    maxzoom: cityTileMaxZoom,
  });
  const boundaries = { source: citySourceId, 'source-layer': cityTileLayers.boundaries };
  // Boundaries are invisible until selected; the fill also lets a click inside a city find it.
  map.addLayer({
    id: layerIds.boundaryFill,
    type: 'fill',
    ...boundaries,
    paint: {
      'fill-color': highlight,
      'fill-opacity': ['case', selected, 0.12, 0],
      'fill-emissive-strength': emissive,
    },
  });
  map.addLayer({
    id: layerIds.boundaryCasing,
    type: 'line',
    ...boundaries,
    paint: {
      'line-color': casing,
      'line-width': 5,
      'line-opacity': ['case', selected, 0.9, 0],
      'line-emissive-strength': emissive,
    },
  });
  map.addLayer({
    id: layerIds.boundaryLine,
    type: 'line',
    ...boundaries,
    paint: {
      'line-color': highlight,
      'line-width': 2.5,
      'line-opacity': ['case', selected, 1, 0],
      'line-emissive-strength': emissive,
    },
  });
  map.addLayer({
    id: layerIds.cityPoints,
    type: 'circle',
    source: citySourceId,
    'source-layer': cityTileLayers.points,
    minzoom: 3,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 3, 12, 4],
      'circle-color': '#64748b',
      'circle-opacity': 0.75,
      'circle-stroke-color': casing,
      'circle-stroke-width': 0.75,
      'circle-emissive-strength': emissive,
    },
  });
}

/** Marker radii grow with the zoom around the radius of their style. */
const radius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2,
  ['*', ['get', 'radius'], 0.75],
  8,
  ['get', 'radius'],
  14,
  ['*', ['get', 'radius'], 1.5],
];

/** The user's visited cities in the style of the map mode (FR-MAP-005). */
export function addVisitedLayer(map: MapboxMap, data: MarkerCollection): void {
  setSourceData(map, layerIds.visited, data);
  if (map.getLayer(layerIds.visited)) return;
  map.addLayer({
    id: layerIds.visited,
    type: 'circle',
    source: layerIds.visited,
    layout: { 'circle-sort-key': ['get', 'sortKey'] },
    paint: {
      'circle-radius': radius,
      'circle-color': ['get', 'color'],
      'circle-stroke-color': casing,
      'circle-stroke-width': ['get', 'strokeWidth'],
      'circle-emissive-strength': emissive,
    },
  });
}

/** The planned cities as hollow markers, apart from the visited ones (FR-MAP-006). */
export function addPlannedLayer(map: MapboxMap, data: MarkerCollection, visible: boolean): void {
  setSourceData(map, layerIds.planned, data);
  if (!map.getLayer(layerIds.planned)) {
    // Below the visited cities: a city is never in both lists (BR-004).
    map.addLayer(
      {
        id: layerIds.planned,
        type: 'circle',
        source: layerIds.planned,
        paint: {
          'circle-radius': radius,
          'circle-color': casing,
          'circle-opacity': 0.6,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': ['get', 'strokeWidth'],
          'circle-emissive-strength': emissive,
        },
      },
      map.getLayer(layerIds.visited) ? layerIds.visited : undefined,
    );
  }
  map.setLayoutProperty(layerIds.planned, 'visibility', visible ? 'visible' : 'none');
}

/** A ring around the selected city, which also shows a city without a boundary (FR-MAP-004). */
export function addSelectionLayer(map: MapboxMap, position: [number, number] | null): void {
  setSourceData(map, layerIds.selection, {
    type: 'FeatureCollection',
    features: position
      ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: position }, properties: {} }]
      : [],
  });
  if (map.getLayer(layerIds.selection)) return;
  map.addLayer({
    id: layerIds.selection,
    type: 'circle',
    source: layerIds.selection,
    paint: {
      'circle-radius': 15,
      'circle-opacity': 0,
      'circle-stroke-color': highlight,
      'circle-stroke-width': 3,
      'circle-emissive-strength': emissive,
    },
  });
}

/** Highlights the boundary of one city in the tiles, or none (FR-MAP-004). */
export function selectBoundary(map: MapboxMap, cityId: number | null, previous: number | null) {
  if (!map.getSource(citySourceId)) return;
  // The boundary and the name of the city, which share the city's ID in the tiles.
  for (const sourceLayer of [cityTileLayers.boundaries, cityTileLayers.points]) {
    const target = { source: citySourceId, sourceLayer };
    if (previous !== null) map.setFeatureState({ ...target, id: previous }, { selected: false });
    if (cityId !== null) map.setFeatureState({ ...target, id: cityId }, { selected: true });
  }
}

function setSourceData(map: MapboxMap, id: string, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) source.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

/** The layers a click looks in for a city, the topmost first. */
export const clickableLayers = [
  layerIds.visitedValues,
  layerIds.visited,
  layerIds.planned,
  layerIds.cityLabels,
  layerIds.cityPoints,
  layerIds.boundaryFill,
];

/** The settlement labels of Mapbox's classic styles; those of countries and regions stay. */
const baseSettlementLabels = [
  'settlement-major-label',
  'settlement-minor-label',
  'settlement-subdivision-label',
];

/**
 * Hides the base map's own names of settlements, so that Flanr's names are the only ones and
 * no name appears twice (FR-MAP-003).
 */
export function hideBaseSettlementLabels(map: MapboxMap): void {
  for (const id of baseSettlementLabels) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }
}

/** The fonts of Mapbox's classic styles. */
const labelFont = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/**
 * Flanr's names of the cities from the tiles, which the user clicks to select a city
 * (FR-MAP-003). Larger places win where names would overlap.
 */
export function addCityLabels(map: MapboxMap, dark: boolean): void {
  if (map.getLayer(layerIds.cityLabels)) return;
  const byType = (city: number, town: number, village: number, hamlet: number) =>
    ['match', ['get', 'type'], 'city', city, 'town', town, 'village', village, hamlet] as const;
  map.addLayer({
    id: layerIds.cityLabels,
    type: 'symbol',
    source: citySourceId,
    'source-layer': cityTileLayers.points,
    minzoom: 2,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': labelFont,
      'text-size': [...byType(14, 12.5, 11.5, 10.5)],
      // Under the point, so that a marker on the city does not cover its name.
      'text-anchor': 'top',
      'text-offset': [0, 0.5],
      'text-padding': 3,
      'text-max-width': 8,
      'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'population'], 0]],
    },
    paint: {
      'text-color': ['case', selected, highlightText(dark), dark ? '#e5e7eb' : '#1f2937'],
      'text-halo-color': dark ? '#111827' : '#ffffff',
      'text-halo-width': 1.5,
    },
  });
}

const highlightText = (dark: boolean) => (dark ? '#fbbf24' : '#b45309');
// Drawn above the user's markers, so that a large marker never hides a name.

/** A marker for every city, which shows where each one is (FR-MAP-003); off by default. */
export function showCityMarkers(map: MapboxMap, visible: boolean): void {
  if (map.getLayer(layerIds.cityPoints)) {
    map.setLayoutProperty(layerIds.cityPoints, 'visibility', visible ? 'visible' : 'none');
  }
}

/** The value of the mode inside the user's markers, when values are shown (FR-MAP-005). */
export function addVisitedValues(map: MapboxMap, visible: boolean): void {
  if (!map.getLayer(layerIds.visitedValues)) {
    map.addLayer({
      id: layerIds.visitedValues,
      type: 'symbol',
      source: layerIds.visited,
      filter: ['!=', ['get', 'value'], ''],
      layout: {
        'text-field': ['get', 'value'],
        'text-font': labelFont,
        'text-size': 11,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'symbol-sort-key': ['get', 'sortKey'],
        'symbol-z-order': 'source',
      },
      paint: { 'text-color': ['get', 'textColor'] },
    });
  }
  map.setLayoutProperty(layerIds.visitedValues, 'visibility', visible ? 'visible' : 'none');
}
