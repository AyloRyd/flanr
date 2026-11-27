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
  visitedNames: 'flanr-visited-names',
  plannedNames: 'flanr-planned-names',
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
/**
 * How the markers and the ring around the selected city grow with the zoom: the scale of the
 * markers and the radius of the ring in pixels.
 */
const zoomStops = [
  { zoom: 2, scale: 0.85, ring: 19 },
  { zoom: 8, scale: 1, ring: 22 },
  { zoom: 14, scale: 1.3, ring: 27 },
] as const;
const ringStroke = 3;
const markerScale = [
  'interpolate',
  ['linear'],
  ['zoom'],
  ...zoomStops.flatMap(({ zoom, scale }) => [zoom, scale]),
] as ExpressionSpecification;
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
      // City names make way for the markers (addCityLabels), up to the marker's edge, so that
      // the name beside it fits.
      'icon-ignore-placement': false,
      'icon-padding': 0,
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
  for (const id of [layerIds.planned, layerIds.plannedNames]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
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
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        ...zoomStops.flatMap(({ zoom, ring }) => [zoom, ring]),
      ],
      'circle-opacity': 0,
      'circle-stroke-color': highlight,
      'circle-stroke-width': ringStroke,
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
  // The name beside the city's marker.
  for (const source of [layerIds.visited, layerIds.planned]) {
    if (!map.getSource(source)) continue;
    if (previous !== null) map.setFeatureState({ source, id: previous }, { selected: false });
    if (cityId !== null) map.setFeatureState({ source, id: cityId }, { selected: true });
  }
  moveNamesOffRing(map, cityId);
}

/** Moves the selected city's name beyond the ring around it. */
function moveNamesOffRing(map: MapboxMap, cityId: number | null): void {
  const offsets = [
    { id: layerIds.cityLabels, offset: dotNameOffset(cityId) },
    { id: layerIds.visitedNames, offset: markerNameOffset(cityId) },
    { id: layerIds.plannedNames, offset: markerNameOffset(cityId) },
  ];
  for (const { id, offset } of offsets) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'text-radial-offset', offset);
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
  layerIds.visitedNames,
  layerIds.plannedNames,
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
/**
 * An expression by zoom for which cities have a name: zoomed out only the important ones, closer
 * in ever smaller places, all from zoom 10. `at` gets the least number of people at a zoom and
 * whether it is the farthest zoom, where only capitals of countries count.
 */
function byZoom(
  at: (people: number, farthest: boolean) => ExpressionSpecification | boolean,
): ExpressionSpecification {
  const people = [200_000, 100_000, 50_000, 20_000, 5_000, 1_000];
  return [
    'step',
    ['zoom'],
    at(500_000, true),
    ...people.flatMap((least, index) => [4 + index, at(least, false)]),
    10,
    at(0, false),
  ] as ExpressionSpecification;
}

const labelFilter = byZoom((people, farthest) =>
  people === 0
    ? true
    : [
        'any',
        ['==', capital, 'national'],
        ['==', capital, farthest ? 'national' : 'regional'],
        ['>=', population, people],
      ],
);

/** The name beside a marker, by the same rule as the names of the tiles, without capitals. */
const markerText = byZoom((people) =>
  people === 0
    ? ['get', 'name']
    : ['case', ['>=', ['coalesce', ['get', 'population'], 0], people], ['get', 'name'], ''],
);

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
 * The gap between a name's box and the edge of its dot or marker, in pixels. The box keeps a few
 * pixels beside the text, which already make the gap.
 */
const nameGap = 0.5;
/** Half the box of the dot's image, in pixels, from which Mapbox measures a name's offset. */
const dotBox = 6;

/**
 * The offset of a name, in ems: beyond the `edge` of its dot or marker (in pixels at a scale of
 * the markers), or beyond the ring around the selected city. Mapbox measures the offset from the
 * edge of the symbol's own icon (`icon`), or from the city where the symbol has none. It does not
 * let the state of a feature move a name, so the selected city is part of the expression.
 */
function nameOffset(
  size: ExpressionSpecification | number,
  selectedId: number | null,
  icon: number,
  edge: (scale: number) => ExpressionSpecification | number,
): ExpressionSpecification {
  const at = ({ scale, ring }: (typeof zoomStops)[number]): ExpressionSpecification => {
    const beyond: ExpressionSpecification = [
      'case',
      ['==', ['id'], selectedId ?? -1],
      ['max', edge(scale), ring + ringStroke],
      edge(scale),
    ];
    return ['/', ['+', ['-', beyond, icon], nameGap], size];
  };
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...zoomStops.flatMap((stop) => [stop.zoom, at(stop)]),
  ] as ExpressionSpecification;
}

/** A name beside its dot, which is the icon of the same symbol. */
const dotNameOffset = (selectedId: number | null) =>
  nameOffset(labelSize, selectedId, dotBox, () => dotBox);
/** A name beside a marker, which is in a layer of its own. */
const markerNameOffset = (selectedId: number | null) =>
  nameOffset(markedNameSize, selectedId, 0, (scale) => [
    '*',
    ['+', ['get', 'radius'], ['get', 'strokeWidth']],
    scale,
  ]);

/** The size of the names of the cities with a marker. */
const markedNameSize = 13;

/**
 * Flanr's names of the cities from the tiles, which the user clicks to select a city
 * (FR-MAP-003). They lie below the user's markers and make way for them: a name that would
 * overlap a marker moves to another side of its city or is left out, as are names that would
 * overlap a larger place's. The cities with a marker (`marked`) have their names beside the
 * marker instead (addMarkerNames).
 */
export function addCityLabels(map: MapboxMap, dark: boolean, marked: number[]): void {
  addMarkerNames(map, dark);
  if (map.getLayer(layerIds.cityLabels)) {
    setMarkedCities(map, marked);
    return;
  }
  addCityDot(map);
  const below = [
    layerIds.plannedNames,
    layerIds.visitedNames,
    layerIds.planned,
    layerIds.visited,
  ].find((id) => map.getLayer(id));
  map.addLayer(
    {
      id: layerIds.cityLabels,
      type: 'symbol',
      source: citySourceId,
      'source-layer': cityTileLayers.points,
      minzoom: 2,
      filter: labelFilter,
      layout: {
        'text-field': labelText(marked),
        'text-font': labelFont,
        'text-size': labelSize,
        // Right of the dot, as on common map services; left of it where the right has no room.
        'text-variable-anchor': ['left', 'right'],
        'text-justify': 'auto',
        'text-radial-offset': dotNameOffset(null),
        // A dot where the city is, as on common map services.
        // A name and its dot are shown together or not at all.
        'icon-image': cityDotImage,
        'icon-size': ['match', capital, 'national', 1.3, 1],
        // Room around each name, so that about a third as many fit as names alone would need.
        'text-padding': 18,
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

/**
 * The names of the cities with a marker, just beside the marker. They are layers of their own
 * below the markers, so that every marker keeps its room and a name that does not fit is left
 * out; larger places keep theirs first. A name in the layer of the tiles would keep the room for
 * the thinning, which its own marker never leaves, so these thin out by population instead.
 */
function addMarkerNames(map: MapboxMap, dark: boolean): void {
  const names = [
    { id: layerIds.visitedNames, source: layerIds.visited },
    { id: layerIds.plannedNames, source: layerIds.planned },
  ];
  for (const { id, source } of names) {
    if (map.getLayer(id) || !map.getLayer(source)) continue;
    const above = map.getLayer(layerIds.visitedNames) ? layerIds.visitedNames : undefined;
    const below =
      above ?? [layerIds.planned, layerIds.visited].find((layer) => map.getLayer(layer));
    map.addLayer(
      {
        id,
        type: 'symbol',
        source,
        layout: {
          'text-field': markerText,
          'text-font': labelFont,
          'text-size': markedNameSize,
          'text-variable-anchor': ['left', 'right'],
          'text-justify': 'auto',
          'text-radial-offset': markerNameOffset(null),
          'text-max-width': 8,
          // No room around the name: the room would reach into its own marker.
          'text-padding': 0,
          'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'population'], 0]],
          visibility: map.getLayoutProperty(source, 'visibility') ?? 'visible',
        },
        paint: { ...nameColors(dark), 'text-halo-width': 1.5, 'text-emissive-strength': emissive },
      },
      below,
    );
  }
}

function nameColors(dark: boolean) {
  return {
    'text-color': [
      'case',
      selected,
      dark ? '#fbbf24' : '#b45309',
      dark ? '#e5e7eb' : '#1f2937',
    ] as ExpressionSpecification,
    'text-halo-color': dark ? '#111827' : '#ffffff',
  };
}

function labelColors(dark: boolean) {
  return {
    ...nameColors(dark),
    'icon-color': dark ? '#d1d5db' : '#4b5563',
    'icon-halo-color': dark ? '#111827' : '#ffffff',
  };
}

/** Gives the names the colours of the site's light or dark theme. */
export function setLabelTheme(map: MapboxMap, dark: boolean): void {
  const layers = [
    { id: layerIds.cityLabels, colors: labelColors(dark) },
    { id: layerIds.visitedNames, colors: nameColors(dark) },
    { id: layerIds.plannedNames, colors: nameColors(dark) },
  ];
  for (const { id, colors } of layers) {
    if (!map.getLayer(id)) continue;
    for (const [name, value] of Object.entries(colors)) {
      map.setPaintProperty(id, name as 'text-color', value);
    }
  }
}

/** The name of a city from the tiles, left out where its marker has the name beside it. */
function labelText(marked: number[]): ExpressionSpecification {
  return ['case', ['in', ['id'], ['literal', marked]], '', ['get', 'name']];
}

/** Tells the names which cities have a marker now. */
export function setMarkedCities(map: MapboxMap, marked: number[]): void {
  if (map.getLayer(layerIds.cityLabels)) {
    map.setLayoutProperty(layerIds.cityLabels, 'text-field', labelText(marked));
  }
}

/** A marker for every city, which shows where each one is (FR-MAP-003); off by default. */
export function showCityMarkers(map: MapboxMap, visible: boolean): void {
  if (map.getLayer(layerIds.cityPoints)) {
    map.setLayoutProperty(layerIds.cityPoints, 'visibility', visible ? 'visible' : 'none');
  }
}
