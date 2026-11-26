import { cityTileLayers, cityTileMaxZoom } from '@flanr/shared';
import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { addCityDot, addMarkerImages, cityDotImage } from '@/components/map/marker-images';
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
  visited: 'flanr-visited',
  planned: 'flanr-planned',
  selection: 'flanr-selection',
} as const;

const highlight = '#111827';
const casing = '#ffffff';

/** Keeps the colours of Flanr's layers as they are under the day and night of the base map. */
const emissive = 1;

const selected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
/** A boundary shown like the selected one: selected, or one of the user's outlined cities. */
const shown: ExpressionSpecification = [
  'any',
  selected,
  ['boolean', ['feature-state', 'outlined'], false],
];

/** All cities of Flanr from the API's vector tiles, and their boundaries for the highlight. */
export function addCityTiles(map: MapboxMap): void {
  if (map.getSource(citySourceId)) return;
  map.addSource(citySourceId, {
    type: 'vector',
    tiles: [`${window.location.origin}/tiles/cities/{z}/{x}/{y}.mvt`],
    maxzoom: cityTileMaxZoom,
  });
  const boundaries = { source: citySourceId, 'source-layer': cityTileLayers.boundaries };
  // Boundaries are invisible until shown; the fill also lets a click inside a city find it.
  map.addLayer({
    id: layerIds.boundaryFill,
    type: 'fill',
    ...boundaries,
    paint: {
      'fill-color': highlight,
      'fill-opacity': ['case', shown, 0.12, 0],
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
      'line-opacity': ['case', shown, 0.9, 0],
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
      'line-opacity': ['case', shown, 1, 0],
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

/** Markers grow a little with the zoom around the size of their style. */
const markerScale: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2,
  0.85,
  8,
  1,
  14,
  1.3,
];
/** The same scale for circles; the zoom can only be the input of the outermost expression. */
const radius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2,
  ['*', ['get', 'radius'], 0.85],
  8,
  ['get', 'radius'],
  14,
  ['*', ['get', 'radius'], 1.3],
];

/**
 * The user's visited cities in the style of the mode (FR-MAP-005). Each marker is one image
 * with its value inside, so that a marker of a higher class covers a lower one completely.
 */
export function addVisitedLayer(map: MapboxMap, data: MarkerCollection): void {
  addMarkerImages(
    map,
    data.features.map((marker) => marker.properties),
  );
  setSourceData(map, layerIds.visited, data);
  if (map.getLayer(layerIds.visited)) return;
  map.addLayer({
    id: layerIds.visited,
    type: 'symbol',
    source: layerIds.visited,
    layout: {
      'icon-image': ['get', 'image'],
      'icon-size': markerScale,
      'icon-allow-overlap': true,
      // City names make way for the markers (addCityLabels).
      'icon-ignore-placement': false,
      'symbol-sort-key': ['get', 'sortKey'],
    },
    paint: { 'icon-emissive-strength': emissive },
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
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 19, 8, 22, 14, 27],
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

/**
 * Shows the boundaries of these cities as the selected one's is shown, and hides those of the
 * cities shown before that are not among them.
 */
export function outlineBoundaries(map: MapboxMap, cityIds: number[], previous: number[]): void {
  if (!map.getSource(citySourceId)) return;
  const target = { source: citySourceId, sourceLayer: cityTileLayers.boundaries };
  const next = new Set(cityIds);
  for (const id of previous) {
    if (!next.has(id)) map.setFeatureState({ ...target, id }, { outlined: false });
  }
  for (const id of next) map.setFeatureState({ ...target, id }, { outlined: true });
}

function setSourceData(map: MapboxMap, id: string, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) source.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

/** The layers a click looks in for a city, the topmost first. */
export const clickableLayers = [
  layerIds.visited,
  layerIds.planned,
  layerIds.cityLabels,
  layerIds.cityPoints,
  layerIds.boundaryFill,
];

/** The font of Mapbox's Standard style, with one that has all scripts. */
const labelFont = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

const population: ExpressionSpecification = ['coalesce', ['get', 'population'], 0];
const capital: ExpressionSpecification = ['get', 'capital'];

/**
 * Which cities have a name at a zoom: zoomed out only capitals of countries and large cities,
 * closer in also capitals of regions and ever smaller places, and every place from zoom 10.
 * Fewer names are easier to read and quicker to draw.
 */
const labelFilter = (() => {
  const atLeast = (people: number): ExpressionSpecification => [
    'any',
    ['==', capital, 'national'],
    ['==', capital, 'regional'],
    ['>=', population, people],
  ];
  return [
    'step',
    ['zoom'],
    ['any', ['==', capital, 'national'], ['>=', population, 500_000]],
    4,
    atLeast(200_000),
    5,
    atLeast(100_000),
    6,
    atLeast(50_000),
    7,
    atLeast(20_000),
    8,
    atLeast(5_000),
    9,
    atLeast(1_000),
    10,
    true,
  ] as ExpressionSpecification;
})();

/**
 * The size of a city's name: larger for more people, and for capitals of countries and regions
 * at least the size of a large city.
 */
const labelSize: ExpressionSpecification = [
  'max',
  ['step', population, 10.5, 10_000, 11.5, 100_000, 12.5, 500_000, 14, 1_000_000, 15],
  ['match', capital, 'national', 16, 'regional', 13, 0],
];

/**
 * Which names are placed first where they would collide: capitals of countries, then of
 * regions, then by the number of people. Mapbox places lower keys first.
 */
const labelRank: ExpressionSpecification = [
  '-',
  0,
  ['+', population, ['match', capital, 'national', 2e9, 'regional', 1e9, 0]],
];

/**
 * Flanr's names of the cities from the tiles, which the user clicks to select a city
 * (FR-MAP-003). They lie below the user's markers and make way for them: a name that would
 * overlap a marker moves to another side of its city or is left out, as are names that would
 * overlap a larger place's. `marked` are the cities with a marker, whose names keep clear of it.
 */
export function addCityLabels(map: MapboxMap, dark: boolean, marked: number[]): void {
  if (map.getLayer(layerIds.cityLabels)) {
    setMarkedCities(map, marked);
    return;
  }
  addCityDot(map);
  const below = [layerIds.planned, layerIds.visited].find((id) => map.getLayer(id));
  map.addLayer(
    {
      id: layerIds.cityLabels,
      type: 'symbol',
      source: citySourceId,
      'source-layer': cityTileLayers.points,
      minzoom: 2,
      filter: labelFilter,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': labelFont,
        'text-size': labelSize,
        'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
        'text-radial-offset': labelOffset(marked),
        // A dot where the city is, as on common map services; under a marker it is not needed.
        // A name and its dot are shown together or not at all.
        'icon-image': labelIcon(marked),
        'icon-size': ['match', capital, 'national', 1.3, 1],
        // Room around each name, so that about half as many fit as names alone would need.
        'text-padding': 12,
        'text-max-width': 8,
        'symbol-sort-key': labelRank,
      },
      paint: {
        ...labelColors(dark),
        'text-halo-width': 1.5,
        'text-emissive-strength': emissive,
        'icon-halo-width': 1.5,
        'icon-emissive-strength': emissive,
      },
    },
    below,
  );
}

function labelColors(dark: boolean) {
  return {
    'text-color': [
      'case',
      selected,
      dark ? '#fbbf24' : '#b45309',
      dark ? '#e5e7eb' : '#1f2937',
    ] as ExpressionSpecification,
    'text-halo-color': dark ? '#111827' : '#ffffff',
    'icon-color': dark ? '#d1d5db' : '#4b5563',
    'icon-halo-color': dark ? '#111827' : '#ffffff',
  };
}

/** Gives the names the colours of the site's light or dark theme. */
export function setLabelTheme(map: MapboxMap, dark: boolean): void {
  if (!map.getLayer(layerIds.cityLabels)) return;
  for (const [name, value] of Object.entries(labelColors(dark))) {
    map.setPaintProperty(layerIds.cityLabels, name as 'text-color', value);
  }
}

/** The distance of a name from its city, in ems: clear of the largest marker where it has one. */
function labelOffset(marked: number[]): ExpressionSpecification {
  return ['case', ['in', ['id'], ['literal', marked]], 1.6, 0.6];
}

/** The dot beside the name, left out for cities with a marker. */
function labelIcon(marked: number[]): ExpressionSpecification {
  return ['case', ['in', ['id'], ['literal', marked]], '', cityDotImage];
}

/** Tells the names which cities have a marker now. */
export function setMarkedCities(map: MapboxMap, marked: number[]): void {
  if (map.getLayer(layerIds.cityLabels)) {
    map.setLayoutProperty(layerIds.cityLabels, 'text-radial-offset', labelOffset(marked));
    map.setLayoutProperty(layerIds.cityLabels, 'icon-image', labelIcon(marked));
  }
}

/** A marker for every city, which shows where each one is (FR-MAP-003); off by default. */
export function showCityMarkers(map: MapboxMap, visible: boolean): void {
  if (map.getLayer(layerIds.cityPoints)) {
    map.setLayoutProperty(layerIds.cityPoints, 'visibility', visible ? 'visible' : 'none');
  }
}
